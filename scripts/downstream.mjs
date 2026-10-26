import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { root, toolchain, version } from './common.mjs';
import { verify } from './oracle.mjs';

const args = process.argv.slice(2);
const registry = args.includes('--registry');
const index = args.indexOf('--version');
const requested = index < 0 ? version : args[index + 1];
if (!/^\d+\.\d+\.\d+$/.test(requested)) throw new Error('A concrete version is required');
mkdirSync(join(root, 'artifacts'), { recursive: true });
const out = mkdtempSync(join(root, 'artifacts', registry ? 'downstream-registry-' : 'downstream-workspace-'));
const consumer = join(out, 'consumer');
mkdirSync(consumer);
for (const file of ['moon.mod', 'moon.pkg', 'main.mbt', 'README.md']) {
  copyFileSync(join(root, 'examples/downstream', file), join(consumer, file));
}
writeFileSync(join(consumer, 'moon.mod'), readFileSync(join(consumer, 'moon.mod'), 'utf8').replace(/moonmetamath@\d+\.\d+\.\d+/, `moonmetamath@${requested}`));
writeFileSync(join(consumer, 'moon.work'), `members = ${JSON.stringify(registry ? ['.'] : ['.', root.replaceAll('\\', '/')])}\n`);
const tc = toolchain(), commands = [], results = [];
let failure = null;
function invoke(label, argv) {
  const run = spawnSync(tc.moon, argv, { cwd: consumer, env: tc.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(out, label + '.stdout.txt'), run.stdout || '');
  writeFileSync(join(out, label + '.stderr.txt'), run.stderr || '');
  commands.push({ label, argv, exitCode: run.status, error: run.error?.message ?? null });
  if (run.error || run.status !== 0) throw new Error(`${label}: ${run.error?.message || run.stderr}`);
  return run.stdout;
}
try {
  if (registry) invoke('registry-add', ['add', `AlexenderSokolov/moonmetamath@${requested}`]);
  for (const target of ['js', 'wasm-gc']) {
    invoke(target + '-check', ['check', '--target', target, '--deny-warn']);
    const records = invoke(target + '-run', ['run', '.', '--target', target, '--deny-warn']).trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(records.length, 2);
    assert.equal(records[0].operation, 'export');
    assert.equal(records[0].outcome, 'valid');
    assert.equal(records[1].pass, true);
    assert.equal(records[1].reused_sessions, 80);
    const candidate = join(out, `${target}-candidate.mm`);
    writeFileSync(candidate, records[0].data.text);
    const independent = await verify(candidate, join(out, `${target}-independent`));
    assert.equal(independent.status, 'valid');
    results.push({ target, ...records[1], independent: independent.status });
  }
} catch (error) {
  failure = error.message;
  process.exitCode = 1;
}
const result = { schema_version: 1, pass: failure === null, registry, version: requested, failure, commands, results };
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, evidence: relative(root, out) }, null, 2));
