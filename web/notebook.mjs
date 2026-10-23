// Persistence records inputs and successful actions, never native handles or stacks.
const MAX_BYTES = 128 * 1024 * 1024;
const MAX_ACTIONS = 10000;
const encoder = new TextEncoder();

function fail(message) { throw new Error(`Notebook: ${message}`); }

function fields(value, expected, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${name} must be an object.`);
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) fail(`${name} has missing or unknown fields.`);
}

function nonempty(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a nonempty string.`);
}

// Logical file identity follows the core's bundle path normalization; this is
// input validation only. Parsing and all mathematical checks remain in MoonBit.
function sourceIdentity(value) {
  nonempty(value, 'source_id');
  if (value.startsWith('/') || value.includes('\\') || value.includes(':')) fail('Invalid logical source_id.');
  const parts = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) fail('source_id escapes the source bundle.');
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) fail('Invalid logical source_id.');
  return parts.join('/');
}

function snapshot(document) {
  fields(document, ['schema_version', 'entry', 'sources', 'target_label', 'actions', 'completed'], 'document');
  if (document.schema_version !== 1) fail('Unsupported schema_version; expected integer 1.');
  nonempty(document.entry, 'entry');
  nonempty(document.target_label, 'target_label');
  if (typeof document.completed !== 'boolean') fail('completed must be boolean.');
  if (!Array.isArray(document.sources) || !document.sources.length) fail('sources must be a nonempty array.');
  const identities = new Set();
  for (const source of document.sources) {
    fields(source, ['source_id', 'text', 'sha256'], 'source');
    const identity = sourceIdentity(source.source_id);
    if (identities.has(identity)) fail(`Duplicate source_id: ${source.source_id}.`);
    identities.add(identity);
    if (typeof source.text !== 'string') fail('Source text must be a string.');
    if (typeof source.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(source.sha256)) fail('sha256 must be 64 lowercase hexadecimal characters.');
  }
  if (!identities.has(sourceIdentity(document.entry))) fail('entry must name a source in this notebook.');
  if (!Array.isArray(document.actions)) fail('actions must be an array.');
  if (document.actions.length > MAX_ACTIONS) fail('Action limit is 10000 successful steps.');
  for (const action of document.actions) {
    fields(action, ['operation', 'label'], 'action');
    if (action.operation !== 'apply_label') fail('Only apply_label actions can be saved.');
    nonempty(action.label, 'Action label');
  }
  const serialized = JSON.stringify(document);
  // Avoid allocating another huge byte array for obviously oversized strings.
  if (serialized.length > MAX_BYTES || encoder.encode(serialized).length > MAX_BYTES) fail('Serialized size exceeds the 128 MiB limit.');
  // Detach before the first async digest/request so caller mutations cannot
  // change already validated inputs while restoration is in flight.
  return JSON.parse(serialized);
}

async function sha256(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Create a detached schema-1 document. actions must be the current canonical
 * successful prefix after any rewind; no rewind or finish operations are stored.
 */
export async function createNotebook(input) {
  fields(input, ['bundle', 'target_label', 'actions', 'completed'], 'creation input');
  fields(input.bundle, ['entry', 'sources'], 'bundle');
  if (!Array.isArray(input.bundle.sources)) fail('sources must be an array.');
  const sources = input.bundle.sources.map((source) => {
    fields(source, ['source_id', 'text'], 'bundle source');
    return { source_id: source.source_id, text: source.text, sha256: '0'.repeat(64) };
  });
  const document = snapshot({ schema_version: 1, entry: input.bundle.entry, sources,
    target_label: input.target_label, actions: input.actions, completed: input.completed });
  for (const source of document.sources) source.sha256 = await sha256(source.text);
  return document;
}

/** Reconstruct in the caller's NEW, isolated core/Worker instance. The caller
 * keeps its active instance until this promise succeeds, then adopts this result.
 * Source hashes identify bytes and are never treated as a proof verdict.
 */
export async function restoreNotebook(input, request) {
  const document = snapshot(input);
  if (typeof request !== 'function') fail('A candidate core request function is required.');
  for (const source of document.sources) {
    if (await sha256(source.text) !== source.sha256) fail(`Source hash mismatch: ${source.source_id}.`);
  }
  const bundle = { entry: document.entry, sources: document.sources.map(({ source_id, text }) => ({ source_id, text })) };
  async function checked(operation, values) {
    const response = await request({ operation, ...values });
    if (response?.status !== 'ok') {
      const reason = response?.diagnostics?.map((item) => `${item.code}: ${item.message}`).join('; ');
      fail(`${operation} failed${reason ? `: ${reason}` : '.'}`);
    }
    return response;
  }
  const loaded = await checked('load', bundle);
  const database_id = loaded.data.database_id;
  const report = await checked('verify', { database_id });
  // An incomplete target or a bad later proof does not invalidate a legal target
  // prefix. Native start remains authoritative about that prefix's trust state.
  if (!['valid', 'incomplete', 'invalid'].includes(report.outcome)) fail(`verify did not complete: ${report.outcome}.`);
  const listed = await checked('list', { database_id });
  const theorems = listed.data.theorems;
  const target = theorems.find((theorem) => theorem.label === document.target_label);
  if (!target) fail(`Target theorem is missing: ${document.target_label}.`);
  const started = await checked('start', { database_id, target_label: document.target_label });
  const session_id = started.data.session_id;
  let view = started.data.view;
  const events = [];
  for (const action of document.actions) {
    const applied = await checked('apply_label', { session_id, label: action.label });
    view = applied.data.view;
    events.push(applied.data.event);
  }
  if (document.completed) {
    const finished = await checked('finish', { session_id });
    if (finished.outcome !== 'valid' || finished.data.view.state !== 'complete') fail('finish did not confirm a complete proof.');
    view = finished.data.view;
  }
  return { bundle, database_id, session_id, view, events, theorems, report, target };
}
