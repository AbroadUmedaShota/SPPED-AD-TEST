const { test, expect } = require('@playwright/test');
const { LISTS } = require('./_screens');

/**
 * 幅を狭めたときの一覧の収まり。
 *
 * 方針は「横スクロールにせず、補助的な列を隠して収める」。基準は 1920px 表示で、
 * 13〜14 インチノート（1366px）までは容器内の横スクロールを出さない（2026-08-09 の判断）。
 * 照合結果一覧に会社名・納期区分を足した際、列を隠す閾値を据え置いたため
 * 1510〜1665px で溢れていた。同じ抜けを止めるための検査。
 */

const NOTEBOOK = 1366;

/** 指定幅で開く。openScreen は 1920px 固定なので使わない */
async function openAt(page, path, width, level) {
  await page.setViewportSize({ width, height: 1000 });
  if (level) {
    await page.addInitScript((l) => localStorage.setItem('adminMockLevel', l), level);
  }
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.pLevel === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(300);
}

const overflow = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  return el ? el.scrollWidth - el.clientWidth : -1;
}, id);

test.describe(`${NOTEBOOK}px で一覧が横スクロールしない`, () => {
  for (const list of LISTS) {
    test(`${list.name}`, async ({ page }) => {
      await openAt(page, list.path, NOTEBOOK);
      const over = await overflow(page, list.id);
      expect(over, `${list.name} が容器内で ${over}px 溢れている`).toBeLessThanOrEqual(1);
    });
  }

  test('データ入力対象一覧', async ({ page }) => {
    await openAt(page, '/03_admin/data-entry/index.html', NOTEBOOK);
    expect(await overflow(page, 'groupList')).toBeLessThanOrEqual(1);
  });
});

test.describe('照合結果一覧の段階的な列の間引き', () => {
  // 幅 → 見えているべき見出し（Lv4）
  const TIERS = [
    [1920, ['アンケートID', 'タイトル', '会社名', '納期区分', '会期', '総件数', '未入力', '一致', '不一致', '進捗', '納期日時', '操作']],
    [1600, ['アンケートID', 'タイトル', '会社名', '納期区分', '会期', '未入力', '進捗', '納期日時', '操作']],
    [1366, ['アンケートID', 'タイトル', '会社名', '納期区分', '未入力', '進捗', '納期日時', '操作']],
  ];

  for (const [w, want] of TIERS) {
    test(`${w}px では ${want.length} 列`, async ({ page }) => {
      await openAt(page, '/03_admin/reconciliation/index.html', w, 'lv4');
      const r = await page.evaluate(() => {
        const head = document.querySelector('#reconList .rc-line');
        const row = document.querySelector('#reconList [data-pg]');
        const shown = (el) => Array.from(el.children).filter((e) => getComputedStyle(e).display !== 'none');
        return {
          heads: shown(head).map((e) => e.textContent.replace(/\s*▲/, '').trim()),
          cols: getComputedStyle(head).gridTemplateColumns.split(' ').length,
          rowCells: shown(row).length,
          over: document.getElementById('reconList').scrollWidth - document.getElementById('reconList').clientWidth,
        };
      });
      expect(r.heads).toEqual(want);
      // 隠した列の分だけグリッドの定義も減らす。合っていないと残りの列がずれる
      expect(r.cols, 'グリッドの列数と見えている見出しの数が合わない').toBe(want.length);
      expect(r.rowCells, 'データ行のセル数が見出しと合わない').toBe(want.length);
      expect(r.over, `${w}px で ${r.over}px 溢れている`).toBeLessThanOrEqual(1);
    });
  }

  test('Lv2 は会社名の分だけ列が減り、各段階でずれない', async ({ page }) => {
    for (const w of [1920, 1600, 1366]) {
      await openAt(page, '/03_admin/reconciliation/index.html', w, 'lv2');
      const r = await page.evaluate(() => {
        const head = document.querySelector('#reconList .rc-line');
        const shown = Array.from(head.children).filter((e) => getComputedStyle(e).display !== 'none');
        return {
          hasClient: shown.some((e) => e.classList.contains('c-client')),
          cols: getComputedStyle(head).gridTemplateColumns.split(' ').length,
          shown: shown.length,
          over: document.getElementById('reconList').scrollWidth - document.getElementById('reconList').clientWidth,
        };
      });
      expect(r.hasClient, `Lv2 の ${w}px で会社名が出ている`).toBe(false);
      expect(r.cols, `${w}px で列数がずれている`).toBe(r.shown);
      expect(r.over, `Lv2 の ${w}px で ${r.over}px 溢れている`).toBeLessThanOrEqual(1);
    }
  });
});

