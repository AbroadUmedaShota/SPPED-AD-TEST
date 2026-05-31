const fs = require('fs');
const { test: setup } = require('@playwright/test');

/**
 * stg実機にログインし、権限レベル別に storageState を保存する。
 * 各 stg プロジェクトはこの state を再利用してログイン済み状態で開始する。
 * 認証情報は .env から取得（コミット禁止）。
 */
const STG = process.env.STG_BASE_URL || 'https://stg.speed-ad.com';
const AUTH = 'playwright/.auth';
fs.mkdirSync(AUTH, { recursive: true });

// 同一アカウント(abroadcrew02)を user と admin-lv4 で使うため、並行ログインのセッション競合を避けて直列実行する。
setup.describe.configure({ mode: 'serial' });

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`環境変数 ${name} が未設定です（.env を確認してください）`);
  return v;
}

async function userLogin(page, email, password) {
  await page.goto(`${STG}/login`);
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill(email);
  await page.getByRole('textbox', { name: 'パスワード' }).fill(password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function adminLogin(page, email, password) {
  await page.goto(`${STG}/admin/login`);
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill(email);
  await page.getByRole('textbox', { name: 'パスワード' }).fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('**/admin/top', { timeout: 20000 });
}

setup('authenticate user', async ({ page }) => {
  // ユーザー側（/login）の PW は管理者側と別。正しい USER_PASSWORD 提供後に有効化する。
  setup.skip(!process.env.USER_LOGIN_ENABLED, 'ユーザー側ログインPW未確定のため保留（USER_LOGIN_ENABLED=1 で有効化）');
  await userLogin(page, need('USER_EMAIL'), need('USER_PASSWORD'));
  await page.context().storageState({ path: `${AUTH}/user.json` });
});

setup('authenticate admin lv1', async ({ page }) => {
  await adminLogin(page, need('ADMIN_LV1_EMAIL'), need('ADMIN_LV1_PASSWORD'));
  await page.context().storageState({ path: `${AUTH}/admin-lv1.json` });
});

setup('authenticate admin lv2', async ({ page }) => {
  await adminLogin(page, need('ADMIN_LV2_EMAIL'), need('ADMIN_LV2_PASSWORD'));
  await page.context().storageState({ path: `${AUTH}/admin-lv2.json` });
});

setup('authenticate admin lv3', async ({ page }) => {
  await adminLogin(page, need('ADMIN_LV3_EMAIL'), need('ADMIN_LV3_PASSWORD'));
  await page.context().storageState({ path: `${AUTH}/admin-lv3.json` });
});

setup('authenticate admin lv4', async ({ page }) => {
  await adminLogin(page, need('ADMIN_LV4_EMAIL'), need('ADMIN_LV4_PASSWORD'));
  await page.context().storageState({ path: `${AUTH}/admin-lv4.json` });
});
