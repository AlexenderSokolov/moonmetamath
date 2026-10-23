#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { coreClient } from './host.mjs';
import { observe, validateResponse, LIMITS, POLICY_INSTRUCTIONS } from './ai-policy.mjs';
import { codexPolicy } from './ai-transport.mjs';
import { verify } from '../scripts/oracle.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const reached=view=>view.stack.length===1&&equal(view.stack[0],view.goal);
const checked=result=>{if(result.status==='error')throw new Error(`Native operation ${result.operation} rejected: ${result.diagnostics?.[0]?.code??'Unknown'}`);return result;};

export async function loadTasks(){
  const base=join(ROOT,'examples','ai'),manifest=JSON.parse(await readFile(join(base,'tasks.json'),'utf8'));
  if(manifest.schema_version!==1||manifest.tasks.length!==10)throw new Error('Expected the fixed ten-task manifest');
  return Promise.all(manifest.tasks.map(async task=>{
    if(!/^\d\d-[a-z-]+\.mm$/.test(task.file))throw new Error('Invalid fixed task path');
    const text=await readFile(join(base,task.file),'utf8');
    return {...task,source_sha256:createHash('sha256').update(text).digest('hex'),bundle:{entry:task.file,sources:[{source_id:task.file,text}]}};
  }));
}

// The closure owns native handles. Only observation() output goes to a policy.
export async function openTask(request,task){
  const loaded=checked(await request({operation:'load',...task.bundle}));
  const database_id=loaded.data.database_id;
  const report=checked(await request({operation:'verify',database_id}));
  if(!['valid','incomplete'].includes(report.outcome))throw new Error('Task prefix is not verified');
  const started=checked(await request({operation:'start',database_id,target_label:task.target_label}));
  const session_id=started.data.session_id;
  let view=started.data.view;
  const rules=[];
  for(let offset=0;;offset+=100){
    const page=checked(await request({operation:'rules',database_id,target_label:task.target_label,offset,limit:100}));
    rules.push(...page.data.rules);
    if(offset+page.data.rules.length>=page.data.total)break;
    if(page.data.rules.length===0||rules.length>1000)throw new Error('Rule collection exceeded fixed task bounds');
  }
  const operation=async fields=>{
    const result=await request({...fields,session_id});
    if(result.data?.view)view=result.data.view;
    return result;
  };
  return {database_id,get view(){return view;},observation:feedback=>observe(view,{rules},feedback),
    apply:label=>operation({operation:'apply_label',label}),rewind:count=>operation({operation:'rewind',successful_step_count:count}),
    finish:()=>operation({operation:'finish'}),export:label=>operation({operation:'export',new_label:label})};
}

function budgets(options={}){
  const result={...LIMITS,...options};
  for(const key of Object.keys(LIMITS))if(!Number.isSafeInteger(result[key])||result[key]<1||result[key]>LIMITS[key])throw new Error(`Budget ${key} must be 1..${LIMITS[key]}`);
  return result;
}

