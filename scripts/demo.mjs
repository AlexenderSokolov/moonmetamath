import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {root} from './common.mjs';
import {readBundle,coreClient} from '../bin/host.mjs';
import {verify as oracleVerify} from './oracle.mjs';
const args=process.argv.slice(2),outAt=args.indexOf('--out');
const out=resolve(root,outAt<0?'artifacts/demo-'+Date.now():args[outAt+1]);mkdirSync(out,{recursive:true});
const client=await coreClient();const scenarios=[];
function ok(r){if(r.status!=='ok')throw new Error(JSON.stringify(r));return r;}
function load(name){client({operation:'reset'});return ok(client({operation:'load',...readBundle(join(root,'tests/fixtures/upstream/set-mm',name+'.mm'))})).data.database_id;}
let id=load('demo0');ok(client({operation:'verify',database_id:id}));
const replay=ok(client({operation:'replay',database_id:id,target_label:'th1'}));
if(replay.outcome!=='valid'||replay.data.events.length!==34)throw new Error('demo0 replay did not execute 34 checked steps');
scenarios.push({name:'learn/replay',pass:true,mode:'existing-proof replay; no model call',steps:replay.data.events.length});
const sid=ok(client({operation:'start',database_id:id,target_label:'th1'})).data.session_id;
const before=ok(client({operation:'inspect',session_id:sid})).data;
if(client({operation:'apply_label',session_id:sid,label:'unknown-label'}).status!=='error')throw new Error('Bad step accepted');
if(JSON.stringify(ok(client({operation:'inspect',session_id:sid})).data)!==JSON.stringify(before))throw new Error('Bad step changed state');
const theorem=ok(client({operation:'list',database_id:id})).data.theorems.find(t=>t.label==='th1');
const actions=theorem.proof.map(label=>({operation:'apply_label',label}));
for(const action of actions)ok(client({...action,session_id:sid}));
ok(client({operation:'finish',session_id:sid}));
const exported=ok(client({operation:'export',session_id:sid,new_label:'moonmm-demo-th1'}));
const candidate=join(out,'candidate.mm');writeFileSync(candidate,exported.data.text,'ascii');
writeFileSync(join(out,'actions.json'),JSON.stringify({schema_version:1,actions:[...actions,{operation:'finish'}]},null,2)+'\n');
let independent={status:'not_run'};
if(args.includes('--oracle')){independent=await oracleVerify(candidate,join(out,'candidate-oracle'));if(independent.status!=='valid')throw new Error('Independent checker rejected exported candidate');}
scenarios.push({name:'programmatic construction/export',pass:true,steps:actions.length,mode:'deterministic external actions; no model claim',independent:independent.status,candidate:relative(root,candidate)});
id=load('hol');const hol=ok(client({operation:'verify',database_id:id}));if(hol.outcome!=='valid'||hol.data.verified_count!==151)throw new Error('Fixed hol.mm verification differs from expected151');
scenarios.push({name:'batch verification',pass:true,fixture:'hol.mm',verified_count:hol.data.verified_count});
const result={schema_version:1,pass:true,scenarios};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
