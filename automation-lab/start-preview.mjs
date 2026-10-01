import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './practice-app/server/app.js';
const labRoot=path.dirname(fileURLToPath(import.meta.url));
const parent=path.dirname(labRoot);
const academyRoot=await fs.access(path.join(parent,'website','index.html')).then(()=>path.join(parent,'website')).catch(()=>parent);
await fs.access(path.join(academyRoot,'automation.html'));
await fs.access(path.join(labRoot,'practice-app','dist','index.html'));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const academy=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
  const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  if(relative.split(/[\\/]/).some(segment=>segment.startsWith('.')||segment==='automation-lab')){res.writeHead(403).end();return}
  const file=path.resolve(academyRoot,relative),type=types[path.extname(file)];
  if(!file.startsWith(academyRoot+path.sep)||!type){res.writeHead(404).end();return}
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end()}
});
const practice=createApp({dataDir:path.join(labRoot,'practice-app','data'),distDir:path.join(labRoot,'practice-app','dist'),labMode:true});
const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
const stop=()=>{academy.closeAllConnections();practice.closeAllConnections();academy.close();practice.close()};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{await Promise.all([listen(academy,53217),listen(practice,4173)]);console.log('Academy: http://127.0.0.1:53217/index.html\nAutomation lab: http://127.0.0.1:53217/automation.html\nPractice app: http://127.0.0.1:4173/\nLocal preview only. Press Ctrl+C to stop both servers.');}
catch(error){stop();console.error('Preview could not start:',error.code||error.message);process.exitCode=1}