export async function runModelTask(task,policy,options={}){
  const limits=budgets(options),started=Date.now(),calls=[],usage={input_tokens:0,cached_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
  let invalid_batches=0,invalid_actions=0,rejected_actions=0,attempted_actions=0,applied_actions=0,feedback=[],status='budget_exhausted';
  for(let call=0;call<limits.max_calls;call++){
    const remaining=limits.task_timeout_ms-(Date.now()-started);if(remaining<=0){status='timeout';break;}
    const observation=task.observation(feedback),record={call:call+1,observation}; calls.push(record);
    const controller=new AbortController();let timer;
    const callStarted=Date.now();
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>policy(observation,{signal:controller.signal,timeout_ms:Math.min(limits.call_timeout_ms,remaining)})),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=new Error('Model call deadline');e.code='TIMEOUT';reject(e);},Math.min(limits.call_timeout_ms,remaining));}),
      ]);
      record.response=result.response;record.usage=result.usage??{};record.provenance=result.provenance??{transport:'injected-test-policy'};record.warnings=result.warnings??[];
      for(const key of Object.keys(usage))if(Number.isFinite(result.usage?.[key])&&result.usage[key]>=0)usage[key]+=result.usage[key];
      let actions;
      try{
        actions=validateResponse(result.response,new Set(observation.available_rules.map(r=>r.label)));
        if(actions.length>limits.max_actions_per_call)throw new Error('Configured action budget exceeded');
      }catch{
        invalid_batches++;
        if(Array.isArray(result.response?.actions)){
          rejected_actions+=result.response.actions.length;
          invalid_actions+=result.response.actions.filter(action=>{try{validateResponse({actions:[action]},new Set(observation.available_rules.map(r=>r.label)));return false;}catch{return true;}}).length;
        }
        record.validation='invalid_batch';feedback=[{action_index:0,code:'InvalidBatch'}];continue;
      }
      record.execution=[];feedback=[];
      for(let index=0;index<actions.length;index++){
        if(Date.now()-started>=limits.task_timeout_ms){status='timeout';break;}
        const action=actions[index];attempted_actions++;
        const result=await task.apply(action.label);
        if(result.status==='error'){
          invalid_actions++;
          const code=result.diagnostics?.[0]?.code??'ExecutionError';
          feedback=[{action_index:index,code}];record.execution.push({action_index:index,status:'invalid',code:task.observation(feedback).feedback[0].code});break;
        }
        applied_actions++;record.execution.push({action_index:index,status:'applied'});
        if(reached(task.view)){
          const finished=await task.finish();
          if(finished.status!=='error'){status='candidate';break;}
        }
      }
      if(status==='candidate'||status==='timeout')break;
    }catch(error){
      record.error=error.code==='TIMEOUT'?'Model call deadline':String(error.message);record.warnings=error.warnings??[];
      status=error.code==='TIMEOUT'?'timeout':'transport_error';break;
    }finally{clearTimeout(timer);record.duration_ms=Date.now()-callStarted;}
  }
  return {success:false,status,calls,invalid_batches,invalid_actions,rejected_actions,attempted_actions,applied_actions,usage,usage_complete:calls.every(c=>c.usage!==undefined),duration_ms:Date.now()-started,
    budgets:limits,monetary_cost:{status:'unknown',reason:'ChatGPT subscription transport does not expose per-request monetary cost'}};
}

// Breadth-first stack search uses the same observations/rule labels. Core alone
// decides transitions. Replaying a queued path counts towards native action cap.
export async function runBaseline(task,{max_actions=5000,max_depth=12,timeout_ms=240000}={}){
  if(!Number.isSafeInteger(max_actions)||max_actions<1||max_actions>5000||!Number.isSafeInteger(max_depth)||max_depth<1||max_depth>64||!Number.isSafeInteger(timeout_ms)||timeout_ms<1||timeout_ms>240000)throw new Error('Invalid baseline budget');
  const started=Date.now(),observation=task.observation(),labels=observation.available_rules.map(r=>r.label),queue=[[]],seen=new Set(['[]']);
  let attempted_actions=0,invalid_actions=0,expanded=0;
  const stop=()=>attempted_actions>=max_actions||Date.now()-started>=timeout_ms;
  for(let cursor=0;cursor<queue.length&&!stop();cursor++){
    const path=queue[cursor];if(path.length>=max_depth)continue;expanded++;
    checked(await task.rewind(0));
    for(const label of path){if(stop())break;attempted_actions++;checked(await task.apply(label));}
    if(stop())break;
    for(const label of labels){
      if(stop())break;
      checked(await task.rewind(path.length));attempted_actions++;
      const result=await task.apply(label);
      if(result.status==='error'){invalid_actions++;continue;}
      const candidate=[...path,label];
      if(reached(task.view)&&((await task.finish()).status!=='error'))return {success:false,status:'candidate',actions:candidate,attempted_actions,invalid_actions,expanded,duration_ms:Date.now()-started,budgets:{max_actions,max_depth,timeout_ms}};
      // Fixed explicit search pruning; no answer/expected-proof access.
      const stack=task.observation().stack,key=JSON.stringify(stack);
      if(stack.length<=6&&stack.every(expr=>expr.length<=64)&&!seen.has(key)){seen.add(key);queue.push(candidate);}
    }
  }
  return {success:false,status:Date.now()-started>=timeout_ms?'timeout':'budget_exhausted',attempted_actions,invalid_actions,expanded,queued:queue.length,duration_ms:Date.now()-started,budgets:{max_actions,max_depth,timeout_ms}};
}

