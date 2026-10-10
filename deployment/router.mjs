import http from 'node:http';

// Only this router listens on the public Pterodactyl allocation.
export function destination(url = '/') {
  const path = new URL(url, 'http://localhost').pathname;
  const isEditor = path === '/editor' || path.startsWith('/editor/') ||
    path.startsWith('/auth/') || path.startsWith('/__fde_') ||
    path.startsWith('/@vite/') || path.startsWith('/@id/') ||
    path.startsWith('/@fs/') || path.startsWith('/@react-refresh') ||
    path.startsWith('/node_modules/') || path.startsWith('/src/') ||
    path.startsWith('/app/') || path === '/main.js' || path === '/main.css';
  if (!isEditor) return {port: 4010, url};
  const rewritten = path === '/editor' ? '/' :
    path.startsWith('/editor/') ? url.slice('/editor'.length) : url;
  return {port: 4011, url: rewritten};
}
export function createRouter() {
  const router = http.createServer((req, res) => {
    const target = destination(req.url);
    const headers = {...req.headers, host: '127.0.0.1:' + target.port};
    delete headers['x-btf-editor-assertion'];
    const upstream = http.request({
      hostname:'127.0.0.1',port:target.port,method:req.method,path:target.url,headers,
    }, r => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) {res.writeHead(502);res.end('Service not ready');}
      else res.destroy();
    });
    req.pipe(upstream);
  });
  router.on('upgrade', (req, socket, head) => {
    const hmr = String(req.headers['sec-websocket-protocol'] ?? '')
      .split(',').map(v=>v.trim()).includes('vite-hmr');
    const target = destination(req.url);
    if (target.port !== 4011 && !hmr) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const headers = {...req.headers,host:'127.0.0.1:4011'};
    delete headers['x-btf-editor-assertion'];
    const upstream = http.request({
      hostname:'127.0.0.1',port:4011,method:'GET',path:target.url,headers,
    });
    upstream.on('upgrade', (r, tunnel, tunnelHead) => {
      let reply = 'HTTP/1.1 101 Switching Protocols\r\n';
      for (const [key,value] of Object.entries(r.headers)) {
        if (value !== undefined) reply += key + ': ' + value + '\r\n';
      }
      socket.write(reply + '\r\n');
      if (head.length) tunnel.write(head);
      if (tunnelHead.length) socket.write(tunnelHead);
      tunnel.pipe(socket);socket.pipe(tunnel);
      const close=()=>{socket.destroy();tunnel.destroy();};
      socket.on('error',close);tunnel.on('error',close);
    });
    upstream.on('response',()=>socket.destroy());
    upstream.on('error',()=>socket.destroy());
    upstream.end();
  });
  return router;
}
