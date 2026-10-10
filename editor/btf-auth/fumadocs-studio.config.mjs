// This config is also evaluated by Studio in the browser. NEVER put secrets here.
export default {
  host: '127.0.0.1',
  open: false,
  auth: () => undefined, // Gateway authenticates the HTTP and WebSocket requests.
  server: './studio.server.mjs',
};
