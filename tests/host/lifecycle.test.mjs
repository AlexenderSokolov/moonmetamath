import test from 'node:test';
import assert from 'node:assert/strict';
import { coreClient } from '../../bin/host.mjs';

const input = { entry: 'main.mm', sources: [{ source_id: 'main.mm', text: '$c t a $. ax $a t a $. target $p t a $= ax $.' }] };
function ok(response) { assert.equal(response.status, 'ok', JSON.stringify(response)); return response.data; }

test('each coreClient owns an independent dispatcher even after another client resets', async () => {
  const first = await coreClient(), second = await coreClient();
  const db = ok(first({ operation: 'load', ...input })).database_id;
  ok(second({ operation: 'reset' }));
  assert.equal(ok(first({ operation: 'list', database_id: db })).theorems[0].label, 'target');
  assert.equal(second({ operation: 'list', database_id: db }).status, 'error');
});

test('host clients can close and recreate over 64 sessions without losing current work on failure', async () => {
  const request = await coreClient();
  const db = ok(request({ operation: 'load', ...input })).database_id;
  ok(request({ operation: 'verify', database_id: db }));
  let current = ok(request({ operation: 'start', database_id: db, target_label: 'target' })).session_id;
  ok(request({ operation: 'apply_label', session_id: current, label: 'ax' }));
  assert.equal(request({ operation: 'start', database_id: db, target_label: 'missing' }).status, 'error');
  assert.equal(ok(request({ operation: 'inspect', session_id: current })).view.successful_step_count, 1);
  assert.equal(request({ operation: 'unload_database', database_id: db }).diagnostics[0].code, 'DatabaseInUse');
  for (let i = 0; i < 70; i++) {
    const next = ok(request({ operation: 'start', database_id: db, target_label: 'target' })).session_id;
    assert.equal(ok(request({ operation: 'close_session', session_id: current })), null);
    current = next;
  }
  ok(request({ operation: 'close_session', session_id: current }));
  ok(request({ operation: 'unload_database', database_id: db }));
  assert.equal(request({ operation: 'list', database_id: db }).status, 'error');
});
