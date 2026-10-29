import { test, expect } from '@playwright/test';

async function ready(page) {
  await expect(page.locator('#activity')).not.toHaveClass(/busy/);
  await expect(page.locator('#restart')).toBeEnabled();
}

async function hol(page) {
  await page.goto(process.env.MOONMM_WEB_URL || '/web/');
  await ready(page);
  await page.locator('#builtin').selectOption('hol');
  await page.locator('#load-builtin').click();
  await ready(page);
  await expect(page.locator('#theorem-count')).toHaveText('151');
}

test('theorem pages bound DOM, search all metadata and reset after reload', async ({ page }) => {
  await hol(page);
  await expect(page.locator('#theorems .theorem-item')).toHaveCount(100);
  await expect(page.locator('#theorems-page')).toHaveText('1 / 2 页 · 151 条');
  await page.locator('#theorems-next').click();
  await expect(page.locator('#theorems .theorem-item')).toHaveCount(51);
  await expect(page.locator('#theorems-next')).toBeDisabled();
  const label = await page.locator('#theorems .theorem-item code').last().textContent();
  await page.locator('#theorems-prev').click();
  await page.locator('#search').fill(label);
  await expect(page.locator('#theorems .theorem-item code').filter({ hasText: label })).toBeVisible();
  await expect(page.locator('#theorem-count')).toHaveText('151');
  await expect(page.locator('#theorems-prev')).toBeDisabled();
  await page.locator('#search').fill('');
  await expect(page.locator('#theorems-page')).toHaveText('1 / 2 页 · 151 条');
  await page.locator('#theorems-next').click();
  await page.locator('#load-builtin').click();
  await ready(page);
  await expect(page.locator('#theorems-page')).toHaveText('1 / 2 页 · 151 条');
  await expect(page.locator('#theorems .theorem-item')).toHaveCount(100);
});

test('restoring a target reveals its theorem page without rendering the whole database', async ({ page }) => {
  await hol(page);
  await page.locator('#theorems-next').click();
  const target = await page.locator('#theorems .theorem-item code').first().textContent();
  await page.locator('#theorems .theorem-item').first().click();
  await ready(page);
  await expect(page.locator('#target-label')).toHaveText(target);
  await expect(page.locator('#theorems-page')).toHaveText('2 / 2 页 · 151 条');
  const saved = page.waitForEvent('download');
  await page.locator('#save-work').click();
  const file = await (await saved).path();
  await ready(page);
  await page.locator('#load-builtin').click();
  await ready(page);
  await page.locator('#import-work').setInputFiles(file);
  await ready(page);
  await expect(page.locator('#target-label')).toHaveText(target);
  await expect(page.locator('#theorems-page')).toHaveText('2 / 2 页 · 151 条');
  await expect(page.locator('#theorems .theorem-item')).toHaveCount(51);
  await expect(page.locator('#theorems .theorem-item[aria-pressed="true"] code')).toHaveText(target);
});
