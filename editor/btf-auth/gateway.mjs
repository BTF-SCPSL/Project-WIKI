import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { randomToken, pkceChallenge, parseCookies, escapeHtml, makeAssertion, canonicalOrigin, isEditorRole } from './helpers.mjs';

const needed = ['BTF_OIDC_ISSUER','BTF_OIDC_CLIENT_ID','BTF_OIDC_CLIENT_SECRET','BTF_EDITOR_PUBLIC_URL','BTF_EDITOR_BRIDGE_SECRET'];
for (const name of needed) if (!process.env[name]) throw new Error('Missing ' + name);
if (process.env.BTF_EDITOR_BRIDGE_SECRET.length < 32) throw new Error('BTF_EDITOR_BRIDGE_SECRET needs >= 32 characters');
const origin = canonicalOrigin(process.env.BTF_EDITOR_PUBLIC_URL);
const issuer = canonicalOrigin(process.env.BTF_OIDC_ISSUER, 'BTF_OIDC_ISSUER') + '/';
const localPort = Number(process.env.BTF_EDITOR_PORT ?? 3005);
const upstreamPort = Number(process.env.BTF_STUDIO_PORT ?? 5180);
if (![localPort, upstreamPort].every(n => Number.isInteger(n) && n > 0 && n <= 65535) || localPort === upstreamPort)
  throw new Error('Invalid ports');
const cookieName = origin.startsWith('https:') ? '__Host-btf_editor' : 'btf_editor_local';
const sessions = new Map();
const flows = new Map();
const lifeMs = 8 * 60 * 60_000;
const flowMs = 5 * 60_000;
const redirectUri = origin + '/auth/callback';

