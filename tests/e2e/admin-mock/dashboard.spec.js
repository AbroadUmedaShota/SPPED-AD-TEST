/**
 * ダッシュボード（SCR-A-001）の数値カードを権限レベルごとに固定する。
 *
 * カードの集合と並びは `10_admin_dashboard.md` §4.2・§4.5・§6 が正。
 * 指標を足し引きしたときに仕様書側の表を直し忘れる事故が起きたため、
 * 実装と仕様書の両方をここで突き合わせる。
 */

const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');
const fs = require('fs');
const path = require('path');

const SPEC = path.join(__dirname, '..', '..', '..',
  'docs', 'リライト版仕様書', 'admin', '10_admin_dashboard.md');

/** 仕様書 §4.2 の順で並ぶ。Lv1 は先頭が「あなたが着手できる名刺件数」に置き換わる */
const EXPECTED = {
  lv1: ['あなたが着手できる名刺件数', '入力進捗率', '滞留している作業グループ'],
  lv2: ['入力待ちの名刺件数', '入力進捗率', '滞留している作業グループ',
    '照合待ちのアンケート数', '納期を過ぎたアンケート数', '本日が納期のアンケート数'],
  lv3: ['入力待ちの名刺件数', '入力進捗率', '滞留している作業グループ',
    '照合待ちのアンケート数', '納期を過ぎたアンケート数', '本日が納期のアンケート数',
    '招待・本登録未了のユーザー数', '新規ユーザー数', '新規アンケート数'],
};
EXPECTED.lv4 = EXPECTED.lv3;

/** 画面に出ているカードの指標名を並び順のまま取る */
async function cardNames(page) {
  return page.evaluate(() => [...document.querySelectorAll('.dash-card')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => {
      const t = (e.textContent || '').trim().replace(/\s+/g, ' ');
      // 先頭が指標名。続く数値・注記は見ない
      return t.replace(/[\d,]+\s*(件|名|%).*$/, '').trim();
    }));
}

test.describe('ダッシュボードの数値カード', () => {
  for (const lv of ['lv1', 'lv2', 'lv3', 'lv4']) {
    test(`${lv}: 仕様書どおりの指標が仕様書の順で並ぶ`, async ({ page }) => {
      await page.addInitScript((l) => {
        try { localStorage.setItem('adminMockLevel', l); } catch (e) { /* 既定で進む */ }
      }, lv);
      await openScreen(page, '/03_admin/index.html');
      expect(await cardNames(page)).toEqual(EXPECTED[lv]);
    });
  }

  test('Lv1 のカードは §4.5 の表と一致する', () => {
    const md = fs.readFileSync(SPEC, 'utf8');
    // §4.5 は本文の最後の小節。次に来るのは「## 5.」なので、そこで切る
    const sec = md.split('### 4.5')[1].split('\n## ')[0];
    const rows = [...sec.matchAll(/^\| ([^|]+?) \|/gm)].map((m) => m[1].trim())
      .filter((x) => x !== '指標' && !/^-+$/.test(x));
    expect(rows).toEqual(EXPECTED.lv1);
  });

  test('Lv2 のカードは §6 の表で「表示する」とした指標と一致する', () => {
    const md = fs.readFileSync(SPEC, 'utf8');
    const sec = md.split('## 6. 権限とデータ範囲')[1].split('## 7')[0];
    const shown = [...sec.matchAll(/^\| ([^|]+?) \| §4\.[0-9a-z]+ \| 表示する \|/gm)].map((m) => m[1].trim());
    expect(shown).toEqual(EXPECTED.lv2);
  });

  test('カードを押すと遷移先の画面へ移動する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const targets = await page.evaluate(() => [...document.querySelectorAll('.dash-card')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => {
        const a = e.tagName === 'A' ? e : e.querySelector('a');
        return a ? a.getAttribute('href') : (e.getAttribute('onclick') || null);
      }));
    expect(targets.filter((t) => !t), '遷移先の無いカードがある').toEqual([]);
  });
});
