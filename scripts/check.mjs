import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, toolchain } from './common.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = resolve(root, value('--out', `artifacts/check-${Date.now()}`));
const task = value('--task', 'all');
mkdirSync(out, { recursive: true });
const checks = [];
const tc = toolchain();
function interfaces(directory = root, result = new Map()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '_build', 'artifacts', '.references', '.toolchains', '.moon', 'node_modules', 'dist'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) interfaces(path, result);
    else if (entry.isFile() && entry.name.endsWith('.mbti')) result.set(relative(root, path), readFileSync(path, 'utf8'));
  }
  return result;
}
function execute(label, command, commandArgs, env = process.env) {
  console.log(`Checking ${label}...`);
  const began = performance.now();
  const run = spawnSync(command, commandArgs, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const index = String(checks.length + 1).padStart(2, '0');
  const log = `${index}-${label.replaceAll(/[^a-zA-Z0-9-]/g, '-')}`;
  writeFileSync(join(out, `${log}.stdout.txt`), run.stdout || '');
  writeFileSync(join(out, `${log}.stderr.txt`), run.stderr || '');
  const result = { label, command: [command, ...commandArgs], exitCode: run.status, error: run.error?.message || null, duration_ms: performance.now() - began, stdout: `${log}.stdout.txt`, stderr: `${log}.stderr.txt` };
  checks.push(result);
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error || run.status !== 0) throw new Error(`${label} failed (${run.error?.message || `exit ${run.status}`}); logs: ${out}`);
}
let failure = null;
try {
  execute('pinned-toolchain', process.execPath, ['scripts/toolchain.mjs', 'verify']);
  execute('format', tc.moon, ['fmt', '--check'], tc.env);
  for (const directory of ['bin', 'web', 'scripts']) {
    for (const name of readdirSync(join(root, directory)).filter(name => name.endsWith('.mjs')).sort()) {
      execute(`syntax-${directory}-${name}`, process.execPath, ['--check', join(directory, name)]);
    }
  }
  const before = interfaces();
  execute('interfaces', tc.moon, ['info'], tc.env);
  const after = interfaces();
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(path => before.get(path) !== after.get(path));
  if (changed.length) throw new Error(`moon info changed public interfaces: ${changed.join(', ')}. Review and retain the generated .mbti files, then rerun checks; this run has not passed.`);
  for (const target of ['js', 'wasm-gc']) for (const operation of ['check', 'build', 'test']) execute(`${target}-${operation}`, tc.moon, [operation, '--target', target, '--deny-warn'], tc.env);
  execute('distribution-build', process.execPath, ['scripts/build.mjs']);
  const hostTests = readdirSync(join(root, 'tests/host')).filter(name => name.endsWith('.test.mjs')).sort().map(name => join('tests', 'host', name));
  if (!hostTests.length) throw new Error('No host integration tests were found.');
  execute('host-tests', process.execPath, ['--test', ...hostTests]);
  execute('external-fixtures', process.execPath, ['scripts/check-fixtures.mjs', join(out, 'core-fixtures')]);
} catch (error) {
  failure = error.message;
  console.error(failure);
  process.exitCode = 1;
} finally {
  const summary = { schema_version: 1, task, pass: failure === null, failure, checks };
  writeFileSync(join(out, 'checks.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`Check evidence: ${relative(root, out)}`);
}
