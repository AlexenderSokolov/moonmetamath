import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coreClient } from '../../bin/host.mjs';
const ai = await import('../../bin/ai-policy.mjs').catch(e => { if(e.code==='ERR_MODULE_NOT_FOUND')return {}; throw e; });
const engine = await import('../../bin/ai-experiment.mjs').catch(e => { if(e.code==='ERR_MODULE_NOT_FOUND')return {}; throw e; });
const transport = await import('../../bin/ai-transport.mjs').catch(e => { if(e.code==='ERR_MODULE_NOT_FOUND')return {}; throw e; });
const action = label => ({operation:'apply_label',label});

test('policy observation uses an explicit projection and ignores legacy proof/source/notebook fields', () => {
  assert.equal(typeof ai.observe,'function');
  const unsafe = {goal:['|-','a'],active_hypotheses:[{label:'h',expression:['|-','a'],proof:['HYP_SENTINEL']}],stack:[],proof:['ORIGINAL_PROOF_SENTINEL'],diagnostics:[{message:'DIAGNOSTIC_SENTINEL'}],sources:[{text:'SECRET_SOURCE'}],notebook:{actions:[action('SECRET_ANSWER')]},theorems:[{label:'target',proof:['LEGACY_LIST_PROOF']}]};
  const observation = ai.observe(unsafe, {...unsafe,rules:[{label:'ax',kind:'$a',conclusion:['|-','a'],mandatory_hypotheses:[{label:'h',kind:'$e',expression:['|-','a'],proof:['NESTED_SENTINEL']}],disjoint:[],proof:['RULE_PROOF_SENTINEL']}]},[{action_index:{proof:'INDEX_SENTINEL'},code:'invalid original proof SENTINEL',message:'DIAGNOSTIC_SENTINEL'}]);
  assert.deepEqual(Object.keys(observation).sort(), ['active_hypotheses','available_rules','feedback','goal','stack']);
  assert.doesNotMatch(JSON.stringify(observation), /SENTINEL|SECRET|LEGACY|notebook|sources|proof/);
  assert.deepEqual(ai.observe(unsafe,unsafe).available_rules,[]);
});

test('response validation is exact, label allowlisted and counts the full batch before application', () => {
  assert.equal(typeof ai.validateResponse,'function');
  assert.deepEqual(ai.validateResponse({actions:[action('ax')]},new Set(['ax'])),[action('ax')]);
  for(const value of [{actions:[{...action('ax'),source:'x'}]}, {actions:[{operation:'export',label:'ax'}]}, {actions:[action('target')]}, {actions:[],reason:'x'}, {actions:Array.from({length:65},()=>action('ax'))}, {actions:[action('ax'),action('future')]}]) {
    assert.throws(()=>ai.validateResponse(value,new Set(['ax'])));
  }
});

test('actual core safe rules omit target, future, inactive and original proof while legacy list exposes it', async () => {
  assert.equal(typeof engine.openTask,'function');
  const request=await coreClient(); request({operation:'reset'});
  // The distinctive encoded proof is legal, but is neither a token nor rule label.
  const source='$c |- a $. ax $a |- a $. ${ e $e |- a $. copy $a |- a $. $} ${ inactive $e |- a $. $} target $p |- a $= ( ax copy ) ABBBBBBBBBBBBBBBBBBBBB $. future $p |- a $= ax $.';
  const task=await engine.openTask(request,{id:'leak-test',target_label:'target',bundle:{entry:'main.mm',sources:[{source_id:'main.mm',text:source}]}});
  const legacy=request({operation:'list',database_id:task.database_id});
  assert.match(JSON.stringify(legacy),/ABBBBBBBBBBBBBBBBBBBBB/);
  const observation=task.observation();
  assert.equal(observation.available_rules.some(r=>['target','future','inactive'].includes(r.label)),false);
  assert.equal(JSON.stringify(observation).includes('"proof"'),false);
  assert.equal(JSON.stringify(observation).includes('ABBBBBBBBBBBBBBBBBBBBB'),false);
  const raw=ai.observe({...task.view,proof:['DISTINCT_ORIGINAL_PROOF_SENTINEL']},legacy.data);
  assert.doesNotMatch(JSON.stringify(raw),/DISTINCT_ORIGINAL_PROOF_SENTINEL|"proof"|future|target/);
});

