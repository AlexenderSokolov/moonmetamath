import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { POLICY_INSTRUCTIONS, RESPONSE_SCHEMA } from './ai-policy.mjs';

export function codexInvocation({cli, directory, model='gpt-6.1-sol',env=process.env}) {
  if(!cli)throw new Error('Pass --codex-js with the installed official Codex CLI JavaScript entry');
  const cleanEnv={...env};
  for(const key of Object.keys(cleanEnv))if(/(?:API_KEY|TOKEN|SECRET|PASSWORD)$/i.test(key)||['OPENAI_BASE_URL','OPENAI_API_BASE','OPENAI_ORG_ID','OPENAI_ORGANIZATION','OPENAI_PROJECT_ID'].includes(key))delete cleanEnv[key];
  return {command:process.execPath,args:[resolve(cli),'exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','--sandbox','read-only',
    ...['shell_tool','apps','plugins','browser_use','computer_use','multi_agent','view_image','workspace_dependencies'].flatMap(feature=>['--disable',feature]),
    '-c','web_search="disabled"','-c','features.skip_host_skill_discovery=true','-c','model_reasoning_effort="low"','--model',model,
    '--output-schema',join(directory,'schema.json'),'--json','--cd',directory,'-'],options:{cwd:directory,env:cleanEnv,windowsHide:true,stdio:['pipe','pipe','pipe']}};
}

export function parseCodexEvents(events) {
  let response,usage,completed=false;
  const warnings=[];
  for(const event of events){
    if(event.type==='item.started'||event.type==='item.updated'||event.type==='item.completed'){
      const item=event.item;
      if(!['agent_message','reasoning','error'].includes(item?.type))throw new Error('Forbidden model tool or execution item');
      if(item.type==='agent_message'&&event.type==='item.completed'){
        if(response!==undefined)throw new Error('Multiple policy responses');
        response=JSON.parse(item.text);
      }
      if(item.type==='error')warnings.push(String(item.message??'CLI warning'));
    }else if(event.type==='turn.completed'){completed=true;usage=event.usage;}
    else if(event.type==='turn.failed'||event.type==='error')throw new Error('Codex turn failed');
    else if(!['thread.started','turn.started'].includes(event.type))throw new Error('Unexpected Codex event');
  }
  if(!completed||response===undefined)throw new Error('No completed structured model response');
  return {response,usage:usage??{},warnings};
}

// Only the sanitized observation crosses stdin. Clean temp contains policy + schema,
// never this repository, source text, notebooks, expected answers or credentials.
export function codexPolicy({cli,model='gpt-6.1-sol',env=process.env}) {
  const secrets=Object.entries(env).filter(([key,value])=>/(API_KEY|TOKEN|SECRET|PASSWORD)$/i.test(key)&&value&&value.length>=6).map(([,value])=>value);
  const redact=text=>secrets.reduce((s,value)=>s.split(value).join('[REDACTED]'),String(text)).replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/g,'[REDACTED_URL]');
  return async (observation,{signal,timeout_ms=120000}={})=>{
    const started=Date.now(),directory=await mkdtemp(join(tmpdir(),'moonmm-policy-'));
    await writeFile(join(directory,'schema.json'),JSON.stringify(RESPONSE_SCHEMA));
    await writeFile(join(directory,'AGENTS.md'),'Return the structured proof actions requested on stdin. Do not use tools or access files.\n');
    const invocation=codexInvocation({cli,directory,model,env});
    const run=await new Promise((resolveRun,reject)=>{
      const child=spawn(invocation.command,invocation.args,invocation.options);
      let stdout='',stderr='',pending='',stopped=false,reason;
      const stop=message=>{
        if(stopped)return;stopped=true;reason=message;
        if(process.platform==='win32'&&child.pid)spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        else child.kill('SIGTERM');
      };
      const timer=setTimeout(()=>stop('Model call timed out'),timeout_ms);
      const abort=()=>stop('Model call aborted'); signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted)abort();
      child.stdout.on('data',chunk=>{
        stdout+=chunk.toString();
        if(stdout.length>2*1024*1024)stop('Model output exceeded 2 MiB');
        // Abort immediately if a completed or announced tool item is observed.
        pending+=chunk.toString();const lines=pending.split(/\r?\n/);pending=lines.pop();
        for(const line of lines){
          try{const e=JSON.parse(line);if(e.type?.startsWith('item.')&&!['agent_message','reasoning','error'].includes(e.item?.type))stop('Forbidden model tool or execution item');}catch{}
        }
      });
      child.stderr.on('data',chunk=>{stderr+=chunk.toString();if(stderr.length>2*1024*1024)stop('Model stderr exceeded 2 MiB');});
      child.on('error',error=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new Error(redact(error.message)));});
      child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolveRun({code,stdout,stderr,reason});});
      child.stdin.on('error',()=>{});
      child.stdin.end(JSON.stringify({instructions:POLICY_INSTRUCTIONS,observation}));
    });
    const warnings=redact(run.stderr);
    if(run.reason||run.code!==0){const error=new Error(redact(run.reason??`Codex exited ${run.code}`));error.warnings=warnings;error.duration_ms=Date.now()-started;throw error;}
    let parsed;
    try{parsed=parseCodexEvents(run.stdout.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)));}
    catch(error){error.warnings=warnings;throw error;}
    return {...parsed,warnings:[...parsed.warnings.map(redact),...(warnings?[warnings]:[])],duration_ms:Date.now()-started,
      provenance:{transport:'official-codex-cli-chatgpt-auth',requested_model:model,reasoning_effort:'low',backend_model:'not_exposed',tools:'disabled',ephemeral:true}};
  };
}
