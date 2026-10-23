import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { coreClient } from '../../bin/host.mjs';

const notebook = await import('../../web/notebook.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const bundle = {
  entry: 'main.mm',
  sources: [
    { source_id: 'main.mm', text: '$[ rules.mm $] earlier $p t a $= ax $. target $p t a $= ax copy $. future $p t a $= ax $.' },
    { source_id: 'rules.mm', text: '$c t a b $. $v x $. wx $f t x $. ax $a t a $. copy $a t x $.' },
  ],
};
const action = (label) => ({ operation: 'apply_label', label });
const clone = (value) => JSON.parse(JSON.stringify(value));

function functions() {
  assert.equal(typeof notebook.createNotebook, 'function', 'Notebook creation must be implemented');
  assert.equal(typeof notebook.restoreNotebook, 'function', 'Notebook restoration must be implemented');
  return notebook;
}
async function client() {
  const request = await coreClient();
  request({ operation: 'reset' });
  return async (fields) => request(fields);
}
async function start(request, input = bundle, target_label = 'target') {
  const loaded = await request({ operation: 'load', ...input });
  assert.equal(loaded.status, 'ok');
  const database_id = loaded.data.database_id;
  const report = await request({ operation: 'verify', database_id });
  const listed = await request({ operation: 'list', database_id });
  const started = await request({ operation: 'start', database_id, target_label });
  assert.equal(started.status, 'ok', JSON.stringify(started));
  return { database_id, session_id: started.data.session_id, view: started.data.view, report, theorems: listed.data.theorems };
}

test('notebook replays a partial proof into the exact native state with fresh handles', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const request = await client();
  const original = await start(request);
  const applied = await request({ operation: 'apply_label', session_id: original.session_id, label: 'ax' });
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [action('ax')], completed: false });
  assert.deepEqual(Object.keys(saved).sort(), ['actions', 'completed', 'entry', 'schema_version', 'sources', 'target_label']);
  assert.equal(saved.schema_version, 1);
  for (const source of saved.sources) {
    assert.deepEqual(Object.keys(source).sort(), ['sha256', 'source_id', 'text']);
    assert.equal(source.sha256, createHash('sha256').update(source.text, 'utf8').digest('hex'));
  }
  const restored = await restoreNotebook(saved, request);
  assert.notEqual(restored.session_id, original.session_id);
  assert.notEqual(restored.database_id, original.database_id);
  assert.deepEqual(restored.bundle, bundle);
  assert.deepEqual(restored.view, applied.data.view);
  assert.deepEqual(restored.events, [applied.data.event]);
  assert.deepEqual(restored.theorems, original.theorems);
  assert.deepEqual(restored.target, original.theorems.find((theorem) => theorem.label === 'target'));
  assert.deepEqual(restored.report.data, original.report.data);
  assert.equal(restored.report.outcome, 'valid');
  saved.actions[0].label = 'future';
  saved.sources[0].text = '';
  assert.equal(restored.bundle.sources[0].text, bundle.sources[0].text);
  assert.equal(restored.events[0].label, 'ax');
});

test('completed notebooks finish by native replay and remain independently exportable', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const request = await client();
  const original = await start(request);
  const events = [];
  for (const label of ['ax', 'copy']) events.push((await request({ operation: 'apply_label', session_id: original.session_id, label })).data.event);
  const finished = await request({ operation: 'finish', session_id: original.session_id });
  const saved = await createNotebook({ bundle, target_label: 'target', actions: events.map((event) => action(event.label)), completed: true });
  const restored = await restoreNotebook(saved, request);
  assert.deepEqual(restored.view, finished.data.view);
  assert.deepEqual(restored.events, events);
  assert.equal(restored.view.state, 'complete');
  const exported = await request({ operation: 'export', session_id: restored.session_id, new_label: 'restored-candidate' });
  assert.equal(exported.outcome, 'valid');
  const loaded = await request({ operation: 'load', entry: 'candidate.mm', sources: [{ source_id: 'candidate.mm', text: exported.data.text }] });
  assert.equal((await request({ operation: 'verify', database_id: loaded.data.database_id })).outcome, 'valid');
});

