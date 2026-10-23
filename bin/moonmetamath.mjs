#!/usr/bin/env node
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {readBundle,coreClient,exitFor,root,HostError} from './host.mjs';
import {Worker,isMainThread,workerData} from 'node:worker_threads';
const args=isMainThread?process.argv.slice(2):workerData.args;
const version=existsSync(join(root,'dist','build.json'))?JSON.parse(readFileSync(join(root,'dist','build.json'),'utf8')).version:readFileSync(join(root,'moon.mod'),'utf8').match(/version\s*=\s*"([^"]+)"/)[1];
function help(){console.log(`MoonMetamath ${version}\nUsage:\n  moonmetamath verify FILE [--format json|text] [--timeout-ms N]\n  moonmetamath list FILE [--format json]\n  moonmetamath replay FILE --theorem LABEL\n  moonmetamath session FILE --theorem LABEL --actions ACTIONS.json --export OUT.mm\n  moonmetamath --version\nFiles are read-only. Session export never overwrites existing files.\nCLI workers have a 512 MiB heap and default 120000 ms deadline.`);}
function validateActions(value){
 const object=item=>item!==null&&typeof item==='object'&&!Array.isArray(item);
 const exactFields=(item,fields)=>Object.keys(item).length===fields.length&&Object.keys(item).every(key=>fields.includes(key));
 let actions;
 if(Array.isArray(value))actions=value;
 else{
  if(!object(value)||!exactFields(value,['schema_version','actions'])||value.schema_version!==1||!Array.isArray(value.actions))throw new Error('Actions wrapper must contain only schema_version:1 and an actions array.');
  actions=value.actions;
 }
 // Validate the complete file before starting a session or applying any prefix.
 return actions.map((action,index)=>{
  const invalid=message=>{throw new Error(`Invalid action at index ${index}: ${message}`);};
  if(!object(action))invalid('expected an action object.');
  if(action.operation==='apply_label'){
   if(!exactFields(action,['operation','label'])||typeof action.label!=='string')invalid('apply_label requires only operation and a string label.');
   return {operation:'apply_label',label:action.label};
  }
  if(action.operation==='rewind'){
   if(!exactFields(action,['operation','successful_step_count'])||!Number.isSafeInteger(action.successful_step_count)||action.successful_step_count<0)invalid('rewind requires only operation and a nonnegative safe integer successful_step_count.');
   return {operation:'rewind',successful_step_count:action.successful_step_count};
  }
  if(action.operation==='finish'){
   if(!exactFields(action,['operation']))invalid('finish permits only operation.');
   return {operation:'finish'};
  }
  invalid('operation must be apply_label, rewind or finish.');
 });
}
if(isMainThread&&args.length&&!args.includes('--help')&&!args.includes('--version')){
 const timeoutAt=args.indexOf('--timeout-ms');
 const timeout=timeoutAt<0?120000:Number(args[timeoutAt+1]);
 if(!Number.isInteger(timeout)||timeout<1||timeout>300000){console.log(JSON.stringify({schema_version:1,operation:args[0],status:'error',outcome:null,data:null,diagnostics:[{code:'INPUT_ERROR',message:'--timeout-ms must be 1..300000'}]}));process.exitCode=2;}
 else{
  const worker=new Worker(new URL(import.meta.url),{workerData:{args},resourceLimits:{maxOldGenerationSizeMb:512}});
  let stopped=false;
  function stop(outcome,message){if(stopped)return;stopped=true;worker.terminate();console.log(JSON.stringify({schema_version:1,operation:args[0],status:'ok',outcome,data:{complete:false},diagnostics:[{code:'ResourceLimit',message}]}));process.exitCode=5;}
  const timer=setTimeout(()=>stop('resource_limit','CLI worker exceeded its deadline.'),timeout);
  process.once('SIGINT',()=>stop('cancelled','CLI worker was cancelled.'));
  worker.on('error',error=>{
   if(error.code==='ERR_WORKER_OUT_OF_MEMORY'){stop('resource_limit',error.message);return;}
   if(stopped)return;stopped=true;clearTimeout(timer);console.log(JSON.stringify({schema_version:1,operation:args[0],status:'error',outcome:null,data:null,diagnostics:[{code:'HOST_IO',message:error.message}]}));process.exitCode=3;
  });
  worker.on('exit',code=>{clearTimeout(timer);if(!stopped)process.exitCode=code;});
 }
}else{
try{
 if(args.includes('--help')||args.length===0){help();}
 else if(args.includes('--version'))console.log(`MoonMetamath ${version}`);
 else{
  const [operation,file,...rest]=args;
  if(!['verify','list','replay','session'].includes(operation)||!file||file.startsWith('--'))throw new Error('Expected a command and FILE. Use --help.');
  const opts={};for(let i=0;i<rest.length;i+=2){if(!['--format','--theorem','--actions','--export','--root','--timeout-ms'].includes(rest[i])||!rest[i+1]||rest[i+1].startsWith('--'))throw new Error('Unknown or missing option: '+rest[i]);opts[rest[i]]=rest[i+1];}
  if(opts['--format']&&!['json','text'].includes(opts['--format']))throw new Error('Format must be json or text.');
  const client=await coreClient();
  let result=client({operation:'load',...readBundle(file,opts['--root'])});
  if(result.status!=='error'){
   const database_id=result.data.database_id;
   if(operation==='list')result=client({operation:'list',database_id});
   else{
    result=client({operation:'verify',database_id});
    if(result.outcome==='valid'&&operation!=='verify'){
     if(!opts['--theorem'])throw new Error('--theorem LABEL is required.');
     if(operation==='replay')result=client({operation:'replay',database_id,target_label:opts['--theorem']});
     else{
      if(!opts['--actions'])throw new Error('--actions ACTIONS.json is required.');
      const actionFile=JSON.parse(readFileSync(opts['--actions'],'utf8'));
      const actions=validateActions(actionFile);
      result=client({operation:'start',database_id,target_label:opts['--theorem']});
      const session_id=result.data?.session_id;
      if(session_id){for(const action of actions){result=client({...action,session_id});if(result.status==='error')break;}}
      if(session_id&&result.status!=='error')result=client({operation:'finish',session_id});
      if(result.status!=='error'&&opts['--export']){
       result=client({operation:'export',session_id,new_label:'moonmm-session-1'});
       if(result.status!=='error'){
        const destination=resolve(opts['--export']);
        if(existsSync(destination)||destination===resolve(file))throw new HostError('Refuse to overwrite export destination.');
        writeFileSync(destination,result.data.text,{flag:'wx',encoding:'ascii'});
        result.data.export_path=destination;
       }
      }
     }
    }
   }
  }
  console.log(opts['--format']==='text'?`${result.operation}: ${result.outcome??result.status}\n${JSON.stringify(result.data,null,2)}\n${result.diagnostics.map(d=>d.message).join('\n')}`:JSON.stringify(result));
  process.exitCode=exitFor(result);
 }
}catch(error){
 console.log(JSON.stringify({schema_version:1,operation:args[0]??'help',status:'error',outcome:null,data:null,diagnostics:[{code:error instanceof HostError?'HOST_IO':'INPUT_ERROR',message:error.message}]}));
 process.exitCode=error instanceof HostError?3:2;
}
}