test('invalid model batch applies no valid prefix; two calls exhaust with honest counters', async () => {
  assert.equal(typeof engine.runModelTask,'function');
  const request=await coreClient();request({operation:'reset'});
  const task=await engine.openTask(request,{id:'budget',target_label:'target',bundle:{entry:'main.mm',sources:[{source_id:'main.mm',text:'$c |- a $. ax $a |- a $. target $p |- a $= ? $.'}]}});
  let calls=0;
  const result=await engine.runModelTask(task,async()=>{calls++;return {response:{actions:[action('ax'),action('target')]},usage:{input_tokens:3,output_tokens:2}};});
  assert.equal(calls,2);assert.equal(result.success,false);assert.equal(result.status,'budget_exhausted');
  assert.equal(result.invalid_batches,2);assert.equal(result.applied_actions,0);assert.equal(result.usage.input_tokens,6);
  assert.deepEqual(task.observation().stack,[]);
});

test('all fixed tasks are incomplete, self contained and have no original proof or fixture answers', async () => {
  assert.equal(typeof engine.loadTasks,'function');
  const tasks=await engine.loadTasks(); assert.equal(tasks.length,10);
  const request=await coreClient();request({operation:'reset'});
  for(const task of tasks){
    assert.equal(task.bundle.sources.length,1);
    const text=task.bundle.sources[0].text;
    assert.equal((text.match(/\$p/g)||[]).length,1);
    assert.match(text,/\$=\s*\?\s*\$\./);
    const opened=await engine.openTask(request,task);
    assert.equal(opened.observation().stack.length,0);
  }
});

test('actual native candidate is exported and independently verified by the official C checker', async () => {
  assert.equal(typeof engine.verifyCandidate,'function');
  const request=await coreClient();request({operation:'reset'});
  const tasks=await engine.loadTasks();
  const opened=await engine.openTask(request,tasks[0]);
  const output=await mkdtemp(join(tmpdir(),'moonmm-ai-test-'));
  const result=await engine.runModelTask(opened,async observation=>({response:{actions:[action(observation.available_rules.find(r=>r.conclusion.join(' ')===observation.goal.join(' ')).label)]},usage:{input_tokens:1,output_tokens:1}}));
  assert.equal(result.status,'candidate');
  const checked=await engine.verifyCandidate(opened,output,'candidate');
  assert.equal(checked.status,'valid',JSON.stringify(checked));
  const exported=await readFile(join(output,'candidate.mm'),'utf8');assert.doesNotMatch(exported,/\$=\s*\?/);
});

test('baseline is bounded and can complete a direct axiom without reference proofs', async () => {
  assert.equal(typeof engine.runBaseline,'function');
  const request=await coreClient();request({operation:'reset'});
  const opened=await engine.openTask(request,(await engine.loadTasks())[0]);
  const result=await engine.runBaseline(opened,{max_actions:40,max_depth:6,timeout_ms:1000});
  assert.equal(result.status,'candidate');assert.ok(result.attempted_actions<=40);
});

test('Codex transport specifies isolated cwd, exact tool disabling and strips credential variables', () => {
  assert.equal(typeof transport.codexInvocation,'function');
  const call=transport.codexInvocation({cli:'C:/fake/codex.js',directory:'C:/clean-temp',env:{PATH:'test',OPENAI_API_KEY:'SECRET',OPENAI_BASE_URL:'https://secret.invalid',SMILECODEX_API_KEY:'SECRET',OTHER_TOKEN:'SECRET'}});
  assert.equal(call.command,process.execPath);assert.equal(call.options.cwd,'C:/clean-temp');
  assert.deepEqual(call.options.env,{PATH:'test'});
  for(const feature of ['shell_tool','apps','plugins','browser_use','computer_use','multi_agent','view_image','workspace_dependencies'])assert.ok(call.args.some((arg,i)=>arg==='--disable'&&call.args[i+1]===feature));
  for(const flag of ['--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check'])assert.ok(call.args.includes(flag));
  assert.ok(call.args.includes('web_search="disabled"'));assert.ok(call.args.includes('features.skip_host_skill_discovery=true'));
  assert.equal(call.args.includes('--sandbox'),true);assert.equal(call.args[call.args.indexOf('--sandbox')+1],'read-only');
});

test('Codex event parser requires a completed turn and rejects any tool or execution event', () => {
  const message={type:'item.completed',item:{type:'agent_message',text:'{"actions":[]}'}};
  const complete={type:'turn.completed',usage:{input_tokens:9,output_tokens:2}};
  assert.deepEqual(transport.parseCodexEvents([message,complete]).response,{actions:[]});
  assert.throws(()=>transport.parseCodexEvents([message]));
  for(const type of ['command_execution','mcp_tool_call','web_search','file_change','collab_tool_call','unknown'])assert.throws(()=>transport.parseCodexEvents([{type:'item.started',item:{type}},message,complete]));
});

