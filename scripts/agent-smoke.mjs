import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const packageRoot = resolve(option('--package', '.'));
const out = resolve(option('--out', `artifacts/agent-smoke-${Date.now()}`));
mkdirSync(out, { recursive: true });
const child = spawn(process.execPath, [join(packageRoot, 'bin/moonmetamath.mjs'), 'stdio'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MOON_HOME: 'unavailable', PATH: 'unavailable' } });
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal })));
let stderr = '', serial = 0;
child.stderr.on('data', bytes => { if (stderr.length < 65536) stderr += bytes.toString(); });
const records = [];
async function call(operation, fields = {}) {
  const request_id = String(++serial);
  const begin = performance.now();
  await new Promise((resolve, reject) => child.stdin.write(JSON.stringify({ schema_version: 1, request_id, operation, ...fields }) + '\n', error => error ? reject(error) : resolve()));
  const row = await lines.next();
  assert.equal(row.done, false, stderr);
  const response = JSON.parse(row.value);
  assert.equal(response.request_id, request_id);
  assert.equal(response.operation, operation);
  records.push({ operation, status: response.status, outcome: response.outcome, milliseconds: performance.now() - begin });
  writeFileSync(join(out, 'progress.json'), JSON.stringify(records, null, 2));
  return response;
}
function ok(response) { assert.equal(response.status, 'ok', JSON.stringify(response.diagnostics)); return response; }
let failure = null, full = null;
try {
  const database_id = ok(await call('load', { entry: 'mini.mm', sources: [{ source_id: 'mini.mm', text: '$c t a $. $v x $. vx $f t x $. ax $a t a $. copy $a t x $. original $p t a $= ax $.' }] })).data.database_id;
  assert.equal(ok(await call('verify', { database_id, limits: { max_operations: 0 } })).outcome, 'resource_limit');
  assert.equal(ok(await call('verify', { database_id })).outcome, 'valid');
  const page = ok(await call('theorems', { database_id, offset: 0, limit: 1 })).data;
  assert.equal(page.total, 1); assert.equal(Object.hasOwn(page.theorems[0], 'proof'), false);
  assert.equal(ok(await call('rules', { database_id, target_label: 'original', query: 'copy', limit: 1 })).data.total, 1);
  const session_id = ok(await call('start', { database_id, target_label: 'original' })).data.session_id;
  assert.equal((await call('preview', { session_id, label: 'copy' })).status, 'error');
  assert.deepEqual(ok(await call('inspect', { session_id })).data.view.stack, []);
  ok(await call('apply_label', { session_id, label: 'ax' }));
  assert.equal((await call('apply_label', { session_id, label: 'missing' })).status, 'error');
  assert.deepEqual(ok(await call('inspect', { session_id })).data.view.stack, [['t', 'a']]);
  ok(await call('preview', { session_id, label: 'copy' }));
  ok(await call('apply_label', { session_id, label: 'copy' }));
  assert.equal(ok(await call('finish', { session_id })).outcome, 'valid');
  const created = ok(await call('create_goal', { database_id, context_label: 'original', new_label: 'fresh', goal: ['t', 'a'] })).data;
  assert.equal(ok(await call('verify', { database_id: created.database_id })).outcome, 'incomplete');
  const fresh = ok(await call('start', { database_id: created.database_id, target_label: created.target_label })).data.session_id;
  ok(await call('apply_label', { session_id: fresh, label: 'ax' }));
  assert.equal(ok(await call('finish', { session_id: fresh })).outcome, 'valid');
  const exported = ok(await call('export', { session_id: fresh, new_label: 'stdio-export' }));
  assert.match(exported.data.text, /stdio-export \$p t a \$= ax \$\./);
  writeFileSync(join(out, 'candidate.mm'), exported.data.text);
  ok(await call('close_session', { session_id: fresh }));
  ok(await call('close_session', { session_id }));
  ok(await call('unload_database', { database_id: created.database_id }));
  ok(await call('unload_database', { database_id }));
  if (args.includes('--full-set')) {
    const source = JSON.parse(readFileSync('benchmarks/databases.lock.json')).files.find(row => row.id === 'set');
    const bytes = readFileSync(source.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    const limits = { max_operations: 100000000 };
    const db = ok(await call('load', { entry: 'set.mm', sources: [{ source_id: 'set.mm', text: bytes.toString('latin1') }], limits })).data.database_id;
    const report = ok(await call('verify', { database_id: db, limits }));
    assert.equal(report.outcome, 'valid'); assert.equal(report.data.verified_count, 48097);
    assert.equal(ok(await call('theorems', { database_id: db, limit: 1 })).data.total, 48097);
    const session = ok(await call('start', { database_id: db, target_label: 'young2d', limits })).data.session_id;
    ok(await call('preview', { session_id: session, label: 'wph' }));
    ok(await call('close_session', { session_id: session }));
    ok(await call('unload_database', { database_id: db }));
    full = { verified: 48097, input_sha256: source.sha256, source_bytes: bytes.length };
  }
  child.stdin.end();
  assert.equal((await exited).code, 0, stderr);
} catch (error) { failure = String(error); child.kill(); process.exitCode = 1; }
finally {
  const result = { pass: failure === null, failure, packageRoot, full, calls: records.length, records, stderr };
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pass: result.pass, failure, calls: records.length, full, evidence: out }));
}
