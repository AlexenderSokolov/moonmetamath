import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const out = resolve(process.env.MOONMETAMATH_BROWSER_OUT || 'artifacts/v05-large-workbench');
async function ready(page, timeout = 30000) {
  await expect(page.locator('#activity')).not.toHaveClass(/busy/, { timeout });
  await expect(page.locator('#restart')).toBeEnabled();
}
async function recordRequests(page) {
  await page.addInitScript(() => {
    window.__requests = [];
    window.__workers = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); this.id = ++window.__workers; }
      postMessage(request, ...rest) {
        // Never retain large source strings or responses in the test observer.
        window.__requests.push({ operation: request.operation, limits: request.limits, worker: this.id,
          target_label: request.target_label, context_label: request.context_label, new_label: request.new_label, goal: request.goal });
        super.postMessage(request, ...rest);
      }
    };
  });
}
async function newGoal(page, label, goal, timeout = 30000) {
  await page.locator('.new-goal-details').evaluate((node) => { node.open = true; });
  await page.locator('#new-goal-label').fill(label);
  await page.locator('#new-goal-expression').fill(goal);
  await page.locator('#create-goal').click();
  await ready(page, timeout);
  await expect(page.locator('#target-label')).toHaveText(label);
}
async function apply(page, label, timeout = 30000) {
  await page.locator('#label').fill(label);
  await page.locator('#apply').click();
  await ready(page, timeout);
}

