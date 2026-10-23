import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,version} from './common.mjs';
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
  execute('portable-package',process.execPath,['scripts/package.mjs','--out',join(out,'package')]);
  const receipt=resolve(root,option('--browser-receipt','artifacts/browser/receipt.json'));
  if(!existsSync(receipt))throw new Error('G3 pending: actual browser receipt is required. See tests/web/manual-checklist.md.');
  const browser=JSON.parse(readFileSync(receipt,'utf8'));for(const key of ['load','atomic_error','rewind','separate_replay','construct','download_independent','real_databases','multi_file_include','encoding_error','cancel_reload'])if(browser.checks?.[key]!==true)throw new Error(`G3 browser check missing: ${key}`);
  const downloaded=JSON.parse(readFileSync(resolve(root,browser.independent_result),'utf8'));if(downloaded.status!=='valid')throw new Error('Downloaded proof was not independently accepted');
 }else{
  const sha=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const receipt=JSON.parse(readFileSync(resolve(root,option('--receipt','artifacts/publication.json')),'utf8'));
  execute('remote-ci','gh',['run','view',String(receipt.ci_run_id),'--repo','AlexenderSokolov/moonmetamath','--json','headSha,status,conclusion']);
  const ci=JSON.parse(readFileSync(join(out,'remote-ci.stdout.txt'),'utf8'));if(ci.headSha!==sha||ci.status!=='completed'||ci.conclusion!=='success')throw new Error('Exact HEAD remote CI is not successful');
  execute('registry-consumer',process.execPath,['scripts/consumer.mjs','--registry','--version',version]);
  const response=await fetch('https://alexendersokolov.github.io/moonmetamath/web/',{signal:AbortSignal.timeout(30000)});if(!response.ok||!(await response.text()).includes('MoonMetamath'))throw new Error('Public proof lab unavailable');
 }
}catch(error){failure=error.message;process.exitCode=1;console.error(failure);}
const result={schema_version:1,phase,version,pass:failure===null,gates:phase==='local'?['G0','G1','G2','G3','G4']:['G5'],failure,steps,contest_result:'G6 requires actual organizer receipts; never inferred from technical checks'};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
