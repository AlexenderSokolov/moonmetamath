import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const invoke = (input, args = []) => spawnSync(process.execPath, ['--input-type=module', '-e', "import {runStdio} from './bin/stdio.mjs';await runStdio(process.argv.slice(1));", '--', ...args], { input, encoding: 'utf8', timeout: 10000 });
const req = (operation, fields = {}) => JSON.stringify({ schema_version: 1, request_id: operation, operation, ...fields });
test('stdio preserves strict requests, errors continue, and EOF flushes last line', () => {
  const r = invoke('{broken\n' + req('reset') + '\r\n' + JSON.stringify({operation:'reset'}));
  assert.equal(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].status, 'error');
  assert.equal(rows[1].status, 'ok');
  assert.equal(rows[2].status, 'error');
});
test('stdio enforces a raw line byte bound', () => {
  const r = invoke('x'.repeat(65), ['--max-line-bytes', '64']);
  assert.equal(r.status, 5, r.stderr);
  assert.equal(r.stdout.trim().split('\n').length, 1);
  assert.equal(JSON.parse(r.stdout).outcome, 'resource_limit');
});

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const entry = "import {runStdio} from './bin/stdio.mjs';await runStdio(process.argv.slice(1));";
test('one dispatcher persists through proof actions and errors', async () => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', entry], {stdio:['pipe','pipe','pipe']});
  const iterator = createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const ended = new Promise(resolve => child.on('close', resolve));
  async function call(operation, fields = {}) {
    child.stdin.write(req(operation, fields) + '\n');
    return JSON.parse((await iterator.next()).value);
  }
  const loaded = await call('load', {entry:'a.mm',sources:[{source_id:'a.mm',text:'$c t a $. ax $a t a $. th $p t a $= ax $.'}]});
  const database_id = loaded.data.database_id;
  assert.equal((await call('verify',{database_id})).outcome,'valid');
  const session_id = (await call('start',{database_id,target_label:'th'})).data.session_id;
  assert.equal((await call('preview',{session_id,label:'missing'})).status,'error');
  assert.deepEqual((await call('inspect',{session_id})).data.view.stack,[]);
  assert.equal((await call('apply_label',{session_id,label:'ax'})).status,'ok');
  assert.equal((await call('finish',{session_id})).outcome,'valid');
  assert.equal((await call('close_session',{session_id})).status,'ok');
  assert.equal((await call('unload_database',{database_id})).status,'ok');
  child.stdin.end();
  assert.equal(await ended,0);
});
test('timeout emits exactly one terminal response even with queued input', () => {
  const r = invoke(req('reset') + '\n' + req('reset') + '\n', ['--timeout-ms','1']);
  assert.equal(r.status,5,r.stderr);
  const rows = r.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,1);
  assert.ok(['', 'reset'].includes(rows[0].request_id));
  assert.equal(rows[0].outcome,'resource_limit');
});
test('byte limit accepts its exact boundary and rejects one extra byte', () => {
  const line = req('reset');
  assert.equal(invoke(line, ['--max-line-bytes',String(Buffer.byteLength(line))]).status,0);
  assert.equal(invoke(line, ['--max-line-bytes',String(Buffer.byteLength(line)-1)]).status,5);
});
test('split UTF-8 and CRLF survive chunk framing with output backpressure', async () => {
  const child = spawn(process.execPath, ['--input-type=module','-e',entry]);
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  const ended = new Promise(resolve => child.on('close',resolve));
  const text = JSON.stringify({schema_version:1,request_id:'中文',operation:'reset'}) + '\r\n';
  for (const byte of Buffer.from(text)) {
    child.stdin.write(Buffer.from([byte]));
    await new Promise(resolve => setImmediate(resolve));
  }
  // A bounded pipeline exercises sequential requests without a separate host queue.
  for (let i=0;i<200;i++) child.stdin.write(req('reset')+'\n');
  child.stdin.end();
  assert.equal(await ended,0);
  const rows = Buffer.concat(chunks).toString().trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,201);
  assert.equal(rows[0].request_id,'中文');
  assert.ok(rows.every(row=>row.status==='ok'));
});
test('invalid UTF-8 is rejected without ending the session', () => {
  const r = invoke(Buffer.concat([Buffer.from([0xff,10]),Buffer.from(req('reset'))]));
  assert.equal(r.status,0,r.stderr);
  const rows = r.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows[0].diagnostics[0].code,'INPUT_ERROR');
  assert.equal(rows[1].status,'ok');
});
test('idle SIGINT invalidates the host with one unassociated terminal response', async () => {
  // Emit the Node signal event through IPC so the same handler is testable on Windows.
  const child = spawn(process.execPath,['--input-type=module','-e',"process.on('message',()=>process.emit('SIGINT'));"+entry],{stdio:['pipe','pipe','pipe','ipc']});
  const iterator = createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const ended = new Promise(resolve=>child.on('exit',resolve));
  child.stdin.write(req('reset')+'\n');
  assert.equal(JSON.parse((await iterator.next()).value).status,'ok');
  child.send('interrupt', () => child.disconnect());
  const terminal = JSON.parse((await iterator.next()).value);
  assert.equal(terminal.outcome,'cancelled');
  assert.equal(terminal.request_id,'');
  child.stdin.end();
  assert.equal(await ended,5);
});
test('blank JSONL lines are ignored and unknown fields remain core errors', () => {
  const r = invoke(' \r\n\n\t\n' + req('reset', {unexpected: true}) + '\n \n' + req('reset') + '\n\n');
  assert.equal(r.status,0,r.stderr);
  const rows = r.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2);
  assert.equal(rows[0].status,'error');
  assert.equal(rows[1].status,'ok');
});


test('stdio rejects inherited object properties as options', () => {
  const run = invoke('', ['toString', '1']);
  assert.equal(run.status, 2);
  assert.equal(JSON.parse(run.stdout).diagnostics[0].code, 'INPUT_ERROR');
});
