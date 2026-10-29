import { mkdirSync, copyFileSync, readdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root, version, run } from './common.mjs';
import { packageDocs, checkPackageLinks } from './package-docs.mjs';

const at = process.argv.indexOf('--out');
const out = resolve(root, at < 0 ? `artifacts/package-${Date.now()}` : process.argv[at + 1]);
const stage = join(out, `moonmetamath-${version}`);
mkdirSync(stage, { recursive: true });

function copy(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) copy(from, to);
    else copyFileSync(from, to);
  }
}
function copyFile(file) {
  mkdirSync(dirname(join(stage, file)), { recursive: true });
  copyFileSync(join(root, file), join(stage, file));
}
for (const directory of ['dist', 'web', 'LICENSES', 'benchmarks', 'examples']) {
  copy(join(root, directory), join(stage, directory));
}
for (const file of [
  'bin/host.mjs', 'bin/moonmetamath.mjs', 'bin/actions.mjs', 'LICENSE',
  ...packageDocs, 'tests/fixtures/manifest.json', 'scripts/toolchain.lock.json',
]) copyFile(file);
for (const name of ['demo0.mm', 'miu.mm', 'hol.mm', 'LICENSE']) {
  copyFile(`tests/fixtures/upstream/set-mm/${name}`);
}
const documentLinks = checkPackageLinks(stage);
writeFileSync(join(stage, 'USAGE.txt'), `MoonMetamath ${version}\nRequires Node.js 24.\nnode bin/moonmetamath.mjs --help\nnode bin/moonmetamath.mjs verify tests/fixtures/upstream/set-mm/hol.mm\nServe this folder with a static HTTP server to open web/.\nDevelopment commands in PROJECT.md require a source checkout.\nSee docs/CLI.md and docs/THIRD_PARTY.md.\n`);

const zip = join(out, `moonmetamath-${version}-node24.zip`);
const python = process.env.PYTHON || 'python';
run(python, ['-c', 'import sys,zipfile,pathlib; src=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [(z.write(p,p.relative_to(src.parent))) for p in sorted(src.rglob("*")) if p.is_file()]; z.close()', stage, zip]);
const unpack = mkdtempSync(join(out, 'unpacked-'));
run(python, ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, unpack]);
const extracted = join(unpack, `moonmetamath-${version}`);
checkPackageLinks(extracted);
writeFileSync(join(unpack, 'mini.mm'), '$c |- a $. ax $a |- a $. th $p |- a $= ax $.');
writeFileSync(join(unpack, 'actions.json'), JSON.stringify({ schema_version: 1, actions: [{ operation: 'apply_label', label: 'ax' }, { operation: 'finish' }] }));
const checks = [];
for (const args of [
  ['--help'], ['--version'], ['verify', 'tests/fixtures/upstream/set-mm/hol.mm'],
  ['session', join(unpack, 'mini.mm'), '--theorem', 'th', '--actions', join(unpack, 'actions.json'), '--export', join(unpack, 'candidate.mm'), '--new-label', 'portable-proof'],
  ['verify', join(unpack, 'candidate.mm')],
]) {
  const result = spawnSync(process.execPath, ['bin/moonmetamath.mjs', ...args], {
    cwd: extracted, env: { ...process.env, MOON_HOME: 'unavailable', PATH: join(out, 'no-compiler') }, encoding: 'utf8',
  });
  checks.push({ args, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
  if (result.error || result.status !== 0) throw new Error(`Unpacked CLI failed: ${result.error?.message || result.stderr}`);
  if (args[0] === 'verify') {
    const response = JSON.parse(result.stdout);
    const expected = args[1].includes('hol.mm') ? 151 : 1;
    if (response.outcome !== 'valid' || response.data.verified_count !== expected) throw new Error('Unpacked proof verdict mismatch');
  }
  if (args[0] === 'session') {
    const response = JSON.parse(result.stdout);
    if (response.outcome !== 'valid' || response.operation !== 'export') throw new Error('Unpacked export failed');
  }
}
const sha256 = createHash('sha256').update(readFileSync(zip)).digest('hex');
writeFileSync(join(out, 'SHA256SUMS.txt'), `${sha256}  ${zip.split(/[\\/]/).at(-1)}\n`);
const result = { schema_version: 1, version, pass: true, documentLinks, archive: relative(root, zip), sha256, checks };
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, archive: result.archive, documentLinks: documentLinks.length, checks: checks.length }));
