import {existsSync,readFileSync} from 'node:fs';
import {join,resolve,dirname,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const root=dirname(dirname(fileURLToPath(import.meta.url)));
export const version=readFileSync(join(root,'moon.mod'),'utf8').match(/version\s*=\s*"([^"]+)"/)[1];
export function toolchain(){
 const platform=process.platform==='win32'?'windows-x86_64':'linux-x86_64';
 const local=join(root,'.toolchains',platform), old=resolve(root,'..','moonportcheck','.toolchains',platform);
 const home=process.env.MOONMETAMATH_TOOLCHAIN_HOME || (existsSync(join(local,'bin',process.platform==='win32'?'moon.exe':'moon'))?local:process.platform==='win32'?old:local);
 return {moon:join(home,'bin',process.platform==='win32'?'moon.exe':'moon'),env:{...process.env,MOON_HOME:home,PATH:join(home,'bin')+delimiter+process.env.PATH}};
}
export function run(file,args,options={}){
 const result=spawnSync(file,args,{cwd:root,encoding:'utf8',stdio:'inherit',...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${file} exited ${result.status}`);
 return result;
}
export function moon(args,options={}){const t=toolchain();return run(t.moon,args,{env:t.env,...options});}
