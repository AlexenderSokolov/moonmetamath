import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { root } from './common.mjs';

export const webAssets = [
  'web/index.html', 'web/app.mjs', 'web/worker.mjs', 'web/notebook.mjs', 'web/style.css',
  'dist/moonmetamath-core.mjs',
  'tests/fixtures/upstream/set-mm/demo0.mm', 'tests/fixtures/upstream/set-mm/miu.mm', 'tests/fixtures/upstream/set-mm/hol.mm',
  'examples/exercises/01-first-steps.mm', 'examples/exercises/02-essential-hypothesis.mm', 'examples/exercises/03-disjoint.mm',
];
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function assetHashes() {
  return Object.fromEntries(webAssets.map(path => [path, digest(readFileSync(join(root, path)))]));
}
const required = ['lifecycle', 'failed-switch', 'notebook', 'cancel', 'export'];
export function validateBrowserEvidence(receipt, results, currentAssets = assetHashes()) {
  assert.equal(receipt.schema_version, 1, 'Unsupported browser receipt');
  assert.deepEqual(receipt.assets, currentAssets, 'Browser evidence does not identify this build/assets');
  assert.equal(results.stats?.unexpected, 0, 'Browser suite must have passed');
  assert.equal(results.stats?.skipped, 0, 'Browser suite must have no skipped tests');
  assert.equal(results.stats?.flaky, 0, 'Browser suite must have no flaky tests');
  const found = new Set();
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      assert.ok(spec.tests?.length, 'Missing actual browser test');
      for (const test of spec.tests) {
        assert.equal(test.status, 'expected', 'Browser test must have passed');
        assert.equal(test.expectedStatus, 'passed', 'Browser failure is not an accepted test');
        assert.equal(test.results?.length, 1, 'Expected a single browser attempt');
        assert.equal(test.results[0].status, 'passed', 'Browser test must have passed, not skipped');
      }
      for (const id of required) if (new RegExp(`(?:^|\\s)${id}:`).test(spec.title)) found.add(id);
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  visit(results);
  for (const id of required) assert.ok(found.has(id), `Missing mandatory browser check: ${id}`);
  return required;
}

export function readBrowserEvidence(receiptPath) {
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.target, 'local', 'Local acceptance requires a local build receipt');
  const bytes = readFileSync(join(root, receipt.results));
  assert.equal(digest(bytes), receipt.results_sha256, 'Browser report changed');
  validateBrowserEvidence(receipt, JSON.parse(bytes));
  const independent = JSON.parse(readFileSync(join(root, receipt.independent_result), 'utf8'));
  assert.equal(independent.status, 'valid', 'Browser export not independently verified');
  assert.equal(digest(readFileSync(join(root, receipt.download))), independent.inputSha256, 'Browser export bytes changed');
  return receipt;
}