test('actual spawned test transport sees only minimal clean temp and receives no sources', async () => {
  const directory=await mkdtemp(join(tmpdir(),'moonmm-transport-test-'));
  const fake=join(directory,'fake-cli.mjs');
  await writeFile(fake,`import {readdirSync} from 'node:fs';let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{const p=JSON.parse(input);if(readdirSync(process.cwd()).sort().join(',')!=='AGENTS.md,schema.json')process.exit(3);if(JSON.stringify(p).includes('SOURCE_SENTINEL')||process.env.OPENAI_API_KEY)process.exit(4);console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({actions:[]})}}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:3,output_tokens:2}}));});`);
  const policy=transport.codexPolicy({cli:fake,env:{...process.env,OPENAI_API_KEY:'SOURCE_SENTINEL'}});
  const result=await policy(ai.observe({goal:['|-','a'],active_hypotheses:[],stack:[],sources:[{text:'SOURCE_SENTINEL'}]},{}));
  assert.deepEqual(result.response,{actions:[]});assert.equal(result.provenance.backend_model,'not_exposed');
  assert.equal((await readdir(directory)).length,1);
});

test('model task deadline aborts policy once and never retries a timeout', async () => {
  const request=await coreClient();request({operation:'reset'});
  const opened=await engine.openTask(request,(await engine.loadTasks())[0]);
  let calls=0,aborted=false;
  const result=await engine.runModelTask(opened,async(_observation,{signal})=>{calls++;signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});},{call_timeout_ms:10,task_timeout_ms:20});
  assert.equal(result.status,'timeout');assert.equal(calls,1);assert.equal(aborted,true);assert.equal(result.applied_actions,0);
});

test('usage completeness requires valid input and output counts while preserving every legal counter', async () => {
  const task={observation:()=>({available_rules:[]}),view:{goal:['x'],stack:[]}};
  const cases=[
    {usage:undefined,complete:false,input:0,output:0},
    {usage:null,complete:false,input:0,output:0},
    {usage:{},complete:false,input:0,output:0},
    {usage:{input_tokens:7},complete:false,input:7,output:0},
    {usage:{output_tokens:3},complete:false,input:0,output:3},
    ...[-1,NaN,Infinity,1.5,'4',true,{},[],Number.MAX_SAFE_INTEGER+1].flatMap(invalid=>[
      {usage:{input_tokens:invalid,output_tokens:3,cached_input_tokens:2},complete:false,input:0,output:3,cached:2},
      {usage:{input_tokens:7,output_tokens:invalid,reasoning_output_tokens:1},complete:false,input:7,output:0,reasoning:1},
    ]),
    {usage:{input_tokens:0,output_tokens:0},complete:true,input:0,output:0},
    {usage:{input_tokens:7,output_tokens:3,cached_input_tokens:2,reasoning_output_tokens:1},complete:true,input:7,output:3,cached:2,reasoning:1},
    {usage:{input_tokens:7,output_tokens:3,cached_input_tokens:-1,reasoning_output_tokens:'1'},complete:true,input:7,output:3},
  ];
  for(const row of cases){
    const result=await engine.runModelTask(task,async()=>({response:{actions:[]},usage:row.usage}),{max_calls:1});
    assert.equal(result.usage_complete,row.complete,`usage=${String(row.usage)}`);
    assert.equal(result.usage.input_tokens,row.input);assert.equal(result.usage.output_tokens,row.output);
    assert.equal(result.usage.cached_input_tokens,row.cached??0);assert.equal(result.usage.reasoning_output_tokens,row.reasoning??0);
  }
});

test('production Codex parser preserves missing or partial usage as incomplete accounting', () => {
  const message={type:'item.completed',item:{type:'agent_message',text:'{"actions":[]}'}};
  const missing=transport.parseCodexEvents([message,{type:'turn.completed'}]);
  assert.equal(missing.usage,undefined);assert.equal(missing.usage_complete,false);
  for(const usage of [{input_tokens:5},{input_tokens:5,output_tokens:-1},{input_tokens:'5',output_tokens:1}]){
    const result=transport.parseCodexEvents([message,{type:'turn.completed',usage}]);
    assert.deepEqual(result.usage,usage);assert.equal(result.usage_complete,false);
  }
  const valid=transport.parseCodexEvents([message,{type:'turn.completed',usage:{input_tokens:5,output_tokens:0}}]);
  assert.equal(valid.usage_complete,true);
});
