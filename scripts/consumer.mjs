import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
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
writeFileSync(join(consumer, 'main.mbt'), `///|\nfn field(value : Json, key : String) -> Json {\n  match value {\n    Object(fields) => match fields.get(key) {\n      Some(value) => value\n      None => abort("Missing public response field")\n    }\n    _ => abort("Expected public response object")\n  }\n}\n\n///|\nfn main {\n  let loaded = @moonmetamath.dispatch_json(${JSON.stringify(JSON.stringify(load))})\n  println(loaded)\n  let parsed = @json.parse(loaded) catch { _ => abort("Invalid response JSON") }\n  let database_id = field(field(parsed, "data"), "database_id")\n  let request = Json::object(Map([\n    ("schema_version", Json::number(1.0)),\n    ("request_id", Json::string("consumer-verify")),\n    ("operation", Json::string("verify")),\n    ("database_id", database_id),\n  ]))\n  println(@moonmetamath.dispatch_json(request.stringify()))\n}\n`);
let failure = null, outputs = [];
try {
  if (registry) invoke('registry-add', tc.moon, ['add', `${moduleName}@${requestedVersion}`], consumer);
  for (const target of ['js', 'wasm-gc']) {
    invoke(`${target}-check`, tc.moon, ['check', '--target', target, '--deny-warn'], consumer);
    const text = invoke(`${target}-run`, tc.moon, ['run', '.', '--target', target, '--deny-warn'], consumer);
    const records = text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    if (records.length !== 2 || records[0].request_id !== 'consumer-load' || records[0].status !== 'ok' || typeof records[0].data?.database_id !== 'string' || records[0].data.database_id.length === 0 || records[1].request_id !== 'consumer-verify' || records[1].status !== 'ok' || records[1].outcome !== 'valid' || records[1].data?.verified_count !== 1) throw new Error(`Unexpected ${target} public API result: ${text}`);
    outputs.push({ target, records });
  }
  if (JSON.stringify(outputs[0].records) !== JSON.stringify(outputs[1].records)) throw new Error('Consumer JS and wasm-gc outputs differ.');
} catch (error) { failure = error.message; process.exitCode = 1; console.error(`${failure}; evidence: ${work}`); }
finally {
  writeFileSync(join(work, 'result.json'), JSON.stringify({ schema_version: 1, mode: registry ? 'registry' : 'workspace', module: moduleName, version: requestedVersion, pass: failure === null, failure, workspace: consumer, dependency: registry ? 'moon add from registry; only independent consumer in workspace' : 'local workspace member; does not prove registry installation', commands, outputs }, null, 2) + '\n');
  console.log(`Consumer evidence: ${relative(root, work)}`);
}
