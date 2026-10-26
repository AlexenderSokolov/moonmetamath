import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,version} from './common.mjs';
import {readBrowserEvidence,webAssets} from './browser-receipt.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const phase=option('--phase','local'),out=resolve(root,option('--out','artifacts/acceptance-'+Date.now()));mkdirSync(out,{recursive:true});
if(!['local','publication'].includes(phase))throw new Error('phase must be local or publication');
const steps=[];let failure=null;
function execute(label,file,argv){console.log(`Acceptance: ${label}`);const r=spawnSync(file,argv,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});writeFileSync(join(out,label+'.stdout.txt'),r.stdout||'');writeFileSync(join(out,label+'.stderr.txt'),r.stderr||'');steps.push({label,exitCode:r.status,error:r.error?.message||null});if(r.error||r.status!==0)throw new Error(`${label} failed; inspect ${out}`);}
try{
 if(phase==='local'){
  execute('checks',process.execPath,['scripts/check.mjs','--out',join(out,'checks')]);
  execute('consumer',process.execPath,['scripts/consumer.mjs']);
  execute('oracle-self-test',process.execPath,['scripts/oracle.mjs','self-test','--out',join(out,'oracle-self-test')]);
  const m=JSON.parse(readFileSync(join(root,'tests/fixtures/manifest.json'),'utf8'));m.fixtures=m.fixtures.filter(f=>f.category==='official-database');if(m.fixtures.length!==4)throw new Error('Expected four official databases');
  const manifest=join(out,'four-databases.json');writeFileSync(manifest,JSON.stringify(m,null,2));
  execute('four-independent-databases',process.execPath,['scripts/oracle.mjs','fixtures','--manifest',manifest,'--out',join(out,'four-databases')]);
  execute('independent-79',process.execPath,['scripts/oracle.mjs','fixtures','--engine','mmreference','--out',join(out,'independent-79')]);
  execute('three-scenarios',process.execPath,['scripts/demo.mjs','--oracle','--out',join(out,'demo')]);
  execute('workbench-scenarios',process.execPath,['scripts/workbench-demo.mjs','--oracle','--out',join(out,'workbench')]);
   execute('independent-downstream',process.execPath,['scripts/downstream.mjs']);
  execute('portable-package',process.execPath,['scripts/package.mjs','--out',join(out,'package')]);
   const supplied=option('--browser-receipt',null);
   if(!supplied)execute('browser',process.execPath,['scripts/browser-check.mjs','--out',join(out,'browser')]);
   const receipt=resolve(root,supplied||join(out,'browser/receipt.json'));
   if(!existsSync(receipt))throw new Error('G3 pending: actual browser receipt is required.');
   readBrowserEvidence(receipt);
 }else{
  const ref=option('--ref','HEAD');
  const revision=spawnSync('git',['rev-parse','--verify',`${ref}^{commit}`],{cwd:root,encoding:'utf8'});if(revision.status!==0)throw new Error('Cannot resolve publication source ref');const sha=revision.stdout.trim();
   const selected=spawnSync('git',['show',`${sha}:moon.mod`],{cwd:root,encoding:'utf8'});const selectedVersion=selected.stdout?.match(/version\s*=\s*"([^"]+)"/)?.[1];
   if(selected.status!==0||selectedVersion!==version)throw new Error('Publication checks the current deployed version. For an older release use its tagged checkout and archived release assets; current latest/Pages are not historical evidence.');
  const receipt=JSON.parse(readFileSync(resolve(root,option('--receipt','artifacts/publication.json')),'utf8'));
  if(receipt.source_sha!==sha)throw new Error('Publication receipt does not identify the selected source revision');
  execute('remote-ci','gh',['run','view',String(receipt.ci_run_id),'--repo','AlexenderSokolov/moonmetamath','--json','headSha,status,conclusion']);
  const ci=JSON.parse(readFileSync(join(out,'remote-ci.stdout.txt'),'utf8'));if(ci.headSha!==sha||ci.status!=='completed'||ci.conclusion!=='success')throw new Error('Exact source revision remote CI is not successful');
  execute('registry-consumer',process.execPath,['scripts/consumer.mjs','--registry','--version',version]);
   execute('registry-downstream',process.execPath,['scripts/downstream.mjs','--registry','--version',version]);
  const manifestResponse=await fetch('https://mooncakes.io/api/v0/manifest/AlexenderSokolov/moonmetamath',{signal:AbortSignal.timeout(30000)});if(!manifestResponse.ok)throw new Error('Registry manifest unavailable');
  const registry=await manifestResponse.json();writeFileSync(join(out,'registry-manifest.json'),JSON.stringify(registry,null,2));if(registry.version!==version||registry.latest_version!==version||registry.yanked!==false||registry.build_status!=='success'||registry.has_package!==true)throw new Error('Registry version is not successfully published');
  const response=await fetch('https://alexendersokolov.github.io/moonmetamath/web/',{signal:AbortSignal.timeout(30000)});if(!response.ok||!(await response.text()).includes('MoonMetamath'))throw new Error('Public proof lab unavailable');
   const assets=webAssets;
  // Windows and Linux compilers format equivalent exponent literals differently.
  // Compare raw deployed bytes with the exact successful CI's uploaded Linux site,
  // never normalize code or accept an unrelated local-platform binary as a match.
  const artifactDir=join(out,'ci-pages-artifact');
  execute('pages-artifact-download','gh',['run','download',String(receipt.ci_run_id),'--repo','AlexenderSokolov/moonmetamath','--name','github-pages','--dir',artifactDir]);
  execute('pages-artifact-hashes',process.env.PYTHON||'python',['-c','import sys,tarfile,hashlib,json; t=tarfile.open(sys.argv[1]); files={m.name.removeprefix("./"):m for m in t.getmembers() if m.isfile()}; print(json.dumps({p:hashlib.sha256(t.extractfile(files[p]).read()).hexdigest() for p in sys.argv[2:]}))',join(artifactDir,'artifact.tar'),...assets]);
  const expectedHashes=JSON.parse(readFileSync(join(out,'pages-artifact-hashes.stdout.txt'),'utf8'));
  const hashes=[];for(const path of assets){const response=await fetch('https://alexendersokolov.github.io/moonmetamath/'+path,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Public asset unavailable: '+path);const actual=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');if(actual!==expectedHashes[path])throw new Error('Public asset differs from exact CI Pages artifact: '+path);hashes.push({path,sha256:actual,expected_source:'successful exact-source CI Pages artifact'});}writeFileSync(join(out,'public-assets.json'),JSON.stringify(hashes,null,2));
 }
}catch(error){failure=error.message;process.exitCode=1;console.error(failure);}
const result={schema_version:1,phase,version,pass:failure===null,gates:phase==='local'?['G0','G1','G2','G3','G4']:['G5'],failure,steps,contest_result:'G6 requires actual organizer receipts; never inferred from technical checks'};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
