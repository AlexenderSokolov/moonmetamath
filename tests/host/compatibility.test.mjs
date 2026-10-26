import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coreClient, root } from '../../bin/host.mjs';
import { restoreNotebook } from '../../web/notebook.mjs';
import { verify } from '../../scripts/oracle.mjs';

const base = new URL('../fixtures/notebooks/v0.2.0/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
for (const sample of manifest.fixtures) {
  test(`frozen 0.2.0 ${sample.file} restores and retains independently exportable meaning`, async () => {
    const request = await coreClient();
    request({ operation: 'reset' });
    const saved = JSON.parse(readFileSync(new URL(sample.file, base), 'utf8'));
    const restored = await restoreNotebook(saved, request);
    assert.equal(restored.view.target_label, sample.target_label);
    assert.equal(restored.view.successful_step_count, sample.steps);
    assert.equal(restored.view.state, sample.state);
    assert.deepEqual(restored.view.stack, sample.stack);
    assert.deepEqual(restored.view.goal, sample.goal);
    if (sample.state === 'complete') {
      const exported = request({ operation: 'export', session_id: restored.session_id, new_label: 'compatibility-proof' });
      assert.equal(exported.outcome, 'valid');
      mkdirSync(join(root, 'artifacts'), { recursive: true });
      const out = mkdtempSync(join(root, 'artifacts', 'compatibility-'));
      const file = join(out, 'candidate.mm');
      writeFileSync(file, exported.data.text);
      assert.equal((await verify(file, join(out, 'independent'))).status, 'valid');
    }
  });
}

test('frozen notebook negative controls reject a future version and altered bytes before requests', async () => {
  const saved = JSON.parse(readFileSync(new URL(manifest.fixtures[0].file, base), 'utf8'));
  let calls = 0;
  const request = () => { calls++; throw new Error('must not contact core'); };
  await assert.rejects(restoreNotebook({ ...saved, schema_version: 2 }, request), /schema_version/);
  const corrupt = structuredClone(saved);
  corrupt.sources[0].text += ' altered';
  await assert.rejects(restoreNotebook(corrupt, request), /hash mismatch/);
  assert.equal(calls, 0);
});
