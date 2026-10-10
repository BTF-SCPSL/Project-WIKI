import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ALLOWED_ROLES = new Set(['owner', 'project_lead']);
export const isEditorRole = (key) => typeof key === 'string' && ALLOWED_ROLES.has(key);
export const randomToken = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier) => createHash('sha256').update(verifier).digest('base64url');

export function parseCookies(cookieHeader = '') {
  const cookies = new Map();
  for (const item of cookieHeader.split(';')) {
    const at = item.indexOf('=');
    if (at > 0) cookies.set(item.slice(0, at).trim(), item.slice(at + 1).trim());
  }
  return cookies;
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function makeAssertion(user, secret, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({
    sub: user.sub, name: user.name, role: user.role, exp: now + 15000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + signature;
}

export function verifyAssertion(value, secret, now = Date.now()) {
  if (typeof value !== 'string' || !secret) return null;
  const parts = value.split('.');
  if (parts.length !== 2 || parts.some(part => !/^[\w-]+$/.test(part))) return null;
  const actual = Buffer.from(parts[1], 'base64url');
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!Number.isFinite(decoded.exp) || decoded.exp < now || decoded.exp > now + 16000) return null;
    if (!isEditorRole(decoded.role) || !/^\d+$/.test(decoded.sub)) return null;
    if (typeof decoded.name !== 'string' || decoded.name.length > 160) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function canonicalOrigin(input, name = 'PUBLIC_URL') {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error(name + ' must be an HTTPS origin without path/query');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(name + ' must use HTTPS outside localhost');
  }
  return url.origin;
}
