import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyExit, summarize, validateRow, readJournal } from '../../scripts/performance.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
mkdirSync(join(root, 'artifacts'), { recursive: true });
const base = mkdtempSync(join(root, 'artifacts', 'performance-tests-'));
const sha = text => createHash('sha256').update(text).digest('hex');
const tiny = '$c t a $. ax $a t a $. th $p t a $= ax $.';
const fixture = join(base, 'tiny.mm');
writeFileSync(fixture, tiny);
const source = { repo: 'synthetic-harness-test', commit: '0'.repeat(40) };
const dataset = { id: 'tiny', tier: 'test', path: fixture, url: 'https://example.invalid/tiny.mm', bytes: Buffer.byteLength(tiny), sha256: sha(tiny), git_blob_sha: createHash('sha1').update(`blob ${Buffer.byteLength(tiny)}\0${tiny}`).digest('hex'), expected_proofs: 1, workload: { target_label: 'th', actions: [{ operation: 'apply_label', label: 'ax' }], query: 'ax' } };
let serial = 0;
function run(engineSource, flags = [], override = {}) {
  const dir = join(base, String(++serial));
  mkdirSync(dir);
  const engine = join(dir, 'engine.mjs'), lock = join(dir, 'lock.json'), out = join(dir, 'out');
  writeFileSync(engine, engineSource);
  writeFileSync(lock, JSON.stringify({ schema_version: 1, source, files: [{ ...dataset, ...override }] }));
  const result = spawnSync(process.execPath, ['scripts/performance.mjs', '--engine', engine, '--lock', lock, '--datasets', 'tiny', '--out', out, ...(flags.includes('--mode') ? [] : ['--mode', 'verify']), ...flags], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.error, undefined, result.error?.message);
  const report = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
  return { result, report, out, row: report.cells[0].samples[0] };
}
const successfulEngine = `export function dispatch_json(s) { const r=JSON.parse(s); return JSON.stringify({schema_version:1,request_id:r.request_id,operation:r.operation,status:'ok',outcome:r.operation==='verify'?'valid':null,data:r.operation==='load'?{database_id:'db',declaration_count:3,verified_count:0}:{complete:true,declaration_count:3,proof_count:1,verified_count:1,invalid_count:0,incomplete_count:0,not_checked_count:0},diagnostics:[]}); }`;

