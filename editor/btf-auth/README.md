# BTF login for the Fumadocs Editor

This gateway enables existing BTF accounts through the official BTF OpenID Connect (OIDC) implementation. Only the **exact role keys** \`owner\` and \`project_lead\` can open the editor, use the sync websocket, write files or upload assets.

## API integration

The existing API already supports server-side confidential OIDC clients (see BTF-API/docs/OIDC.md), no patch to BTF-API is needed. Deploy an API release with OIDC enabled, stable signing/encryption certificates and a public issuer.

1. In BTF site /admin → «Сервисы BTF», create an enabled confidential client named «BTF Wiki Editor».
2. Callback: \`https://editor.your-domain.example/auth/callback\` (exact match).
3. Requested scopes: \`profile\` and \`btf.role\` (openid is implicit).
4. Store its \`client_id\` and \`client_secret\` only in the editor gateway's server-side environment.

## Runtime environment

\`\`\`dotenv
BTF_OIDC_ISSUER=https://api.example.com/
BTF_OIDC_CLIENT_ID=btf_example
BTF_OIDC_CLIENT_SECRET=replace-with-actual-OIDC-client-secret
BTF_EDITOR_PUBLIC_URL=https://editor.example.com
BTF_EDITOR_BRIDGE_SECRET=replace-with-a-unique-cryptographically-random-64-character-secret
BTF_EDITOR_PORT=3005
BTF_STUDIO_PORT=5180
\`\`\`

Use environment management / Pterodactyl hidden variables; never commit credentials.
The BTF API issuer must match exactly the discovery metadata. Make sure the server-to-server discovery, token and UserInfo endpoints are reachable without Cloudflare HTML challenges.

## Start both processes (Node.js >=24)

From the root of this repository after merging the Editor vendor PR:

\`\`\`bash
cd editor
corepack enable
pnpm install --frozen-lockfile
pnpm build
cd btf-auth

# Export the environment variables above, then:
node ../packages/studio/dist/cli.js \
  --config ./fumadocs-studio.config.mjs \
  --root /absolute/persistent/path/to/content/docs \
  --port 5180 --no-open
# In a second process with the same environment:
node gateway.mjs
\`\`\`

The Studio port **MUST listen only on 127.0.0.1** and must not be published by Pterodactyl/Docker or Nginx. Set an Nginx reverse proxy to the gateway TCP port, preserving WebSocket upgrade headers and HTTPS.

The Studio config is read by the browser; credentials must never be included in that config. Server-only logic lives in \`studio.server.mjs\`.

## Security properties / limitations

- Authorization Code + PKCE S256 + one-time state; HTTP-only SameSite=Lax Secure cookie.
- Server-side session with access token; raw token is never sent to browser or Studio.
- Current \`btf_role.key\` is fetched through BTF UserInfo on **every** proxied HTTP and WebSocket request. Role changes take effect on the next operation/reconnect. An existing already-open websocket must be disconnected if immediate revocation is required; currently it remains alive until disconnect.
- Both HTTP and WebSocket traffic must go through this gateway. Studio independently validates a short-lived HMAC assertion at sync and upload boundaries.
- Session is in memory, not yet Redis/database; restarting the gateway logs users out. There is no refresh-token support; the short-lived access token requires re-login when it expires.
- OIDC \`state\` is one-time, short-lived and bound to the initiating browser through a secure, HttpOnly same-site cookie. Logout requires a same-origin POST. A security review and live end-to-end tests of the OIDC flow, gateway and websocket lifecycle are still required before production deployment.
- The gateway currently does **not** replace the Fumadocs Wiki site. Published Next.js MDX pages are built separately; a file edit alone will not refresh them.
- Persistent content must be mounted at the same path expected by the deployed wiki and studio.
- Run \`node --test ./test/*.test.mjs\` to check role keys, signature, PKCE and origin validation.