test('a rewound notebook stores only the remaining successful action prefix', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const request = await client();
  const original = await start(request);
  for (const label of ['ax', 'copy']) await request({ operation: 'apply_label', session_id: original.session_id, label });
  await request({ operation: 'finish', session_id: original.session_id });
  const rewound = await request({ operation: 'rewind', session_id: original.session_id, successful_step_count: 1 });
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [action('ax')], completed: false });
  const restored = await restoreNotebook(saved, request);
  assert.deepEqual(restored.view, rewound.data.view);
  assert.deepEqual(saved.actions, [action('ax')]);
  assert.deepEqual(restored.events.map((event) => event.label), ['ax']);
  assert.equal(restored.view.state, 'open');
});

test('incomplete target and later invalid proofs do not prevent restoring a legal prefix', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const input = clone(bundle);
  input.sources[0].text = input.sources[0].text.replace('target $p t a $= ax copy', 'target $p t a $= ?').replace('future $p t a $= ax', 'future $p t b $= ax');
  const saved = await createNotebook({ bundle: input, target_label: 'target', actions: [action('ax'), action('copy')], completed: true });
  const restored = await restoreNotebook(saved, await client());
  assert.equal(restored.view.state, 'complete');
  assert.equal(restored.report.outcome, 'invalid');
  assert.equal(restored.target.status, 'incomplete');
});

test('all source hashes are validated before touching the candidate core', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [], completed: false });
  const request = await client();
  for (const mutate of [
    (doc) => { doc.sources[1].text += ' '; },
    (doc) => { doc.sources[1].sha256 = '0'.repeat(64); },
    (doc) => { doc.sources[1].sha256 = 'not-a-hash'; },
  ]) {
    const changed = clone(saved); mutate(changed);
    let calls = 0;
    await assert.rejects(() => restoreNotebook(changed, async (fields) => { calls++; return request(fields); }), /hash|sha256/i);
    assert.equal(calls, 0, 'A damaged later source must be rejected before load');
  }
});

test('restoration detaches validated inputs before asynchronous hashing and replay', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [action('ax')], completed: false });
  const request = await client();
  const restoring = restoreNotebook(saved, request);
  saved.actions[0].label = 'future';
  saved.sources[1].text = '';
  saved.target_label = 'future';
  const restored = await restoring;
  assert.equal(restored.target.label, 'target');
  assert.deepEqual(restored.view.stack, [['t', 'a']]);
  assert.deepEqual(restored.events.map((event) => event.label), ['ax']);
  assert.equal(restored.bundle.sources[1].text, bundle.sources[1].text);
});

test('a failed candidate in a fresh core preserves the active proof and its handles', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const activeRequest = await client();
  const active = await start(activeRequest);
  await activeRequest({ operation: 'apply_label', session_id: active.session_id, label: 'ax' });
  const before = await activeRequest({ operation: 'inspect', session_id: active.session_id });
  // A module instance models the fresh Worker the browser owns during import.
  const isolated = await import(new URL('../../dist/moonmetamath-core.mjs?notebook-candidate', import.meta.url));
  let serial = 0;
  const candidateRequest = async (fields) => JSON.parse(isolated.dispatch_json(JSON.stringify({ schema_version: 1, request_id: String(++serial), ...fields })));
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [action('future')], completed: false });
  await assert.rejects(restoreNotebook(saved, candidateRequest), /ForwardReference|future|visible/i);
  const after = await activeRequest({ operation: 'inspect', session_id: active.session_id });
  assert.deepEqual(after.data, before.data);
  assert.equal((await activeRequest({ operation: 'finish', session_id: active.session_id })).outcome, 'valid');
});