test('performance classification keeps timeout, OOM, and host failures separate', () => {
  assert.equal(classifyExit({ timedOut: true, exitCode: null, stderr: 'heap out of memory' }), 'timeout');
  assert.equal(classifyExit({ exitCode: 134, stderr: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' }), 'oom');
  assert.equal(classifyExit({ exitCode: 2, stderr: 'ordinary failure' }), 'host_failure');
  assert.equal(classifyExit({ exitCode: 0, row: { status: 'completed' } }), 'completed');
  assert.equal(classifyExit({ exitCode: 0 }), 'host_failure');
});

test('journal preserves an unfinished phase as null rather than inventing zero', () => {
  const file = join(base, 'interrupted.jsonl');
  writeFileSync(file, JSON.stringify({ type: 'phase_start', name: 'load', at_ms: 2, memory: {} }) + '\n' + '{truncated');
  const phases = readJournal(file).phases;
  assert.equal(phases[0].status, 'interrupted');
  assert.equal(phases[0].duration_ms, null);
});

test('summary includes completed samples only and rejects unfinished finite phase times', () => {
  assert.throws(() => validateRow({ status: 'completed', phases: [{ name: 'load', status: 'interrupted', duration_ms: 0 }] }), /phase|completed|provenance/i);
  const report = summarize([{ status: 'completed', phases: [{ name: 'load', status: 'completed', duration_ms: 4 }] }, { status: 'completed', phases: [{ name: 'load', status: 'completed', duration_ms: 10 }] }, { status: 'timeout', phases: [{ name: 'load', status: 'interrupted', duration_ms: null }] }]);
  assert.deepEqual(report.phases.load, { n: 2, median_ms: 7, min_ms: 4, max_ms: 10 });
});

test('three fresh sequential processes record counts, phases, provenance and process RSS', () => {
  const { result, report, row, out } = run(successfulEngine);
  assert.equal(result.status, 0, result.stderr);
  const samples = report.cells[0].samples;
  assert.equal(samples.length, 3);
  assert.equal(new Set(samples.map(s => s.child.pid)).size, 3);
  assert.equal(row.status, 'completed');
  assert.equal(row.verify.proof_count, 1);
  assert.equal(row.verify.verified_count, 1);
  assert.equal(row.profile.heap_mib, 512);
  assert.equal(row.profile.timeout_ms, 120000);
  assert.match(row.engine.sha256, /^[a-f0-9]{64}$/);
  assert.equal(row.peak_rss.unit, 'KiB');
  assert.equal(row.peak_rss.scope, 'node_process');
  assert.ok(row.peak_rss.value > 0);
  assert.ok(row.phases.some(p => p.name === 'serialization' && p.status === 'completed'));
  assert.ok(row.phases.some(p => p.name === 'load' && p.scope === 'dispatch'));
  assert.ok(existsSync(join(out, row.logs.telemetry)));
  assert.ok(samples.slice(1).every((s, i) => s.parent.started_at >= samples[i].parent.finished_at));
});

test('checksum mismatch stops a cell before engine import and retains the failed phase', () => {
  const { result, report, row } = run(`throw new Error('engine must not import');`, [], { sha256: '0'.repeat(64) });
  assert.equal(result.status, 1);
  assert.equal(row.status, 'checksum_mismatch');
  assert.equal(report.cells[0].samples.length, 1);
  assert.ok(row.phases.some(p => p.name === 'checksum' && p.status === 'failed'));
  assert.ok(!row.phases.some(p => p.name === 'engine_import'));
});

test('a hard parent deadline stops the first stuck cell and retains its started dispatch', () => {
  const engine = successfulEngine.replace("const r=JSON.parse(s);", "const r=JSON.parse(s); if(r.operation==='load')while(true){};");
  const { row, report, result } = run(engine, ['--timeout-ms', '600']);
  assert.equal(result.status, 1);
  assert.equal(row.status, 'timeout');
  assert.equal(report.cells[0].samples.length, 1);
  assert.ok(row.phases.some(p => p.name === 'load' && p.status === 'interrupted' && p.duration_ms === null));
  assert.ok(row.phases.some(p => p.name === 'read' && p.status === 'completed'));
});

test('an actual bounded V8 heap exhaustion is classified from retained stderr', () => {
  const engine = successfulEngine.replace("const r=JSON.parse(s);", "const r=JSON.parse(s); if(r.operation==='load'){const keep=[];while(true)keep.push(Array(100000).fill(1));}");
  const { row, report, out } = run(engine, ['--heap-mib', '32', '--timeout-ms', '8000']);
  assert.equal(row.status, 'oom');
  assert.equal(report.cells[0].samples.length, 1);
  assert.match(readFileSync(join(out, row.logs.stderr), 'utf8'), /heap out of memory/i);
  assert.equal(row.phases.find(p => p.name === 'load').duration_ms, null);
});

test('a returned invalid outcome is retained with measured dispatch and no repetition retry', () => {
  const { row, report } = run(successfulEngine.replace("?'valid':null", "?'invalid':null").replace('verified_count:1,invalid_count:0', 'verified_count:0,invalid_count:1'));
  assert.equal(row.status, 'invalid');
  assert.equal(row.verify.invalid_count, 1);
  assert.equal(report.cells[0].samples.length, 1);
  assert.ok(row.phases.find(p => p.name === 'verify').duration_ms >= 0);
});

test('actual current core executes the fixed tiny workbench without accessing list/proof', () => {
  const url = pathToFileURL(join(root, 'dist', 'moonmetamath-core.mjs')).href;
  const engine = `import * as core from ${JSON.stringify(url)};
    const dispatch=core.create_dispatcher();
    export function dispatch_json(s){const q=JSON.parse(s);if(q.operation==='list')throw new Error('Proof list forbidden');return dispatch(s);}`;
  const { result, row } = run(engine, ['--mode', 'workbench', '--repetitions', '1']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(row.status, 'completed');
  assert.equal(row.verify.proof_count, 1);
  for (const name of ['query', 'start', 'preview.1', 'apply.1', 'inspect', 'rewind', 'rewind_zero', 'create_goal']) assert.ok(row.phases.find(p => p.name === name && p.status === 'completed'), name);
  assert.equal(row.phases.find(p => p.name === 'query').details.calls, 5);
  assert.equal(row.phases.find(p => p.name === 'preview.1').details.calls, 5);
  assert.equal(row.phases.find(p => p.name === 'rewind').details.calls, 5);
});

test('a valid response cannot silently undercount a locked independent proof count', () => {
  const { result, row, report } = run(successfulEngine, [], { expected_proofs: 2 });
  assert.equal(result.status, 1);
  assert.equal(row.status, 'host_failure');
  assert.match(row.failure, /proof.*count|expected.*proof/i);
  assert.equal(report.cells[0].samples.length, 1);
});

test('source Git identity is checked independently of matching byte count and SHA256', () => {
  const { row } = run(`throw new Error('must not import');`, [], { git_blob_sha: '0'.repeat(40) });
  assert.equal(row.status, 'checksum_mismatch');
  assert.ok(!row.phases.some(p => p.name === 'engine_import'));
});

test('an engine import failure retains telemetry and stops the cell', () => {
  const { row, report } = run(`throw new Error('deliberate import failure');`);
  assert.equal(row.status, 'host_failure');
  assert.equal(report.cells[0].samples.length, 1);
  assert.equal(row.phases.find(p => p.name === 'engine_import').status, 'failed');
  assert.match(row.failure, /deliberate import failure/);
});

for (const maximum of [null, 100000000]) test(`core operation limits are ${maximum === null ? 'omitted by default' : 'explicitly routed only to supported operations'}`, () => {
  const url = pathToFileURL(join(root, 'dist', 'moonmetamath-core.mjs')).href;
  const engine = `import * as core from ${JSON.stringify(url)};
    const dispatch=core.create_dispatcher(), maximum=${maximum};
    export function dispatch_json(s){
      const q=JSON.parse(s), accepts=['load','verify','start','create_goal'].includes(q.operation);
      if(maximum!==null && accepts){if(q.limits?.max_operations!==maximum||Object.keys(q.limits).length!==1)throw new Error('Missing diagnostic limit');}
      else if('limits' in q)throw new Error('Unexpected native limit override');
      return dispatch(s);
    }`;
  const { row, result } = run(engine, ['--mode', 'workbench', '--repetitions', '1', ...(maximum === null ? [] : ['--max-operations', String(maximum)])]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(row.status, 'completed');
  assert.deepEqual(row.profile.core_limits, maximum === null ? 'unchanged_defaults' : { max_operations: maximum });
  assert.equal(row.profile.overrides.max_operations, maximum !== null);
  assert.match(row.harness.parent_sha256, /^[a-f0-9]{64}$/);
  assert.match(row.harness.child_sha256, /^[a-f0-9]{64}$/);
  assert.equal(row.workbench.created_target, 'moonmm-perf-goal-v1');
});

test('frozen engine metadata must match its selected artifact before starting any child', () => {
  const dir = join(base, String(++serial));
  mkdirSync(dir);
  const engine = join(dir, 'engine.mjs'), meta = join(dir, 'engine.json'), lock = join(dir, 'lock.json'), out = join(dir, 'out');
  writeFileSync(engine, successfulEngine);
  writeFileSync(meta, JSON.stringify({ artifact_sha256: '0'.repeat(64), source_revision: '0'.repeat(40) }));
  writeFileSync(lock, JSON.stringify({ schema_version: 1, source, files: [dataset] }));
  const result = spawnSync(process.execPath, ['scripts/performance.mjs', '--engine', engine, '--engine-meta', meta, '--lock', lock, '--datasets', 'tiny', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /artifact_sha256 does not match/);
  assert.equal(existsSync(out), false);
});

test('process wall time excludes delayed parent evidence reading after child close', () => {
  const dir = join(base, String(++serial));
  mkdirSync(dir);
  const engine = join(dir, 'engine.mjs'), lock = join(dir, 'lock.json'), wrapper = join(dir, 'delayed-parent.mjs'), out = join(dir, 'out');
  writeFileSync(engine, successfulEngine);
  writeFileSync(lock, JSON.stringify({ schema_version: 1, source, files: [dataset] }));
  writeFileSync(wrapper, `import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    const read=fs.readFileSync;
    fs.readFileSync=function(file,...args){
      if(String(file).endsWith('.telemetry.jsonl')){
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);
        console.error('Injected 250ms parent evidence read delay');
      }
      return read.call(this,file,...args);
    };
    syncBuiltinESMExports();
    const {main}=await import(${JSON.stringify(pathToFileURL(join(root, 'scripts', 'performance.mjs')).href)});
    process.exitCode=await main(process.argv.slice(2));`);
  const result = spawnSync(process.execPath, [wrapper, '--engine', engine, '--lock', lock, '--datasets', 'tiny', '--out', out, '--mode', 'verify', '--repetitions', '1'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Injected 250ms parent evidence read delay/);
  const row = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')).cells[0].samples[0];
  const timestampSpan = Date.parse(row.parent.finished_at) - Date.parse(row.parent.started_at);
  assert.ok(Math.abs(row.parent.process_wall_ms - timestampSpan) < 10, `process wall ${row.parent.process_wall_ms}ms differs from child timestamp span ${timestampSpan}ms`);
});
