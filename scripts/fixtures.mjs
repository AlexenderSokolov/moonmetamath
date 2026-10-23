import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  set: { repo: 'metamath/set.mm', commit: 'b4c3130f3b8081e1e4a33b47321141359e3380ae', license: 'CC0-1.0' },
  edge: { repo: 'LegionMammal978/mm-verifier-tests', commit: '9b4165b8c9ac7a27c18dcf836c42979ca4b7a67f', license: 'CC0-1.0' },
  suite: { repo: 'david-a-wheeler/metamath-test', commit: '5758bf781bab662d4b31c7f72ac4dedea74fcb0f', license: 'MIT; file headers may declare CC0' },
  python: { repo: 'david-a-wheeler/mmverify.py', commit: '63a2aa3815cd5bf67892dbfc7f2048cbb177524c', license: 'MIT' },
  c: { repo: 'metamath/metamath-exe', commit: '9898f5d1bb27045d764dd01672862a1c2a3b4f5e', license: 'GPL-2.0-or-later' },
};
const hash = b => createHash('sha256').update(b).digest('hex');
const posix = p => p.replaceAll('\\', '/');
let previousFiles = new Map();
let offline = false;
async function get(url) {
  if (offline) throw new Error(`Offline mode cannot acquire missing pinned file: ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'moonmetamath-pinned-fixtures' } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function tree(source) {
  if (offline) {
    const records = [...previousFiles.values()].filter(file => file.source.repo === source.repo && file.source.commit === source.commit);
    if (!records.length) throw new Error(`No locked offline source files: ${source.repo}`);
    const paths = new Map();
    for (const file of records) {
      const data = await readFile(resolve(root, file.path));
      if (hash(data) !== file.sha256) throw new Error(`Modified offline file: ${file.path}`);
      paths.set(file.source.path, { type: 'blob', path: file.source.path, sha: createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') });
    }
    return [...paths.values()];
  }
  const result = JSON.parse((await get(`https://api.github.com/repos/${source.repo}/git/trees/${source.commit}?recursive=1`)).toString());
  if (result.truncated) throw new Error(`Truncated source tree: ${source.repo}`);
  return result.tree.filter(item => item.type === 'blob');
}
async function acquire(source, sourcePath, destination) {
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`;
  const dest = resolve(root, destination);
  let data;
  try { data = await readFile(dest); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const previous = previousFiles.get(posix(relative(root, dest)));
  if (data && previous && hash(data) !== previous.sha256) throw new Error(`Cached pinned file was modified: ${destination}`);
  // Files without a local lock are fetched again; arbitrary pre-existing bytes never become trusted fixtures.
  if (data && !previous) data = undefined;
  if (!data) { data = await get(url); await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, data); }
  return { path: posix(relative(root, dest)), source: { ...source, path: sourcePath, url }, bytes: data.length, sha256: hash(data), data };
}
async function main() {
  const args = process.argv.slice(2);
  offline = args.includes('--offline');
  if (args[0] !== 'fetch' || (args.includes('--profile') && args[args.indexOf('--profile') + 1] !== 'october')) throw new Error('Usage: node scripts/fixtures.mjs fetch --profile october');
  const fixtures = [], supportFiles = [], exclusions = [];
  try {
    const previous = JSON.parse(await readFile(resolve(root, '.references/acquired.json'), 'utf8'));
    previousFiles = new Map([...previous.fixtures, ...previous.supportFiles].map(file => [file.path, file]));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  async function add(source, path, target, details) {
    const file = await acquire(source, path, target);
    const { data, ...record } = file;
    if (details) {
      if (/Copyright \(GPL\)/i.test(data.toString())) {
        record.source = { ...record.source, repositoryLicense: source.license, license: 'GPL (unversioned notice in file)', licenseNote: `File header declares GPL; repository-level license is ${source.license}. Preserve the file notice; do not assert file is CC0.` };
      } else if (/CC0|Creative Commons.*Zero/i.test(data.toString())) record.source.license = 'CC0-1.0';
      fixtures.push({ id: details.id, ...record, ...details, applicable: true });
    }
    else supportFiles.push(record);
    return data.toString('utf8');
  }
  for (const name of ['demo0', 'miu', 'peano', 'hol']) await add(sources.set, `${name}.mm`, `tests/fixtures/upstream/set-mm/${name}.mm`, { id: `set-${name}`, expected: 'valid', category: 'official-database' });
  await add(sources.set, 'LICENSE', 'tests/fixtures/upstream/set-mm/LICENSE');
  const edgeTree = await tree(sources.edge);
  for (const item of edgeTree.filter(x => /^(verify-tests|unknown-tests)\//.test(x.path))) {
    const data = await acquire(sources.edge, item.path, `tests/fixtures/upstream/mm-verifier-tests/${item.path}`);
    const blobHash = createHash('sha1').update(`blob ${data.data.length}\0`).update(data.data).digest('hex');
    if (blobHash !== item.sha) throw new Error(`Pinned Git blob mismatch: ${item.path}`);
    const { data: content, ...record } = data;
    if (/\/test\d+\.mm$/.test(item.path)) {
      const marker = content.toString().match(/\$\( should (verify|error|warn) \$\)/)?.[1];
      if (!marker) throw new Error(`Missing upstream expectation: ${item.path}`);
      fixtures.push({ id: `edge-${item.path.replaceAll('/', '-')}`, ...record, expected: { verify: 'valid', error: 'invalid', warn: 'incomplete' }[marker], category: item.path.startsWith('unknown') ? 'unknown-proof' : 'language-boundary', applicable: true, expectationSource: 'upstream should verify/error/warn marker' });
    } else supportFiles.push(record);
  }
  for (const path of ['COPYING', 'README.md']) await add(sources.edge, path, `tests/fixtures/upstream/mm-verifier-tests/${path}`);
  for (const path of ['mmreference.py', 'COPYING', 'README.md']) await add(sources.edge, path, `.references/mmreference/${path}`);
  for (const path of ['mmverify.py', 'LICENSE', 'README.md']) await add(sources.python, path, `.references/mmverify/${path}`);
  const harness = await add(sources.suite, 'run-testsuite', 'tests/fixtures/upstream/metamath-test/run-testsuite');
  for (const path of ['LICENSE', 'README.md', 'test-metamath']) await add(sources.suite, path, `tests/fixtures/upstream/metamath-test/${path}`);
  const selected = new Set(['anatomy.mm', 'anatomy-bad1.mm', 'anatomy-bad2.mm', 'anatomy-bad3.mm', 'big-unifier.mm', 'big-unifier-bad1.mm', 'big-unifier-bad2.mm', 'big-unifier-bad3.mm', 'demo0.mm', 'demo0-bad1.mm', 'demo0-includer.mm', 'emptyline.mm', 'miu.mm', 'peano-fixed.mm', 'hol.mm']);
  for (const match of harness.matchAll(/^(pass|fail) ([\w.-]+\.mm)/gm)) {
    const [, expectation, path] = match;
    if (!selected.has(path)) { exclusions.push({ source: { ...sources.suite, path }, reason: 'Deferred enhanced database or large historical set.mm test outside the October small-fixture profile; not claimed covered.', expected: expectation === 'pass' ? 'valid' : 'invalid' }); continue; }
    await add(sources.suite, path, `tests/fixtures/upstream/metamath-test/${path}`, { id: `suite-${path.slice(0, -3)}`, expected: expectation === 'pass' ? 'valid' : 'invalid', category: 'metamath-test', expectationSource: 'pinned run-testsuite pass/fail invocation' });
  }
  await add(sources.suite, 'demo0-includee.mm', 'tests/fixtures/upstream/metamath-test/demo0-includee.mm');
  const cTree = await tree(sources.c);
  for (const item of cTree.filter(x => /^src\/[^/]+\.[ch]$/.test(x.path) || ['LICENSE.TXT', 'README.TXT', 'build.sh', 'doc/BUILD.md'].includes(x.path))) {
    const file = await acquire(sources.c, item.path, `.references/metamath-exe/${item.path}`);
    if (createHash('sha1').update(`blob ${file.data.length}\0`).update(file.data).digest('hex') !== item.sha) throw new Error(`Pinned C Git blob mismatch: ${item.path}`);
    const { data, ...record } = file; supportFiles.push(record);
  }
  await mkdir(resolve(root, 'tests/fixtures'), { recursive: true });
  const manifest = { schemaVersion: 1, profile: 'october', sources, fixtures, supportFiles, exclusions };
  await writeFile(resolve(root, 'tests/fixtures/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(root, '.references/acquired.json'), JSON.stringify({ acquiredAt: new Date().toISOString(), ...manifest }, null, 2) + '\n');
  console.log(`Fetched ${fixtures.length} fixtures, ${supportFiles.length} support/source files; ${exclusions.length} explicitly deferred upstream tests.`);
  const src = resolve(root, '.references/metamath-exe/src');
  const cFiles = cTree.filter(x => /^src\/[^/]+\.c$/.test(x.path)).map(x => resolve(root, '.references/metamath-exe', x.path));
  const executable = resolve(root, '.references/metamath-exe', process.platform === 'win32' ? 'metamath.exe' : 'metamath');
  let compiler = process.env.CC || 'gcc';
  let command = ['-std=c99', '-O2', ...cFiles, '-o', executable];
  if (process.platform === 'win32') {
    // Official C uses long-sized pointer storage; native Win64 LLP64 crashes at startup.
    // Build unchanged upstream sources for x86, where long and pointers are both 32-bit.
    const where = spawnSync('where.exe', ['cl.exe'], { encoding: 'utf8' });
    const cl = where.stdout?.trim().split(/\r?\n/)[0];
    const vcRoot = cl?.match(/^(.*[\\/]VC)[\\/]Tools[\\/]/i)?.[1];
    if (!vcRoot) throw new Error('Windows independent C checker needs an installed MSVC x86 toolchain (cl.exe on PATH); Win64 MinGW is unsupported by upstream pointer storage.');
    const vcvars = resolve(vcRoot, 'Auxiliary/Build/vcvarsall.bat');
    if (/[\r\n"%]/.test(vcvars)) throw new Error('Unsupported MSVC installation path');
    const buildFile = resolve(root, '.references/build-reference.cmd');
    await writeFile(buildFile, `@echo off\r\ncall "${vcvars}" x86\r\nif errorlevel 1 exit /b %errorlevel%\r\ncl /nologo /O2 /std:c11 /TC *.c /Fe:..\\metamath.exe\r\n`);
    compiler = 'cmd.exe'; command = ['/d', '/c', buildFile];
  }
  const build = spawnSync(compiler, command, { cwd: src, encoding: 'utf8', timeout: 120000 });
  const buildOut = resolve(root, 'artifacts/reference-build-' + Date.now());
  await mkdir(buildOut, { recursive: true });
  await writeFile(resolve(buildOut, 'stdout.txt'), build.stdout || '');
  await writeFile(resolve(buildOut, 'stderr.txt'), build.stderr || '');
  await writeFile(resolve(buildOut, 'result.json'), JSON.stringify({ source: sources.c, command: [compiler, ...command], exitCode: build.status, error: build.error?.message, executable: posix(relative(root, executable)), architecture: process.platform === 'win32' ? 'x86 (upstream long-pointer representation)' : process.arch }, null, 2) + '\n');
  if (build.error || build.status !== 0) throw new Error(`Independent C build failed; see ${posix(relative(root, buildOut))}`);
  console.log(`Built independent C checker: ${posix(relative(root, executable))}`);
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