test('explicit operation budget reaches load, verify, start, replay, create and isolated schema1 restore', async ({ page }) => {
  await recordRequests(page);
  await page.goto(process.env.MOONMM_WEB_URL || '/web/');
  await ready(page);
  await expect(page.locator('#operation-budget')).toHaveValue('10000000');
  const initial = await page.evaluate(() => window.__requests);
  for (const row of initial.filter((row) => ['load', 'verify', 'start'].includes(row.operation))) {
    expect(row.limits).toEqual({ max_operations: 10000000 });
  }
  await page.locator('#operation-budget').selectOption('100000000');
  await page.evaluate(() => { window.__requests = []; });
  await page.locator('.upload > summary').click();
  await page.locator('#files').setInputFiles(resolve('examples/exercises/01-first-steps.mm'));
  await page.locator('#load-upload').click();
  await page.locator('.upload > summary').click();
  await ready(page);
  await page.locator('#replay-tab').click();
  await page.locator('#run-replay').click();
  await ready(page);
  await page.locator('#construct-tab').click();
  await newGoal(page, 'budget-goal', 'wff ph');
  await apply(page, 'wph');
  await page.locator('#finish').click();
  await ready(page);
  const downloaded = page.waitForEvent('download');
  await page.locator('#save-work').click();
  const download = await downloaded;
  await ready(page);
  const document = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(Object.keys(document).sort()).toEqual(['actions', 'completed', 'entry', 'schema_version', 'sources', 'target_label']);
  const before = await page.evaluate(() => window.__workers);
  await page.locator('#import-work').setInputFiles(await download.path());
  await ready(page);
  await expect(page.locator('#target-status')).toHaveText('构造已完成');
  expect(await page.evaluate(() => window.__workers)).toBeGreaterThan(before);
  const requests = await page.evaluate(() => window.__requests);
  for (const operation of ['load', 'verify', 'start', 'replay', 'create_goal']) {
    const rows = requests.filter((row) => row.operation === operation);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.limits).toEqual({ max_operations: 100000000 });
  }
  await page.locator('#import-work').setInputFiles({ name: 'unknown-field.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...document, limits: { max_operations: 100000000 } })) });
  await ready(page);
  await expect(page.locator('#notice')).toContainText('unknown fields');
  await expect(page.locator('#target-status')).toHaveText('构造已完成');
});

// Opt in explicitly. This test never downloads a database or changes the lock.
if (process.env.MOONMM_LARGE_WORKBENCH === '1') test('full-set: locked young2d context, original goal, proof construction and fresh-worker restore', async ({ page, browser }) => {
  test.setTimeout(30 * 60 * 1000);
  const timeout = 15 * 60 * 1000;
  const lock = JSON.parse(await readFile('benchmarks/databases.lock.json', 'utf8'));
  const source = lock.files.find((file) => file.id === 'set');
  const sourcePath = resolve(process.env.MOONMM_LARGE_SOURCE || source.path);
  const bytes = await readFile(sourcePath);
  expect(bytes.length).toBe(source.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
  await mkdir(out, { recursive: true });
  const timings = [];
  async function phase(name, action) {
    const start = Date.now();
    try { await action(); timings.push({ name, outcome: 'passed', duration_ms: Date.now() - start }); }
    catch (error) { timings.push({ name, outcome: 'failed', duration_ms: Date.now() - start, error: String(error) }); throw error; }
    finally { await writeFile(resolve(out, 'browser-phases.json'), JSON.stringify({ source, browser: browser.version(), timings }, null, 2)); }
  }
  await recordRequests(page);
  await page.goto(process.env.MOONMM_WEB_URL || '/web/');
  await ready(page);
  await page.locator('#operation-budget').selectOption('100000000');
  await phase('upload-and-verify', async () => {
    await page.locator('.upload').evaluate((node) => { node.open = true; });
    await page.locator('#files').setInputFiles(sourcePath);
    await page.locator('#load-upload').click();
    await ready(page, timeout);
    await expect(page.locator('#database-info')).toContainText('set.mm');
    await expect(page.locator('#report')).toContainText('验证通过');
    await expect(page.locator('#theorem-count')).toHaveText(String(source.expected_proofs));
    expect(await page.locator('.theorem-item').count()).toBeLessThanOrEqual(100);
  });
  await phase('young2d-context-query-preview', async () => {
    await page.locator('#search').fill(source.workload.target_label);
    await page.locator('.theorem-item').filter({ has: page.locator('code', { hasText: /^young2d$/ }) }).click();
    await ready(page, timeout);
    await page.locator('#rule-query').fill(source.workload.query);
    await page.locator('#find-rules').click();
    await ready(page, timeout);
    await expect(page.locator('.rule-item').first()).toBeVisible();
    await page.locator('#rule-query').fill('wph');
    await page.locator('#find-rules').click();
    await ready(page, timeout);
    await page.locator('.rule-item').filter({ has: page.locator('code', { hasText: /^wph$/ }) }).click();
    await page.locator('#preview-rule').click();
    await ready(page, timeout);
    await expect(page.locator('#preview-output')).toContainText('当前栈可执行');
    await expect(page.locator('#step-count')).toHaveText('0 步已确认');
  });
  const originalGoal = await page.locator('#goal').textContent();
  await phase('original-expression-create-goal', () => newGoal(page, 'moonmm-perf-goal-v1', originalGoal, timeout));
  await phase('construct-rewind-finish', async () => {
    await newGoal(page, 'moonmm-large-wph', 'wff ph', timeout);
    await apply(page, 'wph', timeout);
    await page.locator('#rewind').click();
    await ready(page, timeout);
    await expect(page.locator('#step-count')).toHaveText('0 步已确认');
    await apply(page, 'wph', timeout);
    await page.locator('#finish').click();
    await ready(page, timeout);
    await expect(page.locator('#target-status')).toHaveText('构造已完成');
  });
  const notebookPath = resolve(out, 'large-work.json');
  await phase('save-schema1', async () => {
    const event = page.waitForEvent('download', { timeout });
    await page.locator('#save-work').click();
    await (await event).saveAs(notebookPath);
    await ready(page, timeout);
  });
  await phase('fresh-worker-restore', async () => {
    const before = await page.evaluate(() => window.__workers);
    await page.locator('#import-work').setInputFiles(notebookPath);
    await ready(page, timeout);
    expect(await page.evaluate(() => window.__workers)).toBeGreaterThan(before);
    await expect(page.locator('#target-status')).toHaveText('构造已完成');
    await expect(page.locator('#step-count')).toHaveText('1 步已确认');
    await expect(page.locator('#notice')).toContainText('完成状态已再次检查');
    const visibleTheorems = await page.locator('.theorem-item').count();
    expect(visibleTheorems).toBeLessThanOrEqual(100);
    await writeFile(resolve(out, 'layout-result.json'), JSON.stringify({ total: source.expected_proofs, visibleTheorems }, null, 2));
  });
  await phase('export-after-restore', async () => {
    const steps = [];
    async function measured(name, action) {
      const begin = Date.now();
      const result = await action();
      steps.push({ name, duration_ms: Date.now() - begin });
      await writeFile(resolve(out, 'export-details.json'), JSON.stringify(steps, null, 2));
      return result;
    }
    await measured('fill-label', () => page.locator('#export-label').fill('moonmm-large-verified'));
    const event = page.waitForEvent('download', { timeout });
    await measured('click-export', () => page.locator('#export').click());
    const download = await measured('wait-download', () => event);
    await measured('save-file', () => download.saveAs(resolve(out, 'moonmm-large-verified.mm')));
    await measured('ready', () => ready(page, timeout));
    await measured('screenshot', () => page.screenshot({ path: resolve(out, 'browser-completed.png'), fullPage: false }));
  });
  await writeFile(resolve(out, 'browser-requests.json'), JSON.stringify(await page.evaluate(() => window.__requests), null, 2));
});
