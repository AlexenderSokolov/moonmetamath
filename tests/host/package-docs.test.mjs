import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { root } from '../../scripts/common.mjs';
import { packageDocs, checkPackageLinks } from '../../scripts/package-docs.mjs';

test('portable documentation includes valid local entry points and rejects missing targets', () => {
  assert.ok(checkPackageLinks(root).length > 0);
  const directory = mkdtempSync(join(root, 'artifacts', 'package-links-'));
  for (const file of packageDocs) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), '# Document\n');
  }
  writeFileSync(join(directory, 'README.md'), '[API](docs/API.md)\n');
  assert.equal(checkPackageLinks(directory).length, 1);
  writeFileSync(join(directory, 'docs/API.md'), '[Missing](missing.md)\n');
  assert.throws(() => checkPackageLinks(directory), /Broken packaged document link/);
});
