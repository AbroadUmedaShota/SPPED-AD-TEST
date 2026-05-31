// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

/**
 * SPEED AD E2E テスト設定。
 *
 * 2系統を1つのconfigで扱う:
 *  - local : リポジトリの静的モックを dev-server.py で配信して確認（認証不要）
 *  - stg   : stg実機（https://stg.speed-ad.com）に対する正常系E2E（要ログイン）
 *
 * stg系は setup プロジェクトで権限レベル別に storageState を作成し、各プロジェクトで再利用する。
 * 認証情報は .env（gitignore）から読み込む（.env.example 参照）。
 *
 * 副作用ガード: 保存/送信/削除/確定などは spec 側で「直前で停止」し、
 * 破壊的操作は @destructive タグでデフォルト除外する（grepInvert）。
 */
const LOCAL_PORT = 8765;
const LOCAL_URL = `http://127.0.0.1:${LOCAL_PORT}`;
const STG = process.env.STG_BASE_URL || 'https://stg.speed-ad.com';
const AUTH = 'playwright/.auth';

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./tests/e2e/reporters/evidence-reporter.js'],
  ],

  use: {
    // 証跡を常に残す（運用ルール: スクショ＋URL＋ブラウザ＋日時をセットで残す）
    trace: 'on',
    screenshot: 'on',
    actionTimeout: 15000,
  },
  // @destructive を付けたテストは明示指定が無い限り実行しない
  grepInvert: process.env.RUN_DESTRUCTIVE ? undefined : /@destructive/,

  projects: [
    // --- ローカル静的モック（認証不要・dev-serverで配信）---
    {
      name: 'local',
      testIgnore: ['**/stg/**', '**/*.setup.js'],
      use: { ...devices['Desktop Chrome'], baseURL: LOCAL_URL },
    },

    // --- stg ログイン → 権限レベル別 storageState 生成 ---
    { name: 'setup', testMatch: /auth\.setup\.js/ },

    // --- stg ユーザー画面（企業ユーザー）---
    {
      name: 'stg-user',
      testMatch: '**/stg/user/**',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: STG, storageState: `${AUTH}/user.json` },
    },

    // --- stg 管理者画面（フル権限 Lv4 で一般確認）---
    {
      name: 'stg-admin',
      testMatch: '**/stg/admin/**',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: STG, storageState: `${AUTH}/admin-lv4.json` },
    },

    // --- stg 権限レベル別の到達範囲検証（BUG-ADM-04 回帰など）---
    {
      name: 'stg-perm-lv1',
      testMatch: '**/stg/perm/lv1.*',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: STG, storageState: `${AUTH}/admin-lv1.json` },
    },
    {
      name: 'stg-perm-lv2',
      testMatch: '**/stg/perm/lv2.*',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: STG, storageState: `${AUTH}/admin-lv2.json` },
    },
  ],

  // local プロジェクト用の静的サーバー（stg系は absolute baseURL を使うため無関係）
  webServer: {
    command: `python scripts/dev-server.py ${LOCAL_PORT}`,
    url: LOCAL_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
