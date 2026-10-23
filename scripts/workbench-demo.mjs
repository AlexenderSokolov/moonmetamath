import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './common.mjs';
import {createNotebook,restoreNotebook} from '../web/notebook.mjs';
import {verify} from './oracle.mjs';
import assert from 'node:assert/strict';
const at=process.argv.indexOf('--out'),out=resolve(root,at<0?'artifacts/workbench-'+Date.now():process.argv[at+1]);mkdirSync(out,{recursive:true});
async function fresh(){const core=await import(pathToFileURL(join(root,'dist/moonmetamath-core.mjs')).href+'?workbench='+Date.now()+Math.random());let serial=0;return request=>JSON.parse(core.dispatch_json(JSON.stringify({schema_version:1,request_id:String(++serial),...request})));}
const request=await fresh();
function checked(operation,fields={}){const result=request({operation,...fields});assert.equal(result.status,'ok',JSON.stringify(result));return result;}
const bundle={entry:'demo.mm',sources:[{source_id:'demo.mm',text:'$( CC0: MoonMetamath workbench example. $) $c t a b $. $v x $. vx $f t x $. ax $a t a $. copy $a t x $. original $p t a $= ax $.'}]};
const db=checked('load',bundle).data.database_id;assert.equal(checked('verify',{database_id:db}).outcome,'valid');
const rules=checked('rules',{database_id:db,target_label:'original',query:'copy'}).data.rules;assert.equal(rules.length,1);assert.deepEqual(rules[0].conclusion,['t','x']);assert.equal(JSON.stringify(rules).includes('"proof"'),false);
const created=checked('create_goal',{database_id:db,context_label:'original',new_label:'fresh',goal:['t','a']}).data;
assert.doesNotMatch(created.sources[0].text,/original\s+\$p/);
const sid=checked('start',{database_id:created.database_id,target_label:'fresh'}).data.session_id;
checked('apply_label',{session_id:sid,label:'ax'});
const before=checked('inspect',{session_id:sid}).data.view;
const preview=checked('preview',{session_id:sid,label:'copy'});assert.equal(preview.data.view.successful_step_count,2);assert.deepEqual(checked('inspect',{session_id:sid}).data.view,before);
const saved=await createNotebook({bundle:{entry:created.entry,sources:created.sources},target_label:'fresh',actions:[{operation:'apply_label',label:'ax'}],completed:false});writeFileSync(join(out,'partial.moonmm.json'),JSON.stringify(saved,null,2));
const isolated=await fresh();const restored=await restoreNotebook(saved,isolated);assert.deepEqual(restored.view,before);
assert.equal(isolated({operation:'apply_label',session_id:restored.session_id,label:'copy'}).status,'ok');
assert.equal(isolated({operation:'finish',session_id:restored.session_id}).outcome,'valid');
const exported=isolated({operation:'export',session_id:restored.session_id,new_label:'workbench-export'});assert.equal(exported.outcome,'valid');
const file=join(out,'candidate.mm');writeFileSync(file,exported.data.text,'ascii');
let independent='not_run';if(process.argv.includes('--oracle')){const result=await verify(file,join(out,'independent-c'));assert.equal(result.status,'valid');independent=result.status;}
const result={schema_version:1,pass:true,rule_search:true,preview_atomic:true,new_goal:true,partial_restore:true,finished_after_restore:true,independent,candidate:relative(root,file)};writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
