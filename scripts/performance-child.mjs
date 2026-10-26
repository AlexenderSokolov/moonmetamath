import { readFileSync, openSync, writeSync, fsyncSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { basename } from 'node:path';
import { performance } from 'node:perf_hooks';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const journal = openSync(config.journal, 'wx');
const began = performance.now();
function memory() {
  const m = process.memoryUsage();
  return { rss_bytes: m.rss, heap_used_bytes: m.heapUsed, heap_total_bytes: m.heapTotal, external_bytes: m.external, array_buffers_bytes: m.arrayBuffers, process_max_rss_kib: process.resourceUsage().maxRSS };
}
function emit(event) {
  writeSync(journal, JSON.stringify({ at_ms: performance.now() - began, ...event }) + '\n');
  fsyncSync(journal); // Telemetry survives fatal V8 termination; outside measured interval.
}
emit({ type: 'ready', wall_ms: Date.now(), pid: process.pid, node: process.version, memory: memory() });
function phase(name, scope, fn, details = value => undefined) {
  emit({ type: 'phase_start', name, scope, memory: memory() });
  const started = performance.now();
  let value;
  try { value = fn(); } catch (error) {
    const duration = performance.now() - started;
    emit({ type: 'phase_end', name, scope, status: 'failed', duration_ms: duration, memory: memory(), details: { error: error.message } });
    throw error;
  }
  const duration = performance.now() - started;
  emit({ type: 'phase_end', name, scope, status: 'completed', duration_ms: duration, memory: memory(), details: details(value) });
  return value;
}
async function importEngine() {
  const name = 'engine_import';
  emit({ type: 'phase_start', name, scope: 'module_import', memory: memory() });
  const started = performance.now();
  try {
    const core = await import(pathToFileURL(config.engine.path).href);
    const dispatch = typeof core.create_dispatcher === 'function' ? core.create_dispatcher() : core.dispatch_json;
    if (typeof dispatch !== 'function') throw new Error('Engine must export dispatch_json or create_dispatcher.');
    emit({ type: 'phase_end', name, status: 'completed', duration_ms: performance.now() - started, memory: memory() });
    return dispatch;
  } catch (error) {
    emit({ type: 'phase_end', name, status: 'failed', duration_ms: performance.now() - started, memory: memory(), details: { error: error.message } });
    throw error;
  }
}
class Stop extends Error { constructor(status, message) { super(message); this.status = status; } }
function checkResponse(result) {
  if (result?.schema_version !== 1 || !['ok', 'error'].includes(result.status) || !Array.isArray(result.diagnostics)) throw new Error('Malformed public response.');
  if (result.status !== 'ok') throw new Stop(result.outcome === 'resource_limit' ? 'resource_limit' : 'host_failure', JSON.stringify(result.diagnostics));
  return result;
}
const row = { schema_version: 1, status: 'host_failure', load: null, verify: null, failure: null };
try {
  let bytes = phase('read', 'file_io', () => readFileSync(config.dataset.path), b => ({ bytes: b.length }));
  phase('checksum', 'host_integrity', () => {
    const digest = createHash('sha256').update(bytes).digest('hex');
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (bytes.length !== config.dataset.bytes || digest !== config.dataset.sha256.toLowerCase() || blob !== config.dataset.git_blob_sha.toLowerCase()) throw new Stop('checksum_mismatch', `Locked database checksum mismatch: ${config.dataset.id}`);
    const engine = readFileSync(config.engine.path);
    if (createHash('sha256').update(engine).digest('hex') !== config.engine.sha256) throw new Stop('checksum_mismatch', 'Engine changed after parent fingerprint.');
    return { sha256: digest, git_blob_sha: blob, bytes: bytes.length };
  }, value => value);
  let text = phase('decode', 'host_decode', () => bytes.toString('latin1'));
  bytes = null;
  const dispatch = await importEngine();
  const limitFields = typeof config.profile.core_limits === 'object' ? { limits: config.profile.core_limits } : {};
  let serial = 0;
  function call(name, operation, fields, { repeats = 1 } = {}) {
    let requests = phase(name === 'load' ? 'serialization' : `${name}.serialization`, 'json_serialization', () => Array.from({ length: repeats }, () => JSON.stringify({ schema_version: 1, request_id: String(++serial), operation, ...fields })), values => ({ requests: repeats, request_bytes: values.reduce((n, s) => n + Buffer.byteLength(s), 0) }));
    let responses = phase(name, 'dispatch', () => requests.map(request => dispatch(request)), values => ({ calls: repeats, response_bytes: values.reduce((n, s) => n + Buffer.byteLength(s), 0) }));
    requests = null;
    const parsed = phase(`${name}.response_parse`, 'json_response_parse', () => responses.map(response => checkResponse(JSON.parse(response))), values => ({ calls: repeats, outcome: values.at(-1).outcome }));
    responses = null;
    return parsed.at(-1);
  }
  const entry = basename(config.dataset.path);
  let bundle = { entry, sources: [{ source_id: entry, text }] };
  const loaded = call('load', 'load', { ...bundle, ...limitFields });
  row.load = loaded.data;
  emit({ type: 'load_report', data: row.load, memory: memory() });
  bundle = null; text = null;
  const database_id = loaded.data.database_id;
  const verified = call('verify', 'verify', { database_id, ...limitFields });
  row.verify = { outcome: verified.outcome, ...verified.data };
  emit({ type: 'verify_report', data: row.verify, memory: memory() });
  if (config.dataset.expected_proofs !== undefined && verified.data.proof_count !== config.dataset.expected_proofs) throw new Error(`Public proof count ${verified.data.proof_count} differs from expected proof count ${config.dataset.expected_proofs}.`);
  if (verified.outcome !== 'valid') throw new Stop(['invalid', 'incomplete', 'resource_limit', 'unsupported', 'cancelled'].includes(verified.outcome) ? verified.outcome : 'host_failure', `Verify returned ${verified.outcome}`);
  if (verified.data.complete !== true || verified.data.proof_count !== verified.data.verified_count || verified.data.invalid_count !== 0 || verified.data.incomplete_count !== 0 || verified.data.not_checked_count !== 0) throw new Error('Valid outcome conflicts with public proof counts.');
  if (config.profile.mode === 'workbench') {
    const w = config.workload;
    call('query', 'rules', { database_id, target_label: w.target_label, query: w.query, offset: 0, limit: 20 }, { repeats: w.batch_repeats });
    const started = call('start', 'start', { database_id, target_label: w.target_label, ...limitFields });
    const session_id = started.data.session_id, goal = started.data.view.goal;
    for (let i = 0; i < w.actions.length; i++) {
      call(`preview.${i + 1}`, 'preview', { session_id, label: w.actions[i].label }, { repeats: w.batch_repeats });
      call(`apply.${i + 1}`, 'apply_label', { session_id, label: w.actions[i].label });
    }
    const before = call('inspect', 'inspect', { session_id }).data.view;
    if (before.successful_step_count !== w.actions.length) throw new Error('Fixed actions did not produce the expected prefix length.');
    const rewound = call('rewind', 'rewind', { session_id, successful_step_count: w.actions.length }, { repeats: w.batch_repeats }).data.view;
    if (JSON.stringify(rewound) !== JSON.stringify(before)) throw new Error('Rewind changed the fixed prefix view.');
    const empty = call('rewind_zero', 'rewind', { session_id, successful_step_count: 0 }).data.view;
    if (empty.successful_step_count !== 0 || empty.stack.length !== 0) throw new Error('Rewind to zero did not restore empty construction.');
    const created = call('create_goal', 'create_goal', { database_id, context_label: w.target_label, new_label: w.fresh_label, goal, ...limitFields });
    emit({ type: 'workbench_report', data: { target_label: w.target_label, goal, action_count: w.actions.length, query_repeats: w.batch_repeats, preview_repeats_per_action: w.batch_repeats, rewind_repeats: w.batch_repeats, created_target: created.data.target_label }, memory: memory() });
  }
  row.status = 'completed';
} catch (error) {
  row.status = error.status ?? 'host_failure';
  row.failure = error.message;
  console.error(error.stack ?? error.message);
}
row.peak_rss = { value: process.resourceUsage().maxRSS, unit: 'KiB', scope: 'node_process', collection: 'process.resourceUsage().maxRSS', complete: true };
emit({ type: 'sample_end', status: row.status, memory: memory() });
writeFileSync(config.result + '.tmp', JSON.stringify(row, null, 2) + '\n', { flag: 'wx' });
renameSync(config.result + '.tmp', config.result);
