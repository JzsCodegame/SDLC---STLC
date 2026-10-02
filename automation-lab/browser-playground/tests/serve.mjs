import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../practice');
const prefix='/SDLC---STLC/practice/';
http.createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(!pathname.startsWith(prefix)) {res.writeHead(404);res.end('Not found');return;}
  const relative=pathname.slice(prefix.length)||'index.html';
  const target=path.resolve(root,relative);
  if(!target.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  const bytes=await fs.readFile(target);
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
  res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
 } catch {res.writeHead(404);res.end('Not found');}
}).listen(53224,'127.0.0.1',()=>console.log(`Static practice preview: http://127.0.0.1:53224${prefix}`));
