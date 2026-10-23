import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {root} from './common.mjs';
const at=process.argv.indexOf('--port');const port=Number(at<0?4173:process.argv[at+1]);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid --port');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mm':'text/plain; charset=us-ascii','.json':'application/json; charset=utf-8'};
createServer((req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.writeHead(302,{Location:'/web/'}).end();return;}
  if(pathname.endsWith('/'))pathname+='index.html';
  if(!['/web/','/dist/','/tests/fixtures/upstream/set-mm/'].some(p=>pathname.startsWith(p)))throw new Error('Not public');
  const file=resolve(root,'.'+pathname);
  if(!file.startsWith(root+sep)||!statSync(file).isFile()||pathname.endsWith('/peano.mm'))throw new Error('Not public');
  const data=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`MoonMetamath: http://127.0.0.1:${port}/web/`));
