import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const downloads = resolve(process.env.MOONMETAMATH_BROWSER_OUT || 'artifacts/browser-v03', 'downloads');

async function ready(page) {
  await expect(page.locator('#activity')).not.toHaveClass(/busy/);
  await expect(page.locator('#restart')).toBeEnabled();
}
async function apply(page, label) {
  await page.locator('#label').fill(label);
  await page.locator('#apply').click();
  await ready(page);
}
async function exercise(page) {
  await page.goto(process.env.MOONMM_WEB_URL || '/web/');
  await ready(page);
  await page.locator('#builtin').selectOption('01-first-steps');
  await page.locator('#load-builtin').click();
  await ready(page);
  await expect(page.locator('#target-label')).toHaveText('first-steps');
}

test.beforeEach(async ({ page }) => {
  // Keep the actual browser Worker and core. Faults alter one request sent to
  // the real core; delays retain a real response so late delivery is testable.
  await page.addInitScript(() => {
    window.__wireTest = { fail: null, delay: null, held: [], operations: [] };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(request, ...rest) {
        window.__wireTest.operations.push(request.operation);
        if (window.__wireTest.fail === request.operation) {
          window.__wireTest.fail = null;
          request = { ...request, ...(request.operation === 'start' ? { target_label: 'missing-target' } : { database_id: 'missing-database' }) };
        }
        super.postMessage(request, ...rest);
      }
      addEventListener(type, listener, ...rest) {
        if (type !== 'message') return super.addEventListener(type, listener, ...rest);
        super.addEventListener(type, (event) => {
          if (window.__wireTest.delay === event.data.operation) {
            window.__wireTest.delay = null;
            window.__wireTest.held.push(() => listener(event));
          } else listener(event);
        }, ...rest);
      }
    };
  });
});

test('lifecycle: more than 64 restarts release old sessions and remain usable', async ({ page }) => {
  await exercise(page);
  for (let i = 0; i < 70; i++) {
    await page.locator('#restart').click();
    await ready(page);
    await expect(page.locator('#notice')).toBeHidden();
  }
  await apply(page, 'wph');
  await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  expect(await page.evaluate(() => window.__wireTest.operations.filter((op) => op === 'close_session').length)).toBeGreaterThanOrEqual(70);
});

test('failed-switch: target start or rule lookup retains stack, actions and current continuation', async ({ page }) => {
  await exercise(page);
  await apply(page, 'wph');
  for (const operation of ['start', 'rules']) {
    await page.evaluate((op) => { window.__wireTest.fail = op; }, operation);
    await page.locator('#restart').click();
    await ready(page);
    await expect(page.locator('#notice')).toBeVisible();
    await expect(page.locator('#target-label')).toHaveText('first-steps');
    await expect(page.locator('#step-count')).toHaveText('1 步已确认');
    await expect(page.locator('#stack')).toContainText('wff ph');
  }
  await apply(page, 'identity');
  await page.locator('#finish').click();
  await ready(page);
  await expect(page.locator('#target-status')).toHaveText('构造已完成');
});

test('failed-switch: a malformed uploaded database preserves the current worker and proof', async ({ page }) => {
  await exercise(page);
  await apply(page, 'wph');
  await page.locator('.upload > summary').click();
  await page.locator('#files').setInputFiles({ name: 'broken.mm', mimeType: 'text/plain', buffer: Buffer.from('$c unterminated') });
  await page.locator('#load-upload').click();
  await ready(page);
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#target-label')).toHaveText('first-steps');
  await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  await apply(page, 'identity');
  await page.locator('#finish').click();
  await ready(page);
  await expect(page.locator('#target-status')).toHaveText('构造已完成');
});

test('lifecycle: new-goal candidates release failed databases and successful old owners', async ({ page }) => {
  await exercise(page);
  await apply(page, 'wph');
  await page.locator('.new-goal-details > summary').click();
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => { window.__wireTest.fail = 'rules'; });
    await page.locator('#new-goal-label').fill(`failed-${i}`);
    await page.locator('#create-goal').click();
    await ready(page);
    await expect(page.locator('#target-label')).toHaveText('first-steps');
    await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  }
  for (let i = 0; i < 18; i++) {
    await page.locator('#new-goal-label').fill(`created-${i}`);
    await page.locator('#create-goal').click();
    await ready(page);
    await expect(page.locator('#target-label')).toHaveText(`created-${i}`);
    await expect(page.locator('#notice')).toHaveClass(/info/);
  }
  await apply(page, 'wph');
  expect(await page.evaluate(() => window.__wireTest.operations.filter((op) => op === 'unload_database').length)).toBeGreaterThanOrEqual(36);
});