test('1023px 以下ではサイドバーを引っ込める', async ({ page }) => {
  await openAt(page, '/03_admin/user-management.html', 1200);
  expect(await page.evaluate(
    () => Math.round(document.querySelector('#sidebar-placeholder > *').getBoundingClientRect().x)),
  ).toBe(0);

  await openAt(page, '/03_admin/user-management.html', 1023);
  const x = await page.evaluate(
    () => Math.round(document.querySelector('#sidebar-placeholder > *').getBoundingClientRect().x));
  expect(x, 'サイドバーが画面外へ退避していない').toBeLessThan(0);
});

test('どの幅でもページ全体が横スクロールしない', async ({ page }) => {
  for (const w of [1920, 1366, 1024, 768]) {
    for (const path of ['/03_admin/index.html', '/03_admin/reconciliation/index.html',
      '/03_admin/reconciliation/detail.html', '/03_admin/data-entry/form.html']) {
      await openAt(page, path, w);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${path} @${w}px でページが ${over}px 横に溢れている`).toBeLessThanOrEqual(1);
    }
  }
});

test.describe('2カラムの画面は狭くなったら1カラムへ積む', () => {
  const TWO_COL = [
    ['ユーザー詳細', '/03_admin/user-detail.html?id=U-1052'],
    ['アンケート詳細', '/03_admin/survey-detail.html?id=SV-10244'],
  ];

  const colCount = (page) => page.evaluate(
    () => getComputedStyle(document.querySelector('.admin-2col')).gridTemplateColumns.split(' ').length);

  for (const [name, url] of TWO_COL) {
    test(`${name}: 1920px は2カラム、1700px以下は1カラム`, async ({ page }) => {
      await openAt(page, url, 1920);
      expect(await colCount(page), '1920px で2カラムになっていない').toBe(2);

      for (const w of [1700, 1440, NOTEBOOK, 1024]) {
        await openAt(page, url, w);
        expect(await colCount(page), `${w}px で1カラムに積まれていない`).toBe(1);
      }
    });

    test(`${name}: どの幅でもカードの中身が枠から切れない`, async ({ page }) => {
      // overflow-x-hidden の内側なのでページスクロールにならず、はみ出しても気づけない。
      // 表の枠（div）が必要幅を確保できているかを直接見る
      for (const w of [1920, 1700, 1600, NOTEBOOK, 1280, 1024]) {
        await openAt(page, url, w);
        const over = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('#main-content div').forEach((e) => {
            const d = e.scrollWidth - e.clientWidth;
            if (d > 1 && e.clientWidth > 100) { out.push((e.id || '無名') + '+' + d + 'px'); }
          });
          return [...new Set(out)];
        });
        expect(over, `${name} @${w}px で中身が切れている: ${over.join(', ')}`).toEqual([]);
      }
    });
  }
});

test.describe('スマホ幅(390px)は最低限の閲覧に徹する(2026-08-19・05 §6.2)', () => {
  const PAGES = [
    '/03_admin/index.html',
    '/03_admin/user-management.html',
    '/03_admin/survey-management.html',
    '/03_admin/billing-management.html',
    '/03_admin/invoice-management.html',
    '/03_admin/coupon-management.html',
    '/03_admin/audit-log.html',
    '/03_admin/operator-management.html',
    '/03_admin/performance-management.html?tab=operators',
    '/03_admin/reconciliation/index.html',
    '/03_admin/data-entry/index.html',
  ];

  test('ページも一覧の内部も横スクロールしない', async ({ page }) => {
    for (const path of PAGES) {
      await openAt(page, path, 390);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, path + ' @390px でページが ' + over + 'px 溢れている').toBeLessThanOrEqual(1);
      // 情報を削る方針の検査: overflow-x:auto の一覧コンテナ内でもスクロールを出さない
      const inner = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('[id$="List"], #perfGroups, .dash-table, .dg-table').forEach((el) => {
          if (el.offsetParent === null) { return; }
          const d = el.scrollWidth - el.clientWidth;
          if (d > 1) { out.push((el.id || el.className) + '+' + d + 'px'); }
        });
        return out;
      });
      expect(inner, path + ' の一覧内部が溢れている: ' + inner.join(', ')).toEqual([]);
    }
  });

  test('ユーザー管理・アンケート管理は識別列だけ残る', async ({ page }) => {
    await openAt(page, '/03_admin/user-management.html', 390);
    const heads = await page.evaluate(() => [...document.querySelector('#usersList > div').children]
      .filter((c) => getComputedStyle(c).display !== 'none')
      .map((c) => c.textContent.replace(/[▲▼\s]+$/g, '').trim()));
    expect(heads).toEqual(['会社名', '氏名', '状態']);

    await openAt(page, '/03_admin/survey-management.html', 390);
    const heads2 = await page.evaluate(() => [...document.querySelector('#surveysList > div').children]
      .filter((c) => getComputedStyle(c).display !== 'none')
      .map((c) => c.textContent.replace(/[▲▼\s]+$/g, '').trim()));
    expect(heads2).toEqual(['タイトル', '作業ステータス', '納期日']);
  });
});
