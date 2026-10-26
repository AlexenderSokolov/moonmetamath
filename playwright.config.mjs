import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  outputDir: `${process.env.MOONMETAMATH_BROWSER_OUT || './artifacts/browser-v03'}/results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [['list'], ['json', { outputFile: `${process.env.MOONMETAMATH_BROWSER_OUT || 'artifacts/browser-v03'}/results.json` }]],
  use: { baseURL: process.env.MOONMM_WEB_URL || 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.MOONMM_WEB_URL ? undefined : { command: 'node scripts/serve.mjs --port 4173', url: 'http://127.0.0.1:4173/web/', reuseExistingServer: false },
});
