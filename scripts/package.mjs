import {mkdirSync,copyFileSync,readdirSync,writeFileSync,readFileSync,mkdtempSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,version,run} from './common.mjs';
const at=process.argv.indexOf('--out'),out=resolve(root,at<0?'artifacts/package-'+Date.now():process.argv[at+1]);mkdirSync(out,{recursive:true});
const stage=join(out,`moonmetamath-${version}`);mkdirSync(stage,{recursive:true});
function copy(source,destination){mkdirSync(destination,{recursive:true});for(const e of readdirSync(source,{withFileTypes:true})){const s=join(source,e.name),d=join(destination,e.name);if(e.isDirectory())copy(s,d);else copyFileSync(s,d);}}
for(const dir of ['dist','web','LICENSES','docs','benchmarks'])copy(join(root,dir),join(stage,dir));
mkdirSync(join(stage,'bin'),{recursive:true});
for(const file of ['host.mjs','moonmetamath.mjs'])copyFileSync(join(root,'bin',file),join(stage,'bin',file));
copy(join(root,'examples'),join(stage,'examples'));
for(const file of ['LICENSE','README.md','CHANGELOG.md'])copyFileSync(join(root,file),join(stage,file));
const fixtures=join(stage,'tests/fixtures/upstream/set-mm');mkdirSync(fixtures,{recursive:true});
for(const name of ['demo0','miu','hol'])copyFileSync(join(root,`tests/fixtures/upstream/set-mm/${name}.mm`),join(fixtures,name+'.mm'));
copyFileSync(join(root,'tests/fixtures/upstream/set-mm/LICENSE'),join(fixtures,'LICENSE'));
writeFileSync(join(stage,'USAGE.txt'),`MoonMetamath ${version}\nRequires Node.js 24. No MoonBit compiler or model API is needed.\nnode bin/moonmetamath.mjs --help\nnode bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/hol.mm\nFor browser use the public demo or serve this folder with a static HTTP server.\nThe optional AI experiment runs from a source checkout with its independent C checker; see docs/AI_EXPERIMENT.md. It is not a compiler-free CLI command in this archive.\nSee docs/THIRD_PARTY.md for retained licenses.\n`);
const zip=join(out,`moonmetamath-${version}-node24.zip`),python=process.env.PYTHON||'python';
run(python,['-c','import sys,zipfile,pathlib; src=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [(z.write(p,p.relative_to(src.parent))) for p in sorted(src.rglob("*")) if p.is_file()]; z.close()',stage,zip]);
const unpack=mkdtempSync(join(out,'unpacked-'));
run(python,['-c','import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,unpack]);
const extracted=join(unpack,`moonmetamath-${version}`),checks=[];
writeFileSync(join(unpack,'mini.mm'),'$c |- a $. ax $a |- a $. th $p |- a $= ax $.');
writeFileSync(join(unpack,'actions.json'),JSON.stringify({schema_version:1,actions:[{operation:'apply_label',label:'ax'},{operation:'finish'}]}));
for(const args of [['--help'],['--version'],['verify','tests/fixtures/upstream/set-mm/hol.mm'],['session',join(unpack,'mini.mm'),'--theorem','th','--actions',join(unpack,'actions.json'),'--export',join(unpack,'candidate.mm')],['verify',join(unpack,'candidate.mm')]]){
 const r=spawnSync(process.execPath,['bin/moonmetamath.mjs',...args],{cwd:extracted,env:{...process.env,MOON_HOME:'unavailable',PATH:join(out,'no-compiler')},encoding:'utf8'});
 checks.push({args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr});if(r.error||r.status!==0)throw new Error('Unpacked compiler-free CLI failed: '+(r.error?.message||r.stderr));
 if(args[0]==='verify'){const response=JSON.parse(r.stdout);const expected=args[1].includes('hol.mm')?151:1;if(response.outcome!=='valid'||response.data.verified_count!==expected)throw new Error('Unpacked proof verdict mismatch');}
 if(args[0]==='session'){const response=JSON.parse(r.stdout);if(response.outcome!=='valid'||response.operation!=='export')throw new Error('Unpacked session/export did not succeed');}
}
const sha256=createHash('sha256').update(readFileSync(zip)).digest('hex');writeFileSync(join(out,'SHA256SUMS.txt'),`${sha256}  ${zip.split(/[\\/]/).at(-1)}\n`);
const result={schema_version:1,version,pass:true,archive:relative(root,zip),sha256,checks};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
