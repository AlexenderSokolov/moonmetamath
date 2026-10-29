import assert from 'node:assert/strict';
import { create_dispatcher } from '../dist/moonmetamath-core.mjs';

const dispatch = create_dispatcher();
let serial = 0;
const databases = [];
const sessions = [];
const cleanupErrors = [];
let failure;
let summary;

function call(operation, fields = {}) {
  return JSON.parse(dispatch(JSON.stringify({
    ...fields, schema_version: 1, request_id: `example-${++serial}`, operation,
  })));
}
function requireOk(response) {
  if (response.status !== 'ok') throw new Error(JSON.stringify(response.diagnostics));
  return response;
}
function start(database_id, target_label) {
  const response = requireOk(call('start', { database_id, target_label }));
  sessions.push(response.data.session_id);
  return response.data.session_id;
}

try {
  const loaded = requireOk(call('load', {
    entry: 'mini.mm',
    sources: [{ source_id: 'mini.mm', text: '$c t a $. $v x $. vx $f t x $. ax $a t a $. copy $a t x $. original $p t a $= ax $.' }],
  }));
  const database_id = loaded.data.database_id;
  databases.push(database_id);

  // A completed request may still report a resource limit or an incomplete proof.
  const limited = requireOk(call('verify', { database_id, limits: { max_operations: 0 } }));
  assert.equal(limited.outcome, 'resource_limit');
  const verified = requireOk(call('verify', { database_id }));
  assert.equal(verified.outcome, 'valid');

  const original = start(database_id, 'original');
  requireOk(call('apply_label', { session_id: original, label: 'ax' }));
  assert.equal(requireOk(call('finish', { session_id: original })).outcome, 'valid');

  const created = requireOk(call('create_goal', {
    database_id, context_label: 'original', new_label: 'fresh', goal: ['t', 'a'],
  })).data;
  databases.push(created.database_id);
  const incomplete = requireOk(call('verify', { database_id: created.database_id }));
  assert.equal(incomplete.outcome, 'incomplete');
  assert.equal(incomplete.data.incomplete_count, 1);

  const session_id = start(created.database_id, created.target_label);
  requireOk(call('apply_label', { session_id, label: 'ax' }));
  const before = requireOk(call('inspect', { session_id })).data.view;
  const rejected = call('apply_label', { session_id, label: 'missing-rule' });
  assert.equal(rejected.status, 'error');
  const after = requireOk(call('inspect', { session_id })).data.view;
  assert.deepEqual(after, before);

  // Inspect the unchanged state, preview a valid action, then continue this session.
  requireOk(call('preview', { session_id, label: 'copy' }));
  assert.deepEqual(requireOk(call('inspect', { session_id })).data.view, after);
  requireOk(call('apply_label', { session_id, label: 'copy' }));
  assert.equal(requireOk(call('finish', { session_id })).outcome, 'valid');
  const exported = requireOk(call('export', { session_id, new_label: 'fresh-export' }));
  summary = {
    pass: true, budget_outcome: limited.outcome, source_outcome: verified.outcome,
    new_goal_outcome: incomplete.outcome, rejected_code: rejected.diagnostics[0].code,
    continued_steps: after.successful_step_count + 1, proof: exported.data.text,
  };
} catch (error) {
  failure = error;
} finally {
  // Release every acquired resource, even if a later operation or cleanup fails.
  for (const session_id of sessions.reverse()) {
    try { requireOk(call('close_session', { session_id })); }
    catch (error) { cleanupErrors.push(error); }
  }
  for (const database_id of databases.reverse()) {
    try { requireOk(call('unload_database', { database_id })); }
    catch (error) { cleanupErrors.push(error); }
  }
}
if (failure || cleanupErrors.length) {
  throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'Agent example failed');
}
console.log(JSON.stringify({ ...summary, closed_sessions: sessions.length, unloaded_databases: databases.length }));
