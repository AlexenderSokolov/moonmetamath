import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,readBundle,coreClient} from '../../bin/host.mjs';
const dir=join(root,'artifacts','host-tests-'+Date.now());mkdirSync(dir,{recursive:true});
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
test('session exports the actual checked proof and refuses overwrite',()=>{
 const actions=join(dir,'proof.json'),out=join(dir,'candidate.mm');writeFileSync(actions,JSON.stringify({schema_version:1,actions:[{operation:'apply_label',label:'ax'},{operation:'finish'}]}));
 const r=cli(['session',good,'--theorem','ok','--actions',actions,'--export',out]);assert.equal(r.status,0,r.stdout+r.stderr);
 assert.match(readFileSync(out,'ascii'),/moonmm-session-1 \$p \|- a \$= ax/);assert.equal(cli(['verify',out]).status,0);
 assert.equal(cli(['session',good,'--theorem','ok','--actions',actions,'--export',out]).status,3);
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
