#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { root, toolchain } from './common.mjs';

const STATUSES = new Set(['completed', 'invalid', 'incomplete', 'resource_limit', 'unsupported', 'cancelled', 'checksum_mismatch', 'oom', 'timeout', 'host_failure']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HELP = `Bounded MoonMetamath performance measurements (Node 24).

node scripts/performance.mjs --engine PATH.mjs --datasets hol,nf,set --out UNIQUE_DIR
  --lock PATH           default benchmarks/databases.lock.json
  --mode verify|workbench  default workbench (load, verify, fixed safe interactions)
  --engine-meta PATH    optional frozen build provenance JSON, retained verbatim + SHA256
  --repetitions N       default 3 fresh, sequential subprocesses; stop cell on first failure
  --timeout-ms N        default 120000, hard parent deadline per entire subprocess
  --heap-mib N          default 512, V8 --max-old-space-size (not a total RSS cap)
  --max-operations N    explicit diagnostic core limit; default omitted/unchanged
  --help

--engine is required: choose the saved old build or current dist/moonmetamath-core.mjs.
Every database must match bytes, SHA256 and Git blob SHA1 in the acquisition lock before
the engine is imported. A workbench workload has a fixed target_label, nonempty
apply_label actions and query in that lock; no proof listing or adaptive target choice.
The fixed program runs rules 5 times; start; preview each locked action 5 times then
apply it once; inspect; rewind to the same full prefix 5 times; rewind to zero;
create_goal once with the target's public goal. The deterministic fresh label is
moonmm-perf-goal-v1. Core limits are omitted unless --max-operations is explicit;
then only load/verify/start/create_goal receive that limit. A diagnostic profile
with larger limits must be reported separately from the default profile.

Output directory must not exist. summary.json and per-sample result JSON are validated
and atomically renamed; raw JSONL telemetry and stdout/stderr remain after failures.
Dispatch, JSON serialization/response parsing, source read, engine import and parent
process wall/startup time are separate. Peak RSS is process.resourceUsage().maxRSS
in KiB for the entire Node child; heap snapshots are separately labelled bytes.
Abrupt termination has unknown final peak RSS and a recorded observed lower bound.
Three samples give descriptive median/range only. Cold process does not mean cold OS
file cache. No heavy benchmark is run by importing this module or by --help.
`;

export function classifyExit({ timedOut = false, exitCode, signal, error, stderr = '', row } = {}) {
  if (timedOut) return 'timeout';
  if (/FATAL ERROR[\s\S]*(?:heap limit|heap out of memory|allocation failed)|JavaScript heap out of memory|V8.*out of memory/i.test(stderr)) return 'oom';
  if (error || signal || exitCode !== 0 || !row || !STATUSES.has(row.status)) return 'host_failure';
  return row.status;
}

export function readJournal(file) {
  const phases = [], events = [], problems = [];
  if (!existsSync(file)) return { phases, events, problems: ['telemetry_missing'] };
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    let event;
    try { event = JSON.parse(lines[i]); } catch {
      problems.push(`invalid_telemetry_line_${i + 1}`);
      continue;
    }
    events.push(event);
    if (event.type === 'phase_start') phases.push({ name: event.name, scope: event.scope, status: 'interrupted', started_ms: event.at_ms, duration_ms: null, before: event.memory });
    if (event.type === 'phase_end') {
      const phase = phases.findLast(p => p.name === event.name && p.status === 'interrupted');
      if (!phase) { problems.push(`orphan_phase_end_${i + 1}`); continue; }
      Object.assign(phase, { status: event.status, duration_ms: event.duration_ms, after: event.memory, ...(event.details ? { details: event.details } : {}) });
    }
  }
  return { phases, events, problems };
}

