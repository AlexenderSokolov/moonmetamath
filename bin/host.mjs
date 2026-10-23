import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,sep,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const root=dirname(dirname(fileURLToPath(import.meta.url)));
export class HostError extends Error {constructor(message){super(message);this.code='HOST_IO';}}
// Only resolves source files. Grammar and mathematical validity stay in MoonBit.
export function readBundle(file,allowedRoot=dirname(resolve(file))){
 const base=realpathSync(allowedRoot),sources=[],seen=new Set();
 function add(path){
  let canonical;
  try{canonical=realpathSync(path);}catch(e){throw new HostError(`Cannot read ${path}: ${e.message}`);}
  const rel=relative(base,canonical);
  if(rel==='..'||rel.startsWith('..'+sep)||resolve(base,rel)!==canonical)throw new HostError('Include is outside the selected source root: '+path);
  const id=rel.split(sep).join('/');
  if(seen.has(canonical))return id;
  seen.add(canonical);
  if(seen.size>1000)throw new HostError('Source file limit exceeded.');
  let buffer;try{buffer=readFileSync(canonical);}catch(e){throw new HostError(e.message);}
  if(buffer.length>67108864)throw new HostError('Source exceeds 64 MiB: '+id);
  const text=buffer.toString('latin1');sources.push({source_id:id,text});
  const tokens=text.replace(/\$\([\s\S]*?\$\)/g,' ').match(/\S+/g)??[];
  for(let i=0;i<tokens.length;i++)if(tokens[i]==='$['&&tokens[i+2]==='$]')add(resolve(dirname(canonical),tokens[i+1]));
  return id;
 }
 const entry=add(resolve(file));return {entry,sources};
}
export async function coreClient(){
 const artifact=resolve(root,'dist','moonmetamath-core.mjs');
 if(!existsSync(artifact))throw new HostError('Compiled core missing; run node scripts/build.mjs. Release archives include it.');
 const core=await import(pathToFileURL(artifact).href);
 let serial=0;
 return request=>JSON.parse(core.dispatch_json(JSON.stringify({schema_version:1,request_id:String(++serial),...request})));
}
export function exitFor(result){
 const outcome=result.outcome;
 if(result.status==='error'){
  const code=result.diagnostics?.[0]?.code??'';
  if(/LIMIT|RESOURCE|ResourceLimit/.test(code))return 5;
  if(/IO|SOURCE_MISSING/.test(code))return 3;
  if(/Incomplete|EmptyFinalStack|ExtraFinalStack|GoalMismatch/.test(code))return 4;
  if(/Disjoint|ForwardReference|Inactive|UnknownLabel|StackUnderflow|Mismatch|UnverifiedDependency/.test(code))return 1;
  return 2;
 }
 return {valid:0,invalid:1,incomplete:4,unsupported:4,resource_limit:5,cancelled:5}[outcome]??0;
}
