import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from '../../bin/host.mjs';

test('public dispatcher roundtrips an 8MiB escaped string within 96MiB old-space', () => {
  const out=join(root,'artifacts','v05-large-workbench');
  mkdirSync(out,{recursive:true});
  const source=`import assert from 'node:assert/strict';
    import {create_dispatcher} from ${JSON.stringify(pathToFileURL(join(root,'dist','moonmetamath-core.mjs')).href)};
    const id='a'.repeat(8*1024*1024-1)+'\\n';
    const result=JSON.parse(create_dispatcher()(JSON.stringify({schema_version:1,request_id:id,operation:'reset'})));
    assert.equal(result.status,'ok'); assert.equal(result.request_id,id);
    console.log(JSON.stringify({roundtrip:true,characters:id.length,max_rss_kib:process.resourceUsage().maxRSS}));`;
  const run=spawnSync(process.execPath,['--max-old-space-size=96','--input-type=module','--eval',source],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true});
  const stamp=Date.now();
  writeFileSync(join(out,`wire-memory-${stamp}.stdout.txt`),run.stdout??'');
  writeFileSync(join(out,`wire-memory-${stamp}.stderr.txt`),run.stderr??'');
  assert.equal(run.error,undefined,run.error?.message);
  assert.equal(run.status,0,run.stderr);
  assert.equal(JSON.parse(run.stdout).roundtrip,true);
});