export function validateRow(row) {
  if (!STATUSES.has(row.status)) throw new Error('Unknown sample status.');
  if (!Array.isArray(row.phases) || !row.phases.length) throw new Error('Missing phase telemetry.');
  const names = new Set();
  for (const p of row.phases) {
    if (!p.name || names.has(p.name)) throw new Error('Duplicate or missing phase name.');
    names.add(p.name);
    if (!['completed', 'failed', 'interrupted'].includes(p.status)) throw new Error('Unknown phase status.');
    if (p.status === 'interrupted' ? p.duration_ms !== null : !Number.isFinite(p.duration_ms) || p.duration_ms < 0) throw new Error('Unfinished phase must have null duration; finished phase needs measured duration.');
  }
  if (row.status === 'completed') {
    if (row.phases.some(p => p.status !== 'completed')) throw new Error('Completed sample has unfinished/failed phase.');
    for (const name of ['declaration_count', 'proof_count', 'verified_count', 'invalid_count', 'incomplete_count', 'not_checked_count']) if (!Number.isSafeInteger(row.verify?.[name]) || row.verify[name] < 0) throw new Error('Completed sample has invalid proof counts.');
    if (row.verify?.complete !== true || row.verify.proof_count !== row.verify.verified_count || row.verify.invalid_count !== 0 || row.verify.incomplete_count !== 0 || row.verify.not_checked_count !== 0) throw new Error('Completed sample lacks complete valid proof counts.');
    if (row.dataset?.expected_proofs !== undefined && row.verify.proof_count !== row.dataset.expected_proofs) throw new Error('Completed proof count disagrees with acquisition lock.');
    for (const name of ['read', 'checksum', 'decode', 'engine_import', 'serialization', 'load', 'verify']) if (!row.phases.some(p => p.name === name)) throw new Error(`Completed sample lacks ${name} phase.`);
    if (row.peak_rss?.unit !== 'KiB' || !(row.peak_rss.value > 0)) throw new Error('Completed sample lacks process peak RSS.');
    if (!/^[a-f0-9]{64}$/.test(row.engine?.sha256 ?? '') || !row.environment?.node || !row.profile || !row.git || !row.toolchain) throw new Error('Completed sample lacks provenance.');
  }
  return row;
}

export function summarize(rows) {
  const byPhase = new Map();
  for (const row of rows) if (row.status === 'completed') for (const p of row.phases) {
    if (p.status !== 'completed' || !Number.isFinite(p.duration_ms)) continue;
    if (!byPhase.has(p.name)) byPhase.set(p.name, []);
    byPhase.get(p.name).push(p.duration_ms);
  }
  const phases = {};
  for (const [name, values] of byPhase) {
    values.sort((a, b) => a - b);
    const n = values.length;
    phases[name] = { n, median_ms: n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2, min_ms: values[0], max_ms: values[n - 1] };
  }
  return { completed: rows.filter(r => r.status === 'completed').length, attempted: rows.length, phases, note: 'Descriptive completed-sample median/range only; failures retained separately, no zero imputation or significance claim.' };
}

