/**
 * 管理画面モック（03_admin）の到達16画面と一覧の定義。
 *
 * ここを正として admin-mock 配下の spec が回る。画面を足したらこの表に追記する。
 * 到達16画面 = index.html から辿れる画面。escalations.html と reconciliation/list.html は
 * 到達不能な旧画面のため対象外（docs/architecture/admin_architecture.json の F-10）。
 */

/** 到達16画面。path は baseURL からの相対、name は失敗時に読む用 */
const SCREENS = [
  { name: 'ダッシュボード', path: '/03_admin/index.html' },
  { name: 'ユーザー管理', path: '/03_admin/user-management.html' },
  { name: 'ユーザー詳細', path: '/03_admin/user-detail.html?id=U-1002' },
  { name: 'アンケート管理', path: '/03_admin/survey-management.html' },
  { name: 'アンケート詳細', path: '/03_admin/survey-detail.html?id=SV-10259' },
  { name: '請求管理', path: '/03_admin/billing-management.html' },
  { name: '請求書管理', path: '/03_admin/invoice-management.html' },
  { name: 'クーポン管理', path: '/03_admin/coupon-management.html' },
  { name: '営業日カレンダー', path: '/03_admin/calendar-management.html' },
  { name: 'オペレーター管理', path: '/03_admin/operator-management.html' },
  { name: 'オペレーター実績確認', path: '/03_admin/performance-management.html' },
  { name: '操作ログ', path: '/03_admin/audit-log.html' },
  { name: 'データ入力対象一覧', path: '/03_admin/data-entry/index.html' },
  { name: '名刺入力画面', path: '/03_admin/data-entry/form.html' },
  { name: '照合結果一覧', path: '/03_admin/reconciliation/index.html' },
  { name: '名刺情報照合', path: '/03_admin/reconciliation/detail.html' },
];

/**
 * 一覧を持つ9画面。
 * sortCol は並び替えの検証に使う列の index、numeric はその列を数として比べるか。
 */
const LISTS = [
  { name: 'ユーザー管理', path: '/03_admin/user-management.html', id: 'usersList', sortCol: 0, numeric: false },
  { name: 'アンケート管理', path: '/03_admin/survey-management.html', id: 'surveysList', sortCol: 5, numeric: true },
  { name: '請求管理', path: '/03_admin/billing-management.html', id: 'billingList', sortCol: 3, numeric: true },
  { name: '請求書管理', path: '/03_admin/invoice-management.html', id: 'invoiceList', sortCol: 5, numeric: true },
  { name: 'クーポン管理', path: '/03_admin/coupon-management.html', id: 'couponList', sortCol: 5, numeric: true },
  { name: '照合結果一覧', path: '/03_admin/reconciliation/index.html', id: 'reconList', sortCol: 0, numeric: false },
  { name: 'オペレーター管理', path: '/03_admin/operator-management.html', id: 'operatorsList', sortCol: 0, numeric: false },
  { name: 'オペレーター実績確認', path: '/03_admin/performance-management.html', id: 'perfList', sortCol: 3, numeric: true },
  { name: '操作ログ', path: '/03_admin/audit-log.html', id: 'auditList', sortCol: 0, numeric: false },
];

/** 画面を開き、描画とシェル注入の完了まで待つ */
async function openScreen(page, path) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') { errors.push('console: ' + m.text()); }
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  // networkidle は待ちが読めないので使わない。準備完了の合図は
  // 「admin.js が共通シェルを差し込み終えたか」で判断する
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const h = document.querySelector('#header-placeholder');
      return !!(h && h.children.length) && typeof window.pLevel === 'function';
    },
    null,
    { timeout: 15000 },
  );
  return errors;
}

module.exports = { SCREENS, LISTS, openScreen };
