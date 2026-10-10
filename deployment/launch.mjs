import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRouter } from './router.mjs';

const port = Number(process.env.SERVER_PORT || process.env.PORT || 3000);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw Error('Invalid SERVER_PORT');
const required = ['BTF_OIDC_ISSUER','BTF_OIDC_CLIENT_ID','BTF_OIDC_CLIENT_SECRET','BTF_EDITOR_PUBLIC_URL','BTF_EDITOR_BRIDGE_SECRET'];
const missing = required.filter(k => !process.env[k]?.trim());
if (missing.length) throw Error('Missing settings: '+missing.join(', '));

const dir = '/home/container/content/docs';
if (!existsSync(dir)) {
  mkdirSync('/home/container/content',{recursive:true});
  cpSync('/opt/btf-wiki/content/docs', dir,{recursive:true});
}
const base = {...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'};
const children = [];
let stopped = false;
const router = createRouter();
function stop(code) {
  if (stopped) return;
  stopped = true;
  router.close();
  for (const c of children) if(c.exitCode === null) c.kill('SIGTERM');
  setTimeout(()=>process.exit(code),2500).unref();
}
function run(label,args,environment={}) {
  const child = spawn('node',args,{stdio:'inherit',env:{...base,...environment}});
  children.push(child);
  child.once('exit',(code,signal)=>{
    if(!stopped) { console.error(label+' stopped unexpectedly: '+(signal??code));stop(1);}
  });
}
run('Wiki',['/opt/btf-wiki/server.js'],{PORT:'4010',HOSTNAME:'127.0.0.1'});
run('Editor',['/opt/editor/packages/studio/dist/cli.js',
  '--config','/opt/editor/btf-auth/fumadocs-studio.config.mjs',
  '--root',dir,'--port','5180','--no-open']);
run('BTF Gateway',['/opt/editor/btf-auth/gateway.mjs'],{
  BTF_EDITOR_PORT:'4011',BTF_STUDIO_PORT:'5180',
});
router.listen(port,'0.0.0.0',()=>{
  console.log('BTF Wiki and protected Editor listening on '+port);
  console.log('Wiki: /docs | Editor: /editor');
});
process.on('SIGINT',()=>stop(0));
process.on('SIGTERM',()=>stop(0));
