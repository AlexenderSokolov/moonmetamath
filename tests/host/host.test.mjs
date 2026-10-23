import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('CLI help is directly usable without compiler', () => {
  const p = spawnSync(process.execPath, ['bin/moonmetamath.mjs', '--help'], {cwd:root, encoding:'utf8'});
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /verify.*FILE/);
});
test('CLI version identifies the published candidate', () => {
  const p = spawnSync(process.execPath, ['bin/moonmetamath.mjs', '--version'], {cwd:root, encoding:'utf8'});
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /0\.1\.0/);
});
