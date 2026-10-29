import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,readBundle,coreClient,exitFor} from '../../bin/host.mjs';
const dir=join(root,'artifacts','v07-agent-usage','cli-'+Date.now());mkdirSync(dir,{recursive:true});
const good=join(dir,'good.mm'),bad=join(dir,'bad.mm'),unknown=join(dir,'unknown.mm');
writeFileSync(good,'$c |- a b $. ax $a |- a $. ok $p |- a $= ax $.');
writeFileSync(bad,'$c |- a b $. ax $a |- a $. bad $p |- b $= ax $.');
writeFileSync(unknown,'$c |- a $. unfinished $p |- a $= ? $.');
function cli(args){const r=spawnSync(process.execPath,['bin/moonmetamath.mjs',...args],{cwd:root,encoding:'utf8'});return {...r,json:JSON.parse(r.stdout.trim())};}
test('CLI genuinely distinguishes valid, invalid, incomplete and host error',()=>{
 for(const [path,outcome,exit] of [[good,'valid',0],[bad,'invalid',1],[unknown,'incomplete',4]]){const r=cli(['verify',path]);assert.equal(r.status,exit,r.stderr);assert.equal(r.json.outcome,outcome);}
 const missing=cli(['verify',join(dir,'absent.mm')]);assert.equal(missing.status,3);assert.equal(missing.json.status,'error');
});
test('session cannot exit success with an unfinished stack',()=>{
 const actions=join(dir,'empty.json');writeFileSync(actions,JSON.stringify({schema_version:1,actions:[]}));
 const r=cli(['session',good,'--theorem','ok','--actions',actions]);assert.notEqual(r.status,0);
});

test('unavailable source roots and export destinations are host IO failures',()=>{
 const missing=cli(['verify',join(dir,'absent-parent','input.mm')]);
 assert.equal(missing.status,3,missing.stdout+missing.stderr);assert.equal(missing.json.diagnostics[0].code,'HOST_IO');
 const actions=join(dir,'export-io.json');writeFileSync(actions,JSON.stringify([{operation:'apply_label',label:'ax'}]));
 for(const out of [join(dir,'absent-parent','candidate.mm'),dir]){
  const r=cli(['session',good,'--theorem','ok','--actions',actions,'--export',out]);
  assert.equal(r.status,3,r.stdout+r.stderr);assert.equal(r.json.diagnostics[0].code,'HOST_IO');
 }
});

test('CLI replay and session use a legal target prefix despite later unfinished or invalid proofs',()=>{
 const fixture=join(root,'tests/fixtures/upstream/mm-verifier-tests/unknown-tests/test001.mm');
 const actions=join(dir,'prefix-actions.json');writeFileSync(actions,JSON.stringify([{operation:'apply_label',label:'wph'},{operation:'finish'}]));
 const laterInvalid=join(dir,'later-invalid.mm');writeFileSync(laterInvalid,readFileSync(fixture,'utf8').replace('? th1','wph'));
 for(const file of [fixture,laterInvalid]){
  const replay=cli(['replay',file,'--theorem','th1']);
  assert.equal(replay.status,0,replay.stdout+replay.stderr);assert.equal(replay.json.operation,'replay');
  const session=cli(['session',file,'--theorem','th1','--actions',actions]);
  assert.equal(session.status,0,session.stdout+session.stderr);assert.equal(session.json.outcome,'valid');
 }
 const future=cli(['replay',fixture,'--theorem','th2']);assert.notEqual(future.status,0);assert.notEqual(future.json.outcome,'valid');
});

test('load resource and missing-source errors retain their distinct host exit codes',async()=>{
 const client=await coreClient();client({operation:'reset'});
 const limited=client({operation:'load',entry:'small.mm',sources:[{source_id:'small.mm',text:'$c a $.'}],limits:{max_file_bytes:1}});
 assert.equal(limited.status,'error');assert.equal(limited.diagnostics[0].code,'resource_limit');assert.equal(exitFor(limited),5);
 const missing=client({operation:'load',entry:'absent.mm',sources:[]});
 assert.equal(missing.status,'error');assert.equal(missing.diagnostics[0].code,'missing_source');assert.equal(exitFor(missing),3);
});

