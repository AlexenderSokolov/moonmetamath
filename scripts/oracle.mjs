import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = { repo: 'metamath/metamath-exe', commit: '9898f5d1bb27045d764dd01672862a1c2a3b4f5e', license: 'GPL-2.0-or-later' };
const posix = value => value.replaceAll('\\', '/');
const enginePath = resolve(root, '.references/metamath-exe', process.platform === 'win32' ? 'metamath.exe' : 'metamath');

export function classifyC(stdout, stderr, exitCode, error) {
  const output = stdout + '\n' + stderr;
  if (error) return { status: error.code === 'ENOENT' ? 'not_available' : 'error', evidence: [error.message] };
  const toolFailures = output.split(/\r?\n/).filter(line => /BUG CHECK|\*\*\* BUG #|Segmentation fault|program was aborted/i.test(line));
  if (toolFailures.length) return { status: 'error', evidence: toolFailures };
  const errors = output.split(/\r?\n/).filter(line => /\?Error|\?Fatal/i.test(line));
  if (errors.length) return { status: 'invalid', evidence: errors };
  if (exitCode !== 0) return { status: 'error', evidence: [`process exit ${exitCode}`] };
  const incomplete = output.split(/\r?\n/).filter(line => /\??Warning.*(?:incomplete|unproved|not proved)|proof.*(?:incomplete|not complete)|has not been proved/i.test(line));
  if (incomplete.length) return { status: 'incomplete', evidence: incomplete };
  // The command echo and terminal completion are both required. READ alone is not verification.
  const completion = output.split(/\r?\n/).filter(line => /All proofs in the database were verified|No \$p statements were found|No proofs were found/i.test(line));
  if (/MM>\s*verify proof \*/i.test(output) && completion.length) return { status: 'valid', evidence: completion };
  return { status: 'error', evidence: ['No recognized proof-verification completion; inspect raw output.'] };
}

export async function verify(file, out, engine = 'metamath-exe') {
  if (!['metamath-exe', 'mmreference'].includes(engine)) throw new Error(`Unsupported engine: ${engine}`);
  const input = resolve(root, file);
  if (/[\r\n"]/.test(input)) throw new Error('Reference adapter requires a path without newline or double quote.');
  const commands = engine === 'metamath-exe' ? [`read "${basename(input)}"`, 'verify proof *', 'exit'] : [resolve(root, '.references/mmreference/mmreference.py'), input];
  const executable = engine === 'metamath-exe' ? enginePath : process.env.PYTHON || 'python';
  const cwd = dirname(input);
  const run = spawnSync(executable, commands, { cwd, encoding: 'utf8', input: '', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  const stdout = run.stdout || '', stderr = run.stderr || '';
  let classified;
  if (engine === 'metamath-exe') classified = classifyC(stdout, stderr, run.status, run.error);
  else {
    const lines = stdout.trim().split(/\r?\n/);
    const match = lines.length === 1 && lines[0].match(/^(verify|error|warn)\t/);
    classified = run.error || run.status !== 0 || !match ? { status: run.error?.code === 'ENOENT' ? 'not_available' : 'error', evidence: [run.error?.message || stderr || 'No recognized reference result'] } : { status: { verify: 'valid', error: 'invalid', warn: 'incomplete' }[match[1]], evidence: lines };
  }
  const data = await readFile(input);
  let executableSha256 = null;
  const engineSource = engine === 'metamath-exe' ? source : { repo: 'LegionMammal978/mm-verifier-tests', commit: '9b4165b8c9ac7a27c18dcf836c42979ca4b7a67f', license: 'CC0-1.0' };
  try { executableSha256 = createHash('sha256').update(await readFile(engine === 'metamath-exe' ? executable : commands[0])).digest('hex'); } catch {}
  const result = { schemaVersion: 1, engine, source: engineSource, executable: engine === 'metamath-exe' ? posix(relative(root, enginePath)) : executable, executableSha256, file: posix(relative(root, input)), inputSha256: createHash('sha256').update(data).digest('hex'), command: [executable, ...commands], cwd, exitCode: run.status, signal: run.signal, error: run.error?.message ?? null, ...classified };
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'stdout.txt'), stdout);
  await writeFile(resolve(out, 'stderr.txt'), stderr);
  await writeFile(resolve(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  function option(name, fallback) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
  const out = resolve(root, option('--out', `artifacts/reference-${args[0] || 'run'}-${Date.now()}`));
  const engine = option('--engine', 'metamath-exe');
  if (args[0] === 'verify') {
    const file = option('--file'); if (!file) throw new Error('verify requires --file');
    const result = await verify(file, out, engine); console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'valid' ? 0 : result.status === 'incomplete' ? 2 : 1;
  } else if (args[0] === 'self-test') {
    const bodies = {
      valid: '$c |- a b $. ax $a |- a $. ok $p |- a $= ax $.\n',
      invalid: '$c |- a b $. ax $a |- a $. bad $p |- b $= ax $.\n',
      incomplete: '$c |- a $. unfinished $p |- a $= ? $.\n',
    };
    await mkdir(out, { recursive: true });
    const results = [];
    for (const [expected, body] of Object.entries(bodies)) {
      const file = resolve(out, `${expected}.mm`); await writeFile(file, body);
      const result = await verify(file, resolve(out, expected), engine); results.push({ expected, ...result, pass: result.status === expected });
    }
    await writeFile(resolve(out, 'results.json'), JSON.stringify({ pass: results.every(x => x.pass), results }, null, 2) + '\n');
    console.log(JSON.stringify(results.map(({ expected, status, pass }) => ({ expected, status, pass })), null, 2));
    if (results.some(x => !x.pass)) process.exitCode = 1;
  } else if (args[0] === 'fixtures') {
    const manifest = JSON.parse(await readFile(resolve(root, option('--manifest', 'tests/fixtures/manifest.json')), 'utf8'));
    const results = [];
    for (const fixture of manifest.fixtures.filter(x => x.applicable !== false)) {
      const data = await readFile(resolve(root, fixture.path));
      if (createHash('sha256').update(data).digest('hex') !== fixture.sha256) throw new Error(`Fixture content changed: ${fixture.id}`);
      const result = await verify(fixture.path, resolve(out, fixture.id), engine);
      results.push({ id: fixture.id, expected: fixture.expected, status: result.status, pass: fixture.expected === result.status, log: posix(relative(root, resolve(out, fixture.id))) });
      console.log(`${fixture.id}: ${result.status} (expected ${fixture.expected})`);
    }
    await writeFile(resolve(out, 'results.json'), JSON.stringify({ schemaVersion: 1, engine, source, pass: results.every(x => x.pass), results }, null, 2) + '\n');
    if (results.some(x => !x.pass)) process.exitCode = 1;
  } else throw new Error('Usage: node scripts/oracle.mjs self-test|fixtures|verify [--file FILE] [--manifest FILE] [--engine metamath-exe] [--out DIR]');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
