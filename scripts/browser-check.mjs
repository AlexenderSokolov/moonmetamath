import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { root } from './common.mjs';
import { assetHashes, webAssets, digest, validateBrowserEvidence } from './browser-receipt.mjs';
import { verify } from './oracle.mjs';

mkdirSync(join(root, 'artifacts'), { recursive: true });
const index = process.argv.indexOf('--out');
const out = index < 0 ? mkdtempSync(join(root, 'artifacts', 'browser-v03-')) : resolve(root, process.argv[index + 1]);
mkdirSync(out, { recursive: true });
const reportPath = join(out, 'results.json');
const remote = process.env.MOONMM_WEB_URL;
async function testedAssets() {
  if (!remote) return assetHashes();
  const base = new URL('../', remote.endsWith('/') ? remote : remote + '/');
  const hashes = {};
  for (const path of webAssets) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Cannot read tested public asset ${path}: ${response.status}`);
    hashes[path] = digest(Buffer.from(await response.arrayBuffer()));
  }
  return hashes;
}
const started = new Date().toISOString();
let failure = null;
try {
  const assets = await testedAssets();
  const run = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--reporter=json'], {
    cwd: root, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath, MOONMETAMATH_BROWSER_OUT: out },
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(out, 'runner.stdout.txt'), run.stdout || '');
  writeFileSync(join(out, 'runner.stderr.txt'), run.stderr || '');
  if (run.error || run.status !== 0) throw new Error(`Actual browser tests failed (${run.error?.message || run.status}); ${out}`);
  const bytes = readFileSync(reportPath);
  const checks = validateBrowserEvidence({ schema_version: 1, assets }, JSON.parse(bytes), assets);
  assert.deepEqual(await testedAssets(), assets, 'Build changed while browser tests ran');
  const candidate = join(out, 'downloads/browser-proof.mm');
  const independent = await verify(candidate, join(out, 'independent'));
  assert.equal(independent.status, 'valid', 'Downloaded browser proof rejected by independent verifier');
  const receipt = {
    schema_version: 1, kind: 'automated-browser', target: remote || 'local', started, finished: new Date().toISOString(),
    assets, checks, results: relative(root, reportPath), results_sha256: digest(bytes),
    download: relative(root, candidate), independent_result: relative(root, join(out, 'independent/result.json')),
  };
  writeFileSync(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
} catch (error) { failure = error.message; process.exitCode = 1; }
writeFileSync(join(out, 'result.json'), JSON.stringify({ pass: failure === null, failure }, null, 2) + '\n');
console.log(JSON.stringify({ pass: failure === null, failure, evidence: relative(root, out) }, null, 2));