test('missing action files are host IO errors while malformed JSON remains an input error',()=>{
 const absent=cli(['session',good,'--theorem','ok','--actions',join(dir,'absent-actions.json')]);
 assert.equal(absent.status,3,absent.stdout+absent.stderr);assert.equal(absent.json.diagnostics[0].code,'HOST_IO');
 const actions=join(dir,'malformed-actions.json');writeFileSync(actions,'{"schema_version":1,"actions":[');
 const malformed=cli(['session',good,'--theorem','ok','--actions',actions]);
 assert.equal(malformed.status,2);assert.equal(malformed.json.diagnostics[0].code,'INPUT_ERROR');
});

test('host source byte and count quotas are resource errors using small explicit limits',()=>{
 for(const limits of [{max_file_bytes:1},{max_sources:0}]){
  let failure;
  try{readBundle(good,dir,limits);}catch(error){failure=error;}
  assert.ok(failure,'Expected the real source reader to enforce its quota');
  assert.equal(failure.code,'resource_limit');
  assert.equal(exitFor({status:'error',outcome:null,diagnostics:[{code:failure.code}]}),5);
 }
});
test('session exports the actual checked proof and refuses overwrite',()=>{
 const actions=join(dir,'proof.json'),out=join(dir,'candidate.mm');writeFileSync(actions,JSON.stringify({schema_version:1,actions:[{operation:'apply_label',label:'ax'},{operation:'finish'}]}));
 const r=cli(['session',good,'--theorem','ok','--actions',actions,'--export',out]);assert.equal(r.status,0,r.stdout+r.stderr);
 assert.match(readFileSync(out,'ascii'),/moonmm-session-1 \$p \|- a \$= ax/);assert.equal(cli(['verify',out]).status,0);
 assert.equal(cli(['session',good,'--theorem','ok','--actions',actions,'--export',out]).status,3);
});

test('session action files accept only versioned wrappers or compatible action arrays',()=>{
 const valid=[{operation:'apply_label',label:'ax'},{operation:'rewind',successful_step_count:0},{operation:'apply_label',label:'ax'},{operation:'finish'}];
 for(const [name,value] of [['array',valid],['wrapper',{schema_version:1,actions:valid}]]){
  const actions=join(dir,`${name}-valid.json`);writeFileSync(actions,JSON.stringify(value));
  const r=cli(['session',good,'--theorem','ok','--actions',actions]);
  assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.json.outcome,'valid');
 }
 const wrappers=[null,{}, {actions:valid},{schema_version:2,actions:valid},{schema_version:'1',actions:valid},{schema_version:1,actions:{}},{schema_version:1,actions:valid,request_id:'injected'}];
 for(const [index,value] of wrappers.entries()){
  const actions=join(dir,`wrapper-invalid-${index}.json`);writeFileSync(actions,JSON.stringify(value));
  const r=cli(['session',good,'--theorem','ok','--actions',actions]);
  assert.equal(r.status,2,r.stdout+r.stderr);assert.equal(r.json.diagnostics[0].code,'INPUT_ERROR');
 }
});

