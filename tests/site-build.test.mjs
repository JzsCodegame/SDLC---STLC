import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {buildSite,validateDefinition} from '../scripts/build-site.mjs';
import {createPublicServer} from '../scripts/serve.mjs';

async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'academy-public-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const directory of ['practice/assets','authoring','docs','.local','assets/curriculum']) await fs.mkdir(path.join(root,directory),{recursive:true});
  const content={'index.html':'<h1>Academy</h1>','practice/index.html':'<h1>Practice</h1>','practice/assets/app.js':'console.log("public")','assets/curriculum/page-01.png':'image','authoring/private.txt':'teaching source','.local/token.json':'fixture-private','docs/notes.txt':'operator notes','students.json':'fixture-roster'};
  for(const [name,bytes] of Object.entries(content)) await fs.writeFile(path.join(root,name),bytes);
  const definition={schemaVersion:1,files:['index.html'],directories:{practice:['.html','.js'],'assets/curriculum':['.png']}};
  await fs.writeFile(path.join(root,'public-assets.json'),JSON.stringify(definition));
  return {root,definition};
}
function request(port,pathname,method='GET') {
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path:pathname,method},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString(),headers:res.headers}));
    });req.on('error',reject);req.end();
  });
}

test('tutorial screenshots export only PNG/JPEG from their bounded public directory',async t=>{
  const {root,definition}=await fixture(t);
  await fs.mkdir(path.join(root,'assets/windows-kit'));
  await fs.writeFile(path.join(root,'assets/windows-kit/setup.jpg'),'screenshot fixture');
  definition.directories['assets/windows-kit']=['.png','.jpg'];
  await fs.writeFile(path.join(root,'public-assets.json'),JSON.stringify(definition));
  const built=await buildSite(root);
  assert.ok(built.files.some(file=>file.path==='assets/windows-kit/setup.jpg'));
  assert.throws(()=>validateDefinition({...definition,directories:{'assets/windows-kit':['.js']}}),/Unsafe/);
  assert.throws(()=>validateDefinition({...definition,directories:{'assets/whimsical':['.jpg']}}),/Unsafe/);
  await fs.writeFile(path.join(root,'assets/windows-kit/private.txt'),'must not export');
  await assert.rejects(buildSite(root),/Unexpected public file/);
});

test('export includes approved bytes and removes stale generated assets without including private neighbors',async t=>{
  const {root}=await fixture(t);
  const first=await buildSite(root);
  assert.equal(first.files.length,4);
  assert.equal(await fs.readFile(path.join(root,'dist/practice/assets/app.js'),'utf8'),'console.log("public")');
  for(const name of ['authoring','docs','.local','students.json','scripts','automation-lab']) await assert.rejects(fs.access(path.join(root,'dist',name)),{code:'ENOENT'});
  await fs.rename(path.join(root,'practice/assets/app.js'),path.join(root,'practice/assets/new.js'));
  await buildSite(root);
  await assert.rejects(fs.access(path.join(root,'dist/practice/assets/app.js')),{code:'ENOENT'});
  await fs.access(path.join(root,'dist/practice/assets/new.js'));
});
test('unsafe directories, extra private input and linked public trees fail closed',async t=>{
  const {root,definition}=await fixture(t);
  assert.throws(()=>validateDefinition({...definition,directories:{authoring:['.js']}}),/Unsafe/);
  assert.throws(()=>validateDefinition({...definition,files:['../private.json']}),/Unsafe/);
  await fs.writeFile(path.join(root,'practice/.env'),'fixture-secret');
  await assert.rejects(buildSite(root),/Private/);
  await fs.unlink(path.join(root,'practice/.env'));
  await fs.symlink(path.join(root,'authoring'),path.join(root,'practice/linked'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(buildSite(root),/linked/);
});
test('export refuses to replace unrecognized or linked output directories',async t=>{
  const {root}=await fixture(t);
  await fs.mkdir(path.join(root,'dist'));
  await fs.writeFile(path.join(root,'dist/keep.txt'),'keep');
  await assert.rejects(buildSite(root),/unrecognized/);
  assert.equal(await fs.readFile(path.join(root,'dist/keep.txt'),'utf8'),'keep');
});
test('HTTP preview handles real public routes while denying source, traversal, methods and linked escapes',async t=>{
  const {root}=await fixture(t);await buildSite(root);
  await fs.symlink(path.join(root,'authoring'),path.join(root,'dist/escape'),process.platform==='win32'?'junction':'dir');
  const server=await createPublicServer({root:path.join(root,'dist'),prefix:'/academy/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const port=server.address().port;
  assert.equal((await request(port,'/academy/')).body,'<h1>Academy</h1>');
  assert.equal((await request(port,'/academy/practice/')).status,200);
  const head=await request(port,'/academy/index.html','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');assert.ok(Number(head.headers['content-length'])>0);
  assert.equal((await request(port,'/academy/index.html','POST')).status,405);
  for(const name of ['authoring/private.txt','docs/notes.txt','students.json','automation-lab/self-hosted/compose.yaml']) assert.equal((await request(port,'/academy/'+name)).status,404,name);
  for(const name of ['.local/token.json','%2e%2e/authoring/private.txt','practice/%2e%2e/index.html']) assert.equal((await request(port,'/academy/'+name)).status,403,name);
  assert.equal((await request(port,'/academy/%ZZ')).status,400);
  assert.equal((await request(port,'/index.html')).status,404);
  await fs.writeFile(path.join(root,'authoring/secret.json'),'fixture-private');
  assert.equal((await request(port,'/academy/escape/secret.json')).status,403);
});
