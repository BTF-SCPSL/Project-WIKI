import test from 'node:test';
import assert from 'node:assert/strict';
import { destination } from '../router.mjs';
test('Public URLs routed to Wiki',()=>{
 for(const u of ['/','/docs','/docs/a','/_next/static/a.js','/api/search?q=one'])
  assert.equal(destination(u).port,4010,u);
});
test('Editor assets and sync routed to gateway',()=>{
 for(const u of ['/editor','/editor/?collab','/auth/login','/auth/callback?code=x',
    '/main.js','/main.css','/@vite/client','/@id/test','/node_modules/.vite/deps/x.js',
    '/__fde_sync','/__fde_upload','/__fde_asset/picture.png'])
  assert.equal(destination(u).port,4011,u);
});
test('Editor prefix maps to Studio root',()=>{
 assert.equal(destination('/editor').url,'/');
 assert.equal(destination('/editor/?collab').url,'/?collab');
 assert.equal(destination('/editor/x?q=1').url,'/x?q=1');
});
