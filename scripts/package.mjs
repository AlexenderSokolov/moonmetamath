import {mkdirSync,copyFileSync,readdirSync,writeFileSync,readFileSync,mkdtempSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,version,run} from './common.mjs';
const at=process.argv.indexOf('--out'),out=resolve(root,at<0?'artifacts/package-'+Date.now():process.argv[at+1]);mkdirSync(out,{recursive:true});
const stage=join(out,`moonmetamath-${version}`);mkdirSync(stage,{recursive:true});
function copy(source,destination){mkdirSync(destination,{recursive:true});for(const e of readdirSync(source,{withFileTypes:true})){const s=join(source,e.name),d=join(destination,e.name);if(e.isDirectory())copy(s,d);else copyFileSync(s,d);}}
for(const dir of ['bin','dist','web','LICENSES','docs'])copy(join(root,dir),join(stage,dir));
for(const file of ['LICENSE','README.md','CHANGELOG.md'])copyFileSync(join(root,file),join(stage,file));
const fixtures=join(stage,'tests/fixtures/upstream/set-mm');mkdirSync(fixtures,{recursive:true});
for(const name of ['demo0','miu','hol'])copyFileSync(join(root,`tests/fixtures/upstream/set-mm/${name}.mm`),join(fixtures,name+'.mm'));
copyFileSync(join(root,'tests/fixtures/upstream/set-mm/LICENSE'),join(fixtures,'LICENSE'));
writeFileSync(join(stage,'USAGE.txt'),`MoonMetamath ${version}\nRequires Node.js 24. No MoonBit compiler or model API is needed.\nnode bin/moonmetamath.mjs --help\nnode bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/hol.mm\nFor browser use the public demo or serve this folder with a static HTTP server.\nSee docs/THIRD_PARTY.md for retained licenses.\n`);
const zip=join(out,`moonmetamath-${version}-node24.zip`),python=process.env.PYTHON||'python';
run(python,['-c','import sys,zipfile,pathlib; src=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [(z.write(p,p.relative_to(src.parent))) for p in sorted(src.rglob("*")) if p.is_file()]; z.close()',stage,zip]);
const unpack=mkdtempSync(join(out,'unpacked-'));
run(python,['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,unpack]);
const extracted=join(unpack,`moonmetamath-${version}`),checks=[];
for(const args of [['--version'],['verify','tests/fixtures/upstream/set-mm/hol.mm']]){
 const r=spawnSync(process.execPath,['bin/moonmetamath.mjs',...args],{cwd:extracted,env:{...process.env,MOON_HOME:'unavailable',PATH:join(out,'no-compiler')},encoding:'utf8'});
 checks.push({args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});if(r.error||r.status!==0)throw new Error('Unpacked compiler-free CLI failed: '+(r.error?.message||r.stderr));
 if(args[0]==='verify'){const response=JSON.parse(r.stdout);if(response.outcome!=='valid'||response.data.verified_count!==151)throw new Error('Unpacked HOL verdict mismatch');}
}
const sha256=createHash('sha256').update(readFileSync(zip)).digest('hex');writeFileSync(join(out,'SHA256SUMS.txt'),`${sha256}  ${zip.split(/[\\/]/).at(-1)}\n`);
const result={schema_version:1,version,pass:true,archive:relative(root,zip),sha256,checks};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
