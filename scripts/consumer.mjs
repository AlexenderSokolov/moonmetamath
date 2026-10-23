import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { root, toolchain, version as localVersion } from './common.mjs';

const args = process.argv.slice(2);
const registry = args.includes('--registry');
const requestedVersion = args.includes('--version') ? args[args.indexOf('--version') + 1] : localVersion;
if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(requestedVersion)) throw new Error('A concrete --version is required.');
const moduleName = readFileSync(join(root, 'moon.mod'), 'utf8').match(/^name\s*=\s*"([^"]+)"/m)?.[1];
if (!moduleName) throw new Error('moon.mod is missing the module name.');
const artifacts = join(root, 'artifacts'); mkdirSync(artifacts, { recursive: true });
const work = mkdtempSync(join(artifacts, registry ? 'registry-consumer-' : 'workspace-consumer-'));
const consumer = join(work, 'consumer'); mkdirSync(consumer);
const tc = toolchain();
const commands = [];
function invoke(label, command, commandArgs, cwd) {
  console.log(`Consumer ${label}...`);
  const result = spawnSync(command, commandArgs, { cwd, env: tc.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(work, `${label}.stdout.txt`), result.stdout || '');
  writeFileSync(join(work, `${label}.stderr.txt`), result.stderr || '');
  commands.push({ label, command: [command, ...commandArgs], cwd, exitCode: result.status, error: result.error?.message || null });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw new Error(`Consumer ${label} failed: ${result.error?.message || `exit ${result.status}`}`);
  return result.stdout;
}
writeFileSync(join(consumer, 'moon.mod'), `name = "moonmetamath-consumer/smoke"\nversion = "0.1.0"\n${registry ? '' : `import {\n  "${moduleName}@${requestedVersion}",\n}\n`}`);
writeFileSync(join(consumer, 'moon.work'), `members = ${JSON.stringify(registry ? ['.'] : ['.', root.replaceAll('\\', '/')])}\n`);
writeFileSync(join(consumer, 'moon.pkg'), `import {\n  "${moduleName}",\n  "moonbitlang/core/json",\n}\noptions(is_main: true)\n`);
const load = { schema_version: 1, request_id: 'consumer-load', operation: 'load', entry: 'consumer.mm', sources: [{ source_id: 'consumer.mm', text: '$c |- a $. ax $a |- a $. th $p |- a $= ax $.' }] };
const exportLabel = `consumer-export-${Date.now()}`;
writeFileSync(join(consumer, 'main.mbt'), `///|
fn field(value : Json, key : String) -> Json {
  match value {
    Object(fields) => match fields.get(key) {
      Some(value) => value
      None => abort("Missing public response field")
    }
    _ => abort("Expected public response object")
  }
}

///|
fn send(request : Json) -> Json {
  let response = @moonmetamath.dispatch_json(request.stringify())
  println(response)
  @json.parse(response) catch { _ => abort("Invalid response JSON") }
}

///|
fn action(operation : String, fields : Array[(String, Json)]) -> Json {
  fields.push(("schema_version", Json::number(1.0)))
  fields.push(("request_id", Json::string("consumer-" + operation)))
  fields.push(("operation", Json::string(operation)))
  send(Json::object(Map(fields)))
}

///|
fn main {
  let load_request = @json.parse(${JSON.stringify(JSON.stringify(load))}) catch { _ => abort("Invalid load JSON") }
  let loaded = send(load_request)
  let database_id = field(field(loaded, "data"), "database_id")
  let verified = action("verify", [("database_id", database_id)])
  if field(verified, "outcome") != Json::string("valid") { abort("Verification failed") }
  let started = action("start", [("database_id", database_id), ("target_label", Json::string("th"))])
  let session_id = field(field(started, "data"), "session_id")
  let _ = action("apply_label", [("session_id", session_id), ("label", Json::string("ax"))])
  let _ = action("finish", [("session_id", session_id)])
  let _ = action("export", [("session_id", session_id), ("new_label", Json::string(${JSON.stringify(exportLabel)}))])
}
`);
let failure = null, outputs = [];
try {
  if (registry) invoke('registry-add', tc.moon, ['add', `${moduleName}@${requestedVersion}`], consumer);
  for (const target of ['js', 'wasm-gc']) {
    invoke(`${target}-check`, tc.moon, ['check', '--target', target, '--deny-warn'], consumer);
    const text = invoke(`${target}-run`, tc.moon, ['run', '.', '--target', target, '--deny-warn'], consumer);
    const records = text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    const operations = ['load', 'verify', 'start', 'apply_label', 'finish', 'export'];
    assert.equal(records.length, operations.length, `${target}: expected six actual responses`);
    for (const [index, operation] of operations.entries()) {
      const record = records[index];
      assert.equal(record.schema_version, 1); assert.equal(record.operation, operation);
      assert.equal(record.request_id, `consumer-${operation}`); assert.equal(record.status, 'ok');
      assert.deepEqual(record.diagnostics, []);
      assert.equal(record.outcome, ['verify', 'finish', 'export'].includes(operation) ? 'valid' : null);
    }
    assert.equal(typeof records[0].data?.database_id, 'string'); assert.ok(records[0].data.database_id.length);
    assert.equal(records[1].data?.verified_count, 1); assert.equal(records[1].data?.complete, true);
    assert.equal(typeof records[2].data?.session_id, 'string'); assert.ok(records[2].data.session_id.length);
    for (const index of [2, 3, 4]) {
      const view = records[index].data?.view;
      assert.equal(view?.target_label, 'th'); assert.deepEqual(view?.goal, ['|-', 'a']); assert.equal(view?.mode, 'construct');
      assert.equal(view?.successful_step_count, index === 2 ? 0 : 1);
      assert.deepEqual(view?.stack, index === 2 ? [] : [['|-', 'a']]);
      assert.equal(view?.state, index === 4 ? 'complete' : 'open');
    }
    assert.equal(records[3].data.event.label, 'ax'); assert.deepEqual(records[3].data.event.result, ['|-', 'a']);
    const exported = records[5].data;
    assert.equal(exported?.new_label, exportLabel); assert.deepEqual(exported?.source_ids, ['consumer.mm']);
    assert.match(exported?.text, new RegExp(`(?:^|\\n)${exportLabel} \\$p \\|- a \\$= ax \\$\\.`));
    assert.doesNotMatch(exported.text, /\bth\s+\$p/);
    writeFileSync(join(work, `${target}-export.mm`), exported.text);
    outputs.push({ target, records });
  }
  if (JSON.stringify(outputs[0].records) !== JSON.stringify(outputs[1].records)) throw new Error('Consumer JS and wasm-gc outputs differ.');
} catch (error) { failure = error.message; process.exitCode = 1; console.error(`${failure}; evidence: ${work}`); }
finally {
  writeFileSync(join(work, 'result.json'), JSON.stringify({ schema_version: 1, mode: registry ? 'registry' : 'workspace', module: moduleName, version: requestedVersion, export_label: exportLabel, pass: failure === null, failure, workspace: consumer, dependency: registry ? 'moon add from registry; only independent consumer in workspace' : 'local workspace member; does not prove registry installation', commands, outputs }, null, 2) + '\n');
  console.log(`Consumer evidence: ${relative(root, work)}`);
}