test('session action files reject privileged operations, injected fields and malformed arguments',()=>{
 const invalid=[null,[],{}, {operation:'reset'},{operation:'load',entry:'other.mm',sources:[]},{operation:'export',new_label:'injected'},{operation:'inspect'},{operation:'apply_label',label:1},{operation:'apply_label',label:'ax',session_id:'session-999'},{operation:'apply_label',label:'ax',request_id:'injected'},{operation:'apply_label',label:'ax',schema_version:1},{operation:'rewind',successful_step_count:-1},{operation:'rewind',successful_step_count:0.5},{operation:'rewind',successful_step_count:'0'},{operation:'rewind',successful_step_count:Number.MAX_SAFE_INTEGER+1},{operation:'rewind',successful_step_count:0,extra:true},{operation:'finish',label:'ax'},{operation:'finish',operation_override:'reset'}];
 for(const [index,action] of invalid.entries()){
  const actions=join(dir,`action-invalid-${index}.json`);writeFileSync(actions,JSON.stringify({schema_version:1,actions:[{operation:'apply_label',label:'ax'},action]}));
  const r=cli(['session',good,'--theorem','ok','--actions',actions]);
  assert.equal(r.status,2,`case ${index}: ${r.stdout}${r.stderr}`);assert.equal(r.json.diagnostics[0].code,'INPUT_ERROR');
 }
 const actions=join(dir,'rewind-out-of-range.json');writeFileSync(actions,JSON.stringify([{operation:'rewind',successful_step_count:1}]));
 const r=cli(['session',good,'--theorem','ok','--actions',actions]);
 assert.notEqual(r.status,0);assert.equal(r.json.status,'error');
});
test('wire failures are atomic and completed export is independent of original target',async()=>{
 const client=await coreClient();client({operation:'reset'});
 const db=client({operation:'load',...readBundle(good)}).data.database_id;
 assert.equal(client({operation:'verify',database_id:db}).outcome,'valid');
 const sid=client({operation:'start',database_id:db,target_label:'ok'}).data.session_id;
 const before=client({operation:'inspect',session_id:sid}).data;
 assert.equal(client({operation:'apply_label',session_id:sid,label:'ok'}).status,'error');
 assert.deepEqual(client({operation:'inspect',session_id:sid}).data,before);
 assert.equal(client({operation:'apply_label',session_id:sid,label:'ax'}).status,'ok');
 assert.equal(client({operation:'finish',session_id:sid}).outcome,'valid');
 assert.equal(client({operation:'export',session_id:sid,new_label:'candidate'}).outcome,'valid');
});
test('batch verification stays within a 64 MiB heap for a growing proof',()=>{
 const source='$c t c $. $v x $. wx $f t x $. base $a t c $. grow $a t x c $. p $p t '+Array(4001).fill('c').join(' ')+' $= base '+Array(4000).fill('grow').join(' ')+' $.';
 const file=join(dir,'growth.mm');writeFileSync(file,source);
 const code=`import {coreClient,readBundle} from './bin/host.mjs';const c=await coreClient();const l=c({operation:'load',...readBundle(${JSON.stringify(file)})});const r=c({operation:'verify',database_id:l.data.database_id});console.log(JSON.stringify(r));if(r.outcome!=='valid')process.exitCode=1;`;
 const r=spawnSync(process.execPath,['--max-old-space-size=64','--input-type=module','-e',code],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).data.verified_count,1);
});
test('CLI timeout terminates its worker with an explicit incomplete resource result',()=>{
 const r=cli(['verify',good,'--timeout-ms','1']);
 assert.equal(r.status,5);assert.equal(r.json.outcome,'resource_limit');
});


test('CLI exports its own output under a caller selected label',()=>{
 const actions=join(dir,'repeat-actions.json');writeFileSync(actions,JSON.stringify([{operation:'apply_label',label:'ax'}]));
 const first=join(dir,'first-repeat.mm'),second=join(dir,'second-repeat.mm');
 assert.equal(cli(['session',good,'--theorem','ok','--actions',actions,'--export',first]).status,0);
 const result=cli(['session',first,'--theorem','moonmm-session-1','--actions',actions,'--export',second,'--new-label','continued']);
 assert.equal(result.status,0,JSON.stringify(result.json));assert.equal(result.json.data.new_label,'continued');
});
test('CLI validates command options and routes explicit operation budgets',()=>{
 assert.equal(cli(['verify',good,'--max-operations','0']).status,5);
 assert.equal(cli(['verify',good,'--max-operations','100000000']).status,0);
 for(const args of [['verify',good,'--theorem','missing'],['list',good,'--export','bad.mm'],['verify',good,'--max-operations','-1'],['verify',good,'--max-operations','1.5'],['verify',good,'--format','json','--format','text']])assert.equal(cli(args).status,2);
});


test('CLI theorem and rule queries use bounded metadata pages', () => {
 const listed=cli(['theorems',good,'--query','ok','--offset','0','--limit','1']);
 assert.equal(listed.status,0,JSON.stringify(listed.json));assert.equal(listed.json.data.total,1);
 assert.equal(listed.json.data.theorems[0].label,'ok');assert.equal('proof' in listed.json.data.theorems[0],false);
 assert.equal(listed.json.data.theorems[0].status,'not_checked');
 const rules=cli(['rules',good,'--theorem','ok','--query','ax','--typecode','|-','--limit','1']);
 assert.equal(rules.status,0,JSON.stringify(rules.json));assert.equal(rules.json.data.rules[0].label,'ax');
 assert.equal(cli(['theorems',good,'--limit','0']).json.data.theorems.length,0);
 for(const tail of [['--offset','-1'],['--offset','0.5'],['--limit','101'],['--limit','NaN'],['--limit','1','--limit','2'],['--theorem','ok']])assert.equal(cli(['theorems',good,...tail]).status,2);
 assert.equal(cli(['rules',good]).status,2);
 assert.equal(cli(['rules',good,'--theorem','ok','--limit','-1']).status,2);
});