export async function verifyCandidate(task,directory,name){
  if(!/^[a-z0-9-]+$/.test(name))throw new Error('Invalid candidate name');
  const exported=checked(await task.export(`ai-${name}`));
  await mkdir(directory,{recursive:true});
  const file=join(directory,`${name}.mm`);
  await writeFile(file,exported.data.text,{flag:'wx'});
  return verify(file,join(directory,`${name}-oracle`));
}

export async function runExperiment({out,policy,baselineOnly=false,onProgress=()=>{}}){
  const tasks=await loadTasks();
  await mkdir(out,{recursive:true});
  const declaration={schema_version:1,started_at:new Date().toISOString(),task_manifest:'examples/ai/tasks.json',tasks:tasks.map(({id,file,target_label,category,source_sha256})=>({id,file,target_label,category,source_sha256})),
    policy_instructions:POLICY_INSTRUCTIONS,model_budgets:LIMITS,baseline_budgets:{max_actions:5000,max_depth:12,timeout_ms:240000,max_stack:6,max_expression_tokens:64},baseline_only:baselineOnly};
  await writeFile(join(out,'declaration.json'),JSON.stringify(declaration,null,2)+'\n',{flag:'wx'});
  const request=await coreClient(),results=[];
  for(const task of tasks){
    const directory=join(out,task.id);await mkdir(directory,{recursive:true});
    const entry={id:task.id,category:task.category,source_sha256:task.source_sha256};
    for(const kind of baselineOnly?['baseline']:['baseline','model']){
      onProgress({task:task.id,kind,state:'started'});
      try{
        request({operation:'reset'});const opened=await openTask(request,task);
        const result=kind==='baseline'?await runBaseline(opened):await runModelTask(opened,policy);
        if(result.status==='candidate'){
          result.oracle=await verifyCandidate(opened,directory,kind);
          result.success=result.oracle.status==='valid';result.status=result.success?'verified':'oracle_failed';
        }
        entry[kind]=result;
      }catch(error){entry[kind]={success:false,status:'host_error',error:String(error.message)};}
      await writeFile(join(directory,`${kind}.json`),JSON.stringify(entry[kind],null,2)+'\n',{flag:'wx'});
      onProgress({task:task.id,kind,state:entry[kind].status});
    }
    results.push(entry);
    await writeFile(join(out,'results.json'),JSON.stringify({declaration,results},null,2)+'\n');
  }
  const summary={declared_tasks:tasks.length,completed_tasks:results.length,baseline_only:baselineOnly,results:{},finished_at:new Date().toISOString()};
  for(const kind of baselineOnly?['baseline']:['baseline','model']){
    const rows=results.map(r=>r[kind]);
    summary.results[kind]={verified_successes:rows.filter(r=>r.success).length,failures:rows.filter(r=>!r.success).length,
      invalid_actions:rows.reduce((s,r)=>s+(r.invalid_actions??0),0),budget_exhaustions:rows.filter(r=>r.status==='budget_exhausted').length,timeouts:rows.filter(r=>r.status==='timeout').length,
      duration_ms:rows.reduce((s,r)=>s+(r.duration_ms??0),0),input_tokens:rows.reduce((s,r)=>s+(r.usage?.input_tokens??0),0),output_tokens:rows.reduce((s,r)=>s+(r.usage?.output_tokens??0),0),
      usage_complete:kind==='model'?rows.every(r=>r.usage_complete===true):true,
      monetary_cost:kind==='model'?'unknown; subscription transport does not expose request cost':'no model calls'};
  }
  await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  return summary;
}

async function main(){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--baseline-only'){options.baselineOnly=true;continue;}
    if(!['--out','--codex-js','--model'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Usage: node bin/ai-experiment.mjs --out NEW_DIRECTORY --codex-js CLI_JS [--model MODEL] [--baseline-only]');
    options[args[i].slice(2)]=args[++i];
  }
  if(!options.out)throw new Error('--out is required (fresh output directory)');
  const policy=options.baselineOnly?undefined:codexPolicy({cli:options['codex-js'],model:options.model});
  const summary=await runExperiment({out:resolve(options.out),policy,baselineOnly:options.baselineOnly,onProgress:value=>console.log(JSON.stringify(value))});
  console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
