import test from 'node:test';
import assert from 'node:assert/strict';

const { validateBrowserEvidence } = await import('../../scripts/browser-receipt.mjs').catch(() => ({}));
const ids = ['lifecycle', 'failed-switch', 'notebook', 'cancel', 'export'];
const results = { stats: { expected: 5, unexpected: 0, flaky: 0, skipped: 0 }, suites: [{ specs: ids.map(id => ({ title: id + ': actual browser behavior', tests: [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }] })) }] };
const assets = { 'web/app.mjs': 'a'.repeat(64) };

test('browser evidence rejects a receipt for different assets and skipped mandatory checks', () => {
  assert.equal(typeof validateBrowserEvidence, 'function');
  assert.deepEqual(validateBrowserEvidence({ schema_version: 1, assets }, results, assets), ids);
  assert.throws(() => validateBrowserEvidence({ schema_version: 1, assets }, results, { 'web/app.mjs': 'b'.repeat(64) }), /build|asset/i);
  const skipped = structuredClone(results);
  skipped.suites[0].specs[0].tests[0].results[0].status = 'skipped';
  assert.throws(() => validateBrowserEvidence({ schema_version: 1, assets }, skipped, assets), /passed|skipped/i);
  const missing = structuredClone(results);
  missing.suites[0].specs.pop();
  assert.throws(() => validateBrowserEvidence({ schema_version: 1, assets }, missing, assets), /export/);
  assert.throws(() => validateBrowserEvidence({ schema_version: 1, assets }, { ...results, stats: { ...results.stats, flaky: 1 } }, assets), /flaky|passed/i);
});