function atomicJson(path, value) {
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  renameSync(path + '.tmp', path);
}
function command(file, args, env) {
  const p = spawnSync(file, args, { cwd: root, env, encoding: 'utf8', timeout: 10000, windowsHide: true });
  return { command: [file, ...args], exit_code: p.status, stdout: p.stdout?.trim() ?? '', stderr: p.stderr?.trim() ?? '', error: p.error?.message ?? null };
}
function options(args) {
  if (args.includes('--help')) return null;
  const allowed = new Set(['--engine', '--engine-meta', '--lock', '--datasets', '--out', '--mode', '--repetitions', '--timeout-ms', '--heap-mib', '--max-operations']);
  const result = { lock: 'benchmarks/databases.lock.json', mode: 'workbench', repetitions: 3, timeout_ms: 120000, heap_mib: 512 };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    if (!allowed.has(name) || !value || value.startsWith('--') || seen.has(name)) throw new Error(`Unknown, repeated or missing option: ${name}`);
    seen.add(name);
    result[name.slice(2).replaceAll('-', '_')] = value;
  }
  for (const name of ['engine', 'datasets', 'out']) if (!result[name]) throw new Error(`--${name} is required. Use --help.`);
  for (const name of ['repetitions', 'timeout_ms', 'heap_mib', ...(result.max_operations === undefined ? [] : ['max_operations'])]) {
    result[name] = Number(result[name]);
    if (!Number.isSafeInteger(result[name]) || result[name] <= 0) throw new Error(`${name} must be a positive safe integer.`);
  }
  if (!['verify', 'workbench'].includes(result.mode)) throw new Error('--mode must be verify or workbench.');
  result.overrides = { repetitions: seen.has('--repetitions'), timeout_ms: seen.has('--timeout-ms'), heap_mib: seen.has('--heap-mib'), mode: seen.has('--mode'), max_operations: seen.has('--max-operations') };
  return result;
}
function validateLock(lock) {
  if (lock.schema_version !== 1 || !lock.source?.repo || !/^[a-f0-9]{40}$/i.test(lock.source.commit ?? '') || !Array.isArray(lock.files) || !lock.files.length) throw new Error('Invalid acquisition lock schema/source/files.');
  const ids = new Set();
  for (const f of lock.files) {
    if (!/^[A-Za-z0-9_.-]+$/.test(f.id ?? '') || ids.has(f.id) || typeof f.path !== 'string' || !f.path || !f.url || !f.tier || !Number.isSafeInteger(f.bytes) || f.bytes < 0 || !/^[a-f0-9]{64}$/i.test(f.sha256 ?? '') || !/^[a-f0-9]{40}$/i.test(f.git_blob_sha ?? '')) throw new Error(`Invalid or duplicate locked dataset: ${f.id}`);
    if (f.expected_proofs !== undefined && (!Number.isSafeInteger(f.expected_proofs) || f.expected_proofs < 0)) throw new Error(`Invalid locked expected proof count: ${f.id}`);
    ids.add(f.id);
  }
}
async function sample(config, out, prefix) {
  const paths = { config: `${prefix}.config.json`, telemetry: `${prefix}.telemetry.jsonl`, stdout: `${prefix}.stdout.txt`, stderr: `${prefix}.stderr.txt`, child_result: `${prefix}.child.json`, result: `${prefix}.result.json` };
  writeFileSync(join(out, paths.config), JSON.stringify({ ...config, journal: join(out, paths.telemetry), result: join(out, paths.child_result) }, null, 2));
  const stdout = openSync(join(out, paths.stdout), 'wx'), stderr = openSync(join(out, paths.stderr), 'wx');
  const began = performance.now(), started = Date.now();
  let timedOut = false, error = null;
  const result = await new Promise(resolveResult => {
    const child = spawn(process.execPath, [`--max-old-space-size=${config.profile.heap_mib}`, '--unhandled-rejections=strict', join(root, 'scripts/performance-child.mjs'), join(out, paths.config)], { cwd: root, windowsHide: true, stdio: ['ignore', stdout, stderr] });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, config.profile.timeout_ms);
    child.once('error', e => { error = e.message; });
    child.once('close', (code, signal) => { const finishedAt = Date.now(), processWallMs = performance.now() - began; clearTimeout(timer); resolveResult({ exitCode: code, signal, finishedAt, processWallMs }); });
  });
  closeSync(stdout); closeSync(stderr);
  const finished = result.finishedAt, journal = readJournal(join(out, paths.telemetry));
  let childRow = null;
  try { childRow = JSON.parse(readFileSync(join(out, paths.child_result), 'utf8')); } catch (e) { error ??= `No complete child result: ${e.message}`; }
  const status = classifyExit({ ...result, timedOut, error, stderr: readFileSync(join(out, paths.stderr), 'utf8'), row: childRow });
  const ready = journal.events.find(e => e.type === 'ready');
  const lastMemory = [...journal.events].reverse().find(e => e.memory)?.memory;
  const row = {
    schema_version: 1, dataset: config.dataset, source: config.source, lock: config.lock, engine: config.engine, harness: config.harness, git: config.git, toolchain: config.toolchain, environment: config.environment, profile: config.profile, workload: config.workload, repetition: config.repetition,
    status, cold_process: true, os_file_cache: 'uncontrolled', child: { pid: ready?.pid ?? null, node: ready?.node ?? null },
    parent: { started_at: new Date(started).toISOString(), finished_at: new Date(finished).toISOString(), process_wall_ms: result.processWallMs, startup_to_ready_ms: ready ? Math.max(0, ready.wall_ms - started) : null, exit_code: result.exitCode, signal: result.signal, deadline_triggered: timedOut },
    phases: journal.phases.length ? journal.phases : [{ name: 'child_start', scope: 'process', status: 'interrupted', duration_ms: null }],
    load: childRow?.load ?? journal.events.find(e => e.type === 'load_report')?.data ?? null,
    verify: childRow?.verify ?? journal.events.find(e => e.type === 'verify_report')?.data ?? null,
    workbench: journal.events.find(e => e.type === 'workbench_report')?.data ?? null,
    peak_rss: childRow?.peak_rss && !timedOut && result.exitCode === 0 ? childRow.peak_rss : { value: null, unit: 'KiB', scope: 'node_process', collection: 'process.resourceUsage().maxRSS', observed_lower_bound_kib: lastMemory?.process_max_rss_kib ?? null, complete: false },
    failure: childRow?.failure ?? error ?? (status === 'completed' ? null : status), telemetry_problems: journal.problems, logs: paths
  };
  if (journal.problems.length && row.status === 'completed') { row.status = 'host_failure'; row.failure = `Invalid telemetry: ${journal.problems.join(', ')}`; }
  validateRow(row);
  atomicJson(join(out, paths.result), row);
  return row;
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (!opts) { process.stdout.write(HELP); return 0; }
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use the pinned Node 24 runtime for performance measurements.');
  const lockPath = resolve(root, opts.lock), lockBytes = readFileSync(lockPath), lock = JSON.parse(lockBytes);
  validateLock(lock);
  const ids = opts.datasets.split(',');
  if (new Set(ids).size !== ids.length || ids.some(id => !lock.files.some(f => f.id === id))) throw new Error('--datasets must select distinct IDs present in the lock.');
  const datasets = ids.map(id => lock.files.find(f => f.id === id));
  for (const d of datasets) if (opts.mode === 'workbench' && (!d.workload?.target_label || typeof d.workload.query !== 'string' || !Array.isArray(d.workload.actions) || !d.workload.actions.length || d.workload.actions.some(a => a.operation !== 'apply_label' || typeof a.label !== 'string' || !a.label))) throw new Error(`Locked workbench workload invalid: ${d.id}`);
  const enginePath = resolve(root, opts.engine), engineBytes = readFileSync(enginePath);
  let provided = null, metaPath = null, metaSha = null;
  if (opts.engine_meta) { metaPath = resolve(root, opts.engine_meta); const bytes = readFileSync(metaPath); provided = JSON.parse(bytes); metaSha = sha256(bytes); }
  const engine = { path: enginePath, bytes: engineBytes.length, sha256: sha256(engineBytes), source_revision: provided?.source_revision ?? provided?.git_revision ?? provided?.revision ?? null, metadata: provided, metadata_path: metaPath, metadata_sha256: metaSha, provenance_note: 'Artifact SHA is measured; source_revision is supplied build provenance, never inferred from the benchmark checkout.' };
  if (provided?.artifact_sha256 !== undefined && provided.artifact_sha256.toLowerCase() !== engine.sha256) throw new Error('Frozen engine metadata artifact_sha256 does not match the selected engine.');
  const harness = { parent_sha256: sha256(readFileSync(fileURLToPath(import.meta.url))), child_sha256: sha256(readFileSync(join(root, 'scripts/performance-child.mjs'))) };
  const tc = toolchain(), tcPath = join(root, 'scripts/toolchain.lock.json'), tcBytes = readFileSync(tcPath);
  const environment = { node: process.version, versions: process.versions, exec_path: process.execPath, platform: process.platform, arch: process.arch, os_release: os.release(), cpu_model: os.cpus()[0]?.model ?? null, logical_cpus: os.cpus().length, total_memory_bytes: os.totalmem(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, node_options: process.env.NODE_OPTIONS ?? null };
  const git = { head: command('git', ['rev-parse', 'HEAD']).stdout || null, status: command('git', ['status', '--short']), role: 'benchmark_checkout' };
  const toolchainInfo = { lock: JSON.parse(tcBytes), lock_sha256: sha256(tcBytes), moon: command(tc.moon, ['version', '--all'], tc.env) };
  const out = resolve(root, opts.out);
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(out); // Refuse accidental append/overwrite of any existing run.
  const report = { schema_version: 1, created_at: new Date().toISOString(), engine, harness, source: lock.source, lock: { path: lockPath, sha256: sha256(lockBytes) }, environment, git, toolchain: toolchainInfo, profile: { heap_mib: opts.heap_mib, timeout_ms: opts.timeout_ms, repetitions: opts.repetitions, mode: opts.mode, overrides: opts.overrides, core_limits: opts.max_operations === undefined ? 'unchanged_defaults' : { max_operations: opts.max_operations }, sequential: true }, cells: [] };
  for (const dataset of datasets) {
    const cell = { dataset_id: dataset.id, mode: opts.mode, samples: [], stopped_on_first_failure: false };
    report.cells.push(cell);
    for (let repetition = 1; repetition <= opts.repetitions; repetition++) {
      const config = { dataset: { ...dataset, path: resolve(root, dataset.path) }, source: lock.source, lock: report.lock, engine, harness, git, toolchain: toolchainInfo, environment, profile: report.profile, repetition, workload: { ...dataset.workload, program: 'safe-public-operations-v1', batch_repeats: 5, fresh_label: 'moonmm-perf-goal-v1' } };
      const row = await sample(config, out, `${dataset.id}.${opts.mode}.${repetition}`);
      cell.samples.push(row);
      console.log(`${dataset.id} ${opts.mode} ${repetition}/${opts.repetitions}: ${row.status}`);
      if (row.status !== 'completed') { cell.stopped_on_first_failure = true; break; }
    }
    cell.summary = summarize(cell.samples);
  }
  report.pass = report.cells.every(c => c.samples.length === opts.repetitions && c.samples.every(r => r.status === 'completed'));
  atomicJson(join(out, 'summary.json'), report);
  console.log(`Performance evidence: ${out}`);
  return report.pass ? 0 : 1;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.stack ?? error.message); process.exitCode = 2; });