const metadataUrl = new URL('.well-known/openid-configuration', issuer).href;
let config;
async function jsonFetch(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const response = await fetch(url, { ...init, signal: ctl.signal, headers: { accept: 'application/json', ...init.headers } });
    if (!response.ok) throw new Error('OIDC request failed: ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function requireEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== new URL(issuer).protocol || url.origin !== new URL(issuer).origin) throw new Error('OIDC endpoint origin mismatch');
  return url.href;
}
async function discovery() {
  if (config) return config;
  const c = await jsonFetch(metadataUrl);
  if (c.issuer !== issuer) throw new Error('OIDC issuer mismatch');
  for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint']) requireEndpoint(c[key]);
  config = c;
  return config;
}
function cookie(value, maxAge) {
  return cookieName + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (origin.startsWith('https:') ? '; Secure' : '');
}
function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", ...headers });
  res.end(body);
}
function redirect(res, path, headers = {}) { res.writeHead(302, { location: path, 'cache-control': 'no-store', ...headers }); res.end(); }
function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function currentSession(req) {
  const raw = parseCookies(req.headers.cookie ?? '').get(cookieName);
  const item = raw ? sessions.get(hashToken(raw)) : null;
  if (!item || item.expires <= Date.now()) return null;
  return item;
}
async function currentUser(session) {
  const c = await discovery();
  // Fresh UserInfo is mandatory on every proxied request; changes to roles
  // are therefore observed immediately rather than trusting cached claims.
  const info = await jsonFetch(c.userinfo_endpoint, {
    headers: { authorization: 'Bearer ' + session.accessToken },
  });
  if (typeof info.sub !== 'string' || info.sub !== session.sub || !/^\d+$/.test(info.sub)) return null;
  if (!isEditorRole(info.btf_role?.key)) return null;
  return { sub: info.sub, role: info.btf_role.key, name: String(info.name || 'BTF User').slice(0, 160) };
}
function cleanFlows() {
  for (const [k, v] of flows) if (v.expires < Date.now()) flows.delete(k);
  for (const [k, v] of sessions) if (v.expires < Date.now()) sessions.delete(k);
}
function proxy(req, res, user) {
  const headers = { ...req.headers };
  delete headers['x-btf-editor-assertion'];
  delete headers.authorization;
  delete headers.cookie;
  headers.host = '127.0.0.1:' + upstreamPort;
  headers['x-btf-editor-assertion'] = makeAssertion(user, process.env.BTF_EDITOR_BRIDGE_SECRET);
  const upstream = http.request({ host: '127.0.0.1', port: upstreamPort, method: req.method, path: req.url, headers }, r => {
    const filtered = { ...r.headers };
    delete filtered['set-cookie'];
    filtered['cache-control'] = 'no-store';
    res.writeHead(r.statusCode ?? 502, filtered);
    r.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) send(res, 502, 'Редактор временно недоступен'); else res.destroy(); });
  req.pipe(upstream);
}
async function handle(req, res) {
  const path = new URL(req.url ?? '/', origin);
  if (path.pathname === '/health') return send(res, 200, 'ok');
  if (path.pathname === '/auth/login') {
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
    const c = await discovery();
    const state = randomToken();
    const verifier = randomToken();
    flows.set(hashToken(state), { verifier, expires: Date.now() + flowMs });
    const auth = new URL(c.authorization_endpoint);
    for (const [k, v] of Object.entries({
      response_type:'code',client_id:process.env.BTF_OIDC_CLIENT_ID,
      redirect_uri:redirectUri,scope:'openid profile btf.role',state,
      code_challenge:pkceChallenge(verifier),code_challenge_method:'S256',
    })) auth.searchParams.set(k,v);
    return redirect(res, auth.href);
  }
  if (path.pathname === '/auth/callback') {
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
    const state = path.searchParams.get('state');
    const code = path.searchParams.get('code');
    const flow = state && flows.get(hashToken(state));
    if (state) flows.delete(hashToken(state));
    if (!flow || flow.expires < Date.now() || !code || path.searchParams.has('error')) return send(res, 401, 'Ошибка входа BTF');
    const c = await discovery();
    const body = new URLSearchParams({
      grant_type:'authorization_code',client_id:process.env.BTF_OIDC_CLIENT_ID,
      client_secret:process.env.BTF_OIDC_CLIENT_SECRET, code, redirect_uri:redirectUri,
      code_verifier:flow.verifier,
    });
    const token = await jsonFetch(c.token_endpoint, {
      method:'POST',headers:{ 'content-type':'application/x-www-form-urlencoded' },body,
    });
    if (typeof token.access_token !== 'string' || token.token_type?.toLowerCase() !== 'bearer')
      return send(res, 401, 'Некорректный ответ BTF');
    const temporary = { accessToken: token.access_token, sub: '' };
    const info = await jsonFetch(c.userinfo_endpoint, { headers:{ authorization:'Bearer ' + token.access_token } });
    if (typeof info.sub !== 'string' || !/^\d+$/.test(info.sub) || !isEditorRole(info.btf_role?.key)) {
      return send(res, 403, '<h2>Доступ запрещён</h2><p>Редактор доступен только ролям «Владелец» и «Руководитель проекта».</p>');
    }
    temporary.sub = info.sub;
    const sessionId = randomToken();
    sessions.set(hashToken(sessionId), { ...temporary, expires: Date.now() + Math.min(lifeMs, Math.max(60, Number(token.expires_in) || 900) * 1000) });
    return redirect(res, '/', { 'set-cookie': cookie(sessionId, 8 * 60 * 60) });
  }
  if (path.pathname === '/auth/logout') {
    if (req.method !== 'POST') return send(res, 405, 'Method not allowed');
    const raw = parseCookies(req.headers.cookie ?? '').get(cookieName);
    if (raw) sessions.delete(hashToken(raw));
    return redirect(res, '/', { 'set-cookie': cookie('', 0) });
  }
  const session = currentSession(req);
  if (!session) return redirect(res, '/auth/login');
  const user = await currentUser(session);
  if (!user) return send(res, 403, '<h2>Доступ к редактору запрещён</h2><p>Проверьте роль в BTF и войдите повторно.</p>', { 'set-cookie': cookie('', 0) });
  proxy(req, res, user);
}
const server = http.createServer((req, res) => {
  cleanFlows();
  Promise.resolve(handle(req, res)).catch(error => {
    console.error('Editor auth failed:', error.message);
    if (!res.headersSent) send(res, 503, 'Не удалось проверить доступ через BTF'); else res.destroy();
  });
});
server.on('upgrade', (req, socket, head) => {
  (async () => {
    const session = currentSession(req);
    if (!session) throw new Error('No session');
    const user = await currentUser(session);
    if (!user) throw new Error('Forbidden');
    const headers = { ...req.headers };
    delete headers.authorization;
    delete headers.cookie;
    delete headers['x-btf-editor-assertion'];
    headers.host = '127.0.0.1:' + upstreamPort;
    headers['x-btf-editor-assertion'] = makeAssertion(user, process.env.BTF_EDITOR_BRIDGE_SECRET);
    const upstream = http.request({ host:'127.0.0.1', port:upstreamPort, method:'GET', path:req.url, headers });
    upstream.on('upgrade', (response, tunnel, tunnelHead) => {
      let responseText = 'HTTP/1.1 101 Switching Protocols\r\n';
      for (const [k,v] of Object.entries(response.headers)) if (v) responseText += k + ': ' + v + '\r\n';
      socket.write(responseText + '\r\n');
      if (head.length) tunnel.write(head);
      if (tunnelHead.length) socket.write(tunnelHead);
      tunnel.pipe(socket); socket.pipe(tunnel);
    });
    upstream.on('response', () => socket.destroy());
    upstream.on('error', () => socket.destroy());
    upstream.end();
  })().catch(() => { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); });
});
server.listen(localPort, '0.0.0.0', () => console.log('BTF protected Editor listening on ' + localPort));
