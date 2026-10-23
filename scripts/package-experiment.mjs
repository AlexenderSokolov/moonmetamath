// Publish only the fixed experiment's math inputs/actions/results, never local
// credential environments, raw CLI stderr, notebook files or machine paths.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {run,root} from './common.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const input=resolve(root,option('--input','artifacts/ai-2026-10-23')),out=resolve(root,option('--out','artifacts/ai-public-2026-10-24'));mkdirSync(out,{recursive:true});
const original=JSON.parse(readFileSync(join(input,'results.json'),'utf8')),summary=JSON.parse(readFileSync(join(input,'summary.json'),'utf8'));
if(original.results.length!==10||summary.declared_tasks!==10||summary.completed_tasks!==10)throw new Error('Refuse incomplete fixed-task publication');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function oracle(value){return value?{engine:value.engine,source:value.source,inputSha256:value.inputSha256,status:value.status,evidence:value.evidence}:null;}
const results=[];
for(const row of original.results){
 if(!/^\d\d-[a-z-]+$/.test(row.id))throw new Error('Unexpected task id');
 const result={id:row.id,category:row.category,source_sha256:row.source_sha256};
 for(const kind of ['baseline','model']){
  const r=row[kind];
  result[kind]={success:r.success,status:r.status,actions:r.actions,invalid_batches:r.invalid_batches,invalid_actions:r.invalid_actions,rejected_actions:r.rejected_actions,attempted_actions:r.attempted_actions,applied_actions:r.applied_actions,expanded:r.expanded,usage:r.usage,usage_complete:r.usage_complete,duration_ms:r.duration_ms,budgets:r.budgets,monetary_cost:r.monetary_cost,oracle:oracle(r.oracle)};
  if(r.calls)result[kind].calls=r.calls.map(c=>({call:c.call,observation:c.observation,response:c.response,usage:c.usage,usage_complete:c.usage_complete,provenance:c.provenance,validation:c.validation,execution:c.execution,duration_ms:c.duration_ms,warning_count:c.warnings?.length??0,error:c.error?'transport_error (raw local diagnostic omitted)':undefined}));
  if(r.success){const file=join(input,row.id,kind+'.mm'),bytes=readFileSync(file);if(r.oracle?.status!=='valid'||hash(bytes)!==r.oracle.inputSha256)throw new Error('Candidate differs from independently checked bytes');mkdirSync(join(out,row.id),{recursive:true});copyFileSync(file,join(out,row.id,kind+'.mm'));copyFileSync(join(input,row.id,kind+'-oracle/stdout.txt'),join(out,row.id,kind+'-oracle-stdout.txt'));}
 }
 results.push(result);
}
const report={schema_version:1,experiment_source:'8227909',declaration:original.declaration,summary,results,disclosure:{task_set:'ten small self-authored incomplete exercises; some inference rules supplied as axioms',original_reference_proofs:'none supplied',backend_model:'not exposed by CLI; requested model and transport recorded',monetary_cost:'unknown for subscription transport',raw_warnings:'retained locally, omitted from public bundle because they include machine paths',interpretation:'functional integration evidence; not a standardized benchmark or superiority/new-mathematics claim'}};
writeFileSync(join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
copyFileSync(join(root,'examples/ai/tasks.json'),join(out,'tasks.json'));
copyFileSync(join(root,'LICENSE'),join(out,'LICENSE'));
for(const task of original.declaration.tasks){const bytes=readFileSync(join(root,'examples/ai',task.file));if(hash(bytes)!==task.source_sha256)throw new Error('Declared task input changed');copyFileSync(join(root,'examples/ai',task.file),join(out,task.file));}
writeFileSync(join(out,'README.txt'),'MoonMetamath first bounded real-model experiment. Each successful .mm file was independently checked by official Metamath C. results.json contains predeclared inputs, policy instructions, exact model observations/actions and honest outcomes. Baseline and model have different budgets. This is functional integration evidence on tiny self-authored tasks, not a standardized benchmark. Raw CLI warnings/local paths and credentials are excluded. Source checkout docs/AI_EXPERIMENT.md explains reproduction.\n');
const zip=out+'.zip';run(process.env.PYTHON||'python',['-c','import pathlib,sys,zipfile; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(f,f.relative_to(p)) for f in sorted(p.rglob("*")) if f.is_file()]; z.close()',out,zip]);
writeFileSync(out+'-SHA256SUMS.txt',hash(readFileSync(zip))+'  '+zip.split(/[\\/]/).at(-1)+'\n');
console.log(JSON.stringify({pass:true,out,zip,summary:summary.results},null,2));