test('strict notebook schema rejects injected state and malformed actions before core mutation', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const saved = await createNotebook({ bundle, target_label: 'target', actions: [], completed: false });
  const mutations = [
    (doc) => { doc.schema_version = 2; },
    (doc) => { doc.schema_version = '1'; },
    (doc) => { delete doc.completed; },
    (doc) => { doc.completed = 'false'; },
    (doc) => { doc.target_label = ''; },
    (doc) => { doc.session_id = 'session-1'; },
    (doc) => { doc.stack = [['t', 'a']]; },
    (doc) => { doc.sources[1].database_id = 'db-1'; },
    (doc) => { doc.sources.push(clone(doc.sources[0])); },
    (doc) => { doc.sources.push({ ...doc.sources[0], source_id: './main.mm' }); },
    (doc) => { doc.entry = 'missing.mm'; },
    (doc) => { doc.actions = {}; },
    (doc) => { doc.actions = [null]; },
    (doc) => { doc.actions = [{ operation: 'rewind', successful_step_count: 0 }]; },
    (doc) => { doc.actions = [{ operation: 'apply_label', label: 1 }]; },
    (doc) => { doc.actions = [{ operation: 'apply_label', label: 'ax', session_id: 'injected' }]; },
    (doc) => { doc.actions = Array.from({ length: 10001 }, () => action('ax')); },
  ];
  const request = await client();
  for (const [index, mutate] of mutations.entries()) {
    const changed = clone(saved); mutate(changed);
    let calls = 0;
    await assert.rejects(() => restoreNotebook(changed, async (fields) => { calls++; return request(fields); }), undefined, `case ${index}`);
    assert.equal(calls, 0, `case ${index} reached the core`);
  }
  for (const invalid of [null, [], {}, { ...saved, sources: null }]) {
    await assert.rejects(() => restoreNotebook(invalid, request));
  }
});

test('creation validates types and limits instead of silently discarding privileged actions', async () => {
  const { createNotebook } = functions();
  const valid = { bundle, target_label: 'target', actions: [], completed: false };
  for (const changed of [
    { ...valid, actions: [{ operation: 'finish' }] },
    { ...valid, actions: [action('')] },
    { ...valid, completed: 1 },
    { ...valid, bundle: { ...bundle, sources: [...bundle.sources, clone(bundle.sources[0])] } },
    { ...valid, actions: Array.from({ length: 10001 }, () => action('ax')) },
  ]) await assert.rejects(() => createNotebook(changed));
  const saved = await createNotebook(valid);
  assert.deepEqual(saved.actions, []);
  assert.equal(saved.completed, false);
});

test('notebook serialized size cap is checked before hashing or core calls', async () => {
  const { createNotebook, restoreNotebook } = functions();
  const text = ' '.repeat(128 * 1024 * 1024);
  const oversized = { schema_version: 1, entry: 'large.mm', sources: [{ source_id: 'large.mm', text, sha256: '0'.repeat(64) }], target_label: 'target', actions: [], completed: false };
  let calls = 0;
  await assert.rejects(() => restoreNotebook(oversized, async () => { calls++; }), /size|128|limit/i);
  assert.equal(calls, 0);
  await assert.rejects(() => createNotebook({ bundle: { entry: 'large.mm', sources: [{ source_id: 'large.mm', text }] }, target_label: 'target', actions: [], completed: false }), /size|128|limit/i);
});

test('replay rejects fake completion, unknown or future labels and invalid prefix proofs', async () => {
  const { createNotebook, restoreNotebook } = functions();
  for (const labels of [[], ['ax', 'ax'], ['future'], ['target'], ['missing-label']]) {
    const saved = await createNotebook({ bundle, target_label: 'target', actions: labels.map(action), completed: true });
    await assert.rejects(restoreNotebook(saved, await client()));
  }
  const badPrefix = clone(bundle);
  badPrefix.sources[0].text = badPrefix.sources[0].text.replace('earlier $p t a $= ax', 'earlier $p t a $= ?');
  const saved = await createNotebook({ bundle: badPrefix, target_label: 'target', actions: [], completed: false });
  await assert.rejects(restoreNotebook(saved, await client()));
});