test('notebook: save, restore and bad restore preserve replayable work; export: downloaded completed proof', async ({ page }) => {
  await exercise(page);
  await apply(page, 'wph');
  await mkdir(downloads, { recursive: true });
  const savedEvent = page.waitForEvent('download');
  await page.locator('#save-work').click();
  const saved = await savedEvent;
  const partialPath = resolve(downloads, 'partial-work.json');
  await saved.saveAs(partialPath);
  await ready(page);
  await page.locator('#restart').click();
  await ready(page);
  await page.locator('#import-work').setInputFiles(partialPath);
  await ready(page);
  await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  const document = JSON.parse(await readFile(partialPath, 'utf8'));
  for (const bad of [{ ...document, schema_version: 999 }, { ...document, actions: [{ operation: 'apply_label', label: 'missing-label' }] }]) {
    await page.locator('#import-work').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await ready(page);
    await expect(page.locator('#notice')).toBeVisible();
    await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  }
  await apply(page, 'identity');
  await page.locator('#finish').click();
  await ready(page);
  const completeEvent = page.waitForEvent('download');
  await page.locator('#save-work').click();
  const complete = await completeEvent;
  const completePath = resolve(downloads, 'complete-work.json');
  await complete.saveAs(completePath);
  await ready(page);
  await page.locator('#restart').click();
  await ready(page);
  await page.locator('#import-work').setInputFiles(completePath);
  await ready(page);
  await expect(page.locator('#target-status')).toHaveText('构造已完成');
  await page.locator('#export-label').fill('browser-proof');
  const proofEvent = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await proofEvent).saveAs(resolve(downloads, 'browser-proof.mm'));
  await ready(page);
  await expect(page.locator('#notice-content')).toContainText('已生成下载文件');
});

for (const operation of ['start', 'rules', 'apply_label', 'create_goal', 'load']) {
  test(`cancel: ${operation} cannot resurrect state after its real response arrives late`, async ({ page }) => {
    await exercise(page);
    await page.evaluate((op) => { window.__wireTest.delay = op; }, operation);
    if (operation === 'apply_label') {
      await page.locator('#label').fill('wph');
      await page.locator('#apply').click();
    } else if (operation === 'create_goal') {
      await page.locator('.new-goal-details > summary').click();
      await page.locator('#create-goal').click();
    } else if (operation === 'load') await page.locator('#load-builtin').click();
    else await page.locator('#restart').click();
    await expect.poll(() => page.evaluate(() => window.__wireTest.held.length)).toBe(1);
    await page.locator('#cancel').click();
    await expect(page.locator('#restart')).toBeDisabled();
    await expect(page.locator('#apply')).toBeDisabled();
    await expect(page.locator('#activity')).not.toHaveClass(/busy/);
    await expect(page.locator('#step-count')).toHaveText('0 步已确认');
    await page.locator('#load-builtin').click();
    await ready(page);
    await apply(page, 'wph');
    await page.evaluate(() => { for (const deliver of window.__wireTest.held.splice(0)) deliver(); });
    await expect(page.locator('#step-count')).toHaveText('1 步已确认');
  });
}

test('cancel: notebook candidate cannot replace a newer worker after delayed verification', async ({ page }) => {
  await exercise(page);
  await apply(page, 'wph');
  const savedEvent = page.waitForEvent('download');
  await page.locator('#save-work').click();
  await savedEvent;
  await ready(page);
  await page.evaluate(() => { window.__wireTest.delay = 'verify'; });
  await page.locator('#restore-last').click();
  await expect.poll(() => page.evaluate(() => window.__wireTest.held.length)).toBe(1);
  await page.locator('#cancel').click();
  await expect(page.locator('#apply')).toBeDisabled();
  await page.locator('#load-builtin').click();
  await ready(page);
  await page.evaluate(() => { for (const deliver of window.__wireTest.held.splice(0)) deliver(); });
  await expect(page.locator('#step-count')).toHaveText('0 步已确认');
  await apply(page, 'wph');
  await expect(page.locator('#step-count')).toHaveText('1 步已确认');
});

test('lifecycle: active worker runtime errors remain visible after invalidation', async ({ page }) => {
  await page.route('**/web/worker.mjs', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: `${source}\nself.addEventListener('message', ({ data }) => {
      if (data.operation === 'apply_label') throw new Error('worker-runtime-regression');
    });\n` });
  });
  await exercise(page);
  await page.evaluate(() => { window.__wireTest.delay = 'apply_label'; });
  await page.locator('#label').fill('wph');
  await page.locator('#apply').click();
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#notice-content')).toContainText('内核启动或运行失败');
  await expect(page.locator('#notice-content')).toContainText('worker-runtime-regression');
  await expect(page.locator('#restart')).toBeDisabled();
  await expect(page.locator('#apply')).toBeDisabled();
  await expect(page.locator('#activity')).not.toHaveClass(/busy/);
});