function sessionCase(name, actions, extra=[]) {
 const path=join(dir,name+'.json');writeFileSync(path,JSON.stringify(actions));
 return cli(['session',good,'--theorem','ok','--actions',path,...extra]);
}
test('failed action retains atomic view and the executed input prefix', () => {
 const prefix=[{operation:'apply_label',label:'ax'}];
 const r=sessionCase('prefix-context',[...prefix,{operation:'apply_label',label:'missing'}]);
 assert.equal(r.status,1);assert.equal(r.json.status,'error');assert.equal(r.json.data,null);
 assert.equal(r.json.session_context.phase,'action');assert.equal(r.json.session_context.action_index,1);
 assert.deepEqual(r.json.session_context.successful_actions,prefix);assert.equal(r.json.session_context.successful_action_count,1);
 assert.deepEqual(r.json.session_context.view.stack,[['|-','a']]);assert.equal(r.json.session_context.view.successful_step_count,1);
});
test('rewind counts as an executed input action but reduces the proof step count', () => {
 const actions=[{operation:'apply_label',label:'ax'},{operation:'rewind',successful_step_count:0},{operation:'apply_label',label:'missing'}];
 const r=sessionCase('rewind-context',actions);const c=r.json.session_context;
 assert.equal(r.status,1);assert.equal(c.successful_action_count,2);assert.deepEqual(c.successful_actions,actions.slice(0,2));
 assert.equal(c.view.successful_step_count,0);assert.deepEqual(c.view.stack,[]);
});
test('implicit finish and export failures identify their phase without an action index', () => {
 const unfinished=sessionCase('implicit-context',[]);assert.equal(unfinished.status,4);
 assert.equal(unfinished.json.session_context.phase,'finish');assert.equal(unfinished.json.session_context.action_index,null);
 const actions=[{operation:'apply_label',label:'ax'},{operation:'finish'}];
 const badExport=sessionCase('export-context',actions,['--export',join(dir,'conflict.mm'),'--new-label','ok']);
 assert.equal(badExport.status,2);assert.equal(badExport.json.diagnostics[0].code,'DuplicateExportLabel');
 assert.equal(badExport.json.session_context.phase,'export');assert.equal(badExport.json.session_context.action_index,null);
 assert.equal(badExport.json.session_context.successful_action_count,2);assert.equal(badExport.json.session_context.view.state,'complete');
 const io=sessionCase('export-io-context',actions,['--export',good]);assert.equal(io.status,3);
 assert.equal(io.json.session_context.phase,'export');assert.equal(io.json.session_context.view.state,'complete');
});
test('action validation reports an explicit index without executing a valid prefix', () => {
 const r=sessionCase('validation-context',[{operation:'apply_label',label:'ax'},{operation:'reset'}]);
 assert.equal(r.status,2);const c=r.json.session_context;assert.equal(c.phase,'validation');assert.equal(c.action_index,1);
 assert.equal(c.successful_action_count,0);assert.deepEqual(c.successful_actions,[]);assert.equal(c.view,null);
 const malformed=join(dir,'malformed-context.json');writeFileSync(malformed,'[');
 const bad=cli(['session',good,'--theorem','ok','--actions',malformed]);assert.equal(bad.json.session_context.phase,'validation');assert.equal(bad.json.session_context.action_index,null);
});


test('explicit finish failure identifies its input action', () => {
 const r=sessionCase('explicit-finish-context',[{operation:'finish'}]);
 assert.equal(r.status,4);assert.equal(r.json.session_context.phase,'action');assert.equal(r.json.session_context.action_index,0);
 assert.deepEqual(r.json.session_context.successful_actions,[]);assert.deepEqual(r.json.session_context.view.stack,[]);
});
test('CLI stdio routes multiple JSON lines without the one-shot command worker', () => {
 const input=[1,2].map(i=>JSON.stringify({schema_version:1,request_id:String(i),operation:'reset'})).join('\n')+'\n';
 const r=spawnSync(process.execPath,['bin/moonmetamath.mjs','stdio'],{cwd:root,encoding:'utf8',input,timeout:10000});
 assert.equal(r.status,0,r.stderr);const responses=r.stdout.trim().split('\n').map(JSON.parse);
 assert.deepEqual(responses.map(x=>x.request_id),['1','2']);assert.ok(responses.every(x=>x.status==='ok'));
});
