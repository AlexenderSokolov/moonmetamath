import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {root} from './common.mjs';
import {readBundle,coreClient} from '../bin/host.mjs';
const manifest=JSON.parse(readFileSync(join(root,'tests/fixtures/manifest.json'),'utf8'));
const client=await coreClient();
const results=[];
for(const fixture of manifest.fixtures.filter(f=>f.applicable!==false)){
 const begin=performance.now();let result,actual;
 try{
  client({operation:'reset'});
  result=client({operation:'load',...readBundle(resolve(root,fixture.path))});
  if(result.status==='error')actual=result.diagnostics?.[0]?.code==='ResourceLimit'?'resource_limit':'invalid';
  else{result=client({operation:'verify',database_id:result.data.database_id});actual=result.outcome;}
 }catch(error){result={error:error.message};actual='invalid';}
 const row={id:fixture.id,expected:fixture.expected,actual,pass:actual===fixture.expected,duration_ms:performance.now()-begin,result};
 results.push(row);
 if(!row.pass)console.error(JSON.stringify(row));
}
const summary={schema_version:1,engine:'MoonBit JS',total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
const out=resolve(root,process.argv[2]??'artifacts/core-fixtures');mkdirSync(out,{recursive:true});writeFileSync(join(out,'results.json'),JSON.stringify(summary,null,2)+'\n');
console.log(`MoonBit external fixtures: ${summary.passed}/${summary.total} passed, ${summary.failed} failed.`);
process.exitCode=summary.failed?1:0;
