// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * SPEED AD E2E テスト設定。
 *
 * 静的モックを scripts/dev-server.py (port 8765) で配信し、その上で
 * 利用者導線を確認する。対象フローは
 * 99_backend-docs/08_e2e-testing/02_target-flows.md を参照。
 *
 * 環境変数 BASE_URL を渡すと dev/stg などの外部環境にも向けられる
 * （その場合 webServer は reuseExistingServer で起動をスキップ）。
 */
const PORT = 8765;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const useLocalServer = !process.env.BASE_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],

  // ローカル静的サーバー。BASE_URL 指定時は外部環境を使うため起動しない。
  webServer: useLocalServer
    ? {
        command: `python scripts/dev-server.py ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
      }
    : undefined,
});
