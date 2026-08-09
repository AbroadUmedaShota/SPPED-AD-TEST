/**
 * モーダルの振る舞いを全画面・全モーダルで確かめる。
 *
 * 到達16画面に45個あり、markup は個別に書かれている。役割・名前・Esc・
 * フォーカス復帰のどれかが1つ欠けても、その画面を開かない限り気付けない。
 */

const { test, expect } = require('@playwright/test');
const { SCREENS, openScreen } = require('./_screens');

/** その画面が持つモーダルの id */
async function modalIds(page) {
  return page.evaluate(() => [...document.querySelectorAll('.proto-modal[id]')].map((m) => m.id));
}

/** 開いて、役割・名前・フォーカス位置を見る */
async function openAndInspect(page, id) {
  return page.evaluate((i) => {
    if (typeof window.pCloseAll === 'function') { window.pCloseAll(); }
    const anchor = document.querySelector('#main-content button:not([disabled])');
    if (anchor) { anchor.focus(); }
    window.__before = document.activeElement;
    window.pOpen(i);
    const m = document.getElementById(i);
    if (getComputedStyle(m).display === 'none') { return { opened: false }; }
    const d = m.querySelector('.proto-dialog') || m;
    const by = d.getAttribute('aria-labelledby');
    const name = by
      ? ((document.getElementById(by) || {}).textContent || '').trim()
      : (d.getAttribute('aria-label') || '');
    return {
      opened: true,
      role: d.getAttribute('role') || '',
      modal: d.getAttribute('aria-modal') || '',
      name,
      focusInside: !!(document.activeElement && m.contains(document.activeElement)),
    };
  }, id);
}

for (const s of SCREENS) {
  test(`${s.name}: モーダルは役割と名前を持ち、Escで閉じてフォーカスが戻る`, async ({ page }) => {
    await openScreen(page, s.path);
    const ids = await modalIds(page);
    if (!ids.length) { test.skip(true, 'この画面にモーダルは無い'); }

    const bad = [];
    for (const id of ids) {
      const r = await openAndInspect(page, id);
      if (!r.opened) { bad.push(`${id}: 開かない`); continue; }
      if (r.role !== 'dialog') { bad.push(`${id}: role が "${r.role || 'なし'}"`); }
      if (r.modal !== 'true') { bad.push(`${id}: aria-modal が付いていない`); }
      // 名前が「×」だけ、空、極端に長い、のいずれもダイアログの名前として役に立たない
      if (!r.name || r.name.length < 2) { bad.push(`${id}: 名前が無い`); }
      if (/^[×✕✖\s]*$/.test(r.name)) { bad.push(`${id}: 名前が閉じる記号だけ`); }
      if (r.name.length > 60) { bad.push(`${id}: 名前が長すぎる(${r.name.length}字)`); }
      if (!r.focusInside) { bad.push(`${id}: 開いてもフォーカスが中に入らない`); }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(90);
      const closed = await page.evaluate((i) => getComputedStyle(document.getElementById(i)).display === 'none', id);
      if (!closed) {
        bad.push(`${id}: Esc で閉じない`);
        await page.evaluate(() => window.pCloseAll && window.pCloseAll());
        continue;
      }
      const back = await page.evaluate(() => document.activeElement === window.__before);
      if (!back) { bad.push(`${id}: 閉じたあとフォーカスが元へ戻らない`); }
    }
    expect(bad, `モーダルの不備\n${bad.join('\n')}`).toEqual([]);
  });
}

test('アンケート詳細のデータDLは開いている対象を指す', async ({ page }) => {
  for (const [id, title] of [['SV-10259', 'ITインフラEXPO'], ['SV-10244', 'マーケティングサミット']]) {
    await openScreen(page, `/03_admin/survey-detail.html?id=${id}`);
    await page.evaluate(() => window.pOpen('mDl'));
    const shown = await page.locator('#mDl [data-slot="dlSid"]').textContent();
    expect(shown, `${id} を開いているのに別の対象が出ている`).toContain(id);
    expect(shown).toContain(title);
  }
});
