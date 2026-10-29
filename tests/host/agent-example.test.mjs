import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { root } from '../../scripts/common.mjs';

test('documented JavaScript example handles outcomes, recovers and releases both databases', () => {
  const run = spawnSync(process.execPath, ['examples/agent-client.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.pass, true);
  assert.equal(result.budget_outcome, 'resource_limit');
  assert.equal(result.source_outcome, 'valid');
  assert.equal(result.new_goal_outcome, 'incomplete');
  assert.equal(result.rejected_code, 'UnknownLabel');
  assert.equal(result.continued_steps, 2);
  assert.equal(result.closed_sessions, 2);
  assert.equal(result.unloaded_databases, 2);
  assert.match(result.proof, /fresh-export \$p t a \$= ax copy \$\./);
});
