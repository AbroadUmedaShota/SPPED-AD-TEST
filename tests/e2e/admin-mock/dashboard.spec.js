/**
 * ダッシュボード（SCR-A-001）のブロック構成を権限レベルごとに固定する。
 *
 * 2026-08-13 に複数回のユーザー指示で再構成された。最終構成は以下:
 *   B. あなたの作業（Lv1のみ・無変更）
 *   C. 案件パイプライン（Lv2+・無変更、6カード）
 *   上段2カラム（Lv3+・.dash-2col、1680px未満は縦積み。DOM順=左→右）:
 *     - 会期前・新規作成アンケート（左・実在1件のみ）
 *     - 会期中・終了間際のアンケート（D・右・実在2件のみ、納期日は時刻なし）
 *   下段2カラム（.dash-2col、外枠はLv2+、内側の各表に個別のdata-min-lv。DOM順=左→右）:
 *     - 直近の新規登録ユーザー（左・Lv3+・登録日時降順5件）
 *     - 滞留している作業（右・Lv2+・復活。実在4件、進捗低い順、Lv2=IDのみ/Lv3+=タイトル併記）
 * 中間版にあった A本日の要対応 / F稼働と要員 / G顧客と請求 / 旧E(5行版の滞留している作業) は
 * このタイミングで削除・置き換えされた（実在データで埋まらない行を仕様として持たない方針への転換）。
 * ブロックを足し引きしたときにテストが追従し忘れる事故を防ぐため、
 * 表示/非表示・行数・行の並び・DOM順・主要導線をここで固定する。
 */

const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

/** シナリオLvを固定してからページを開く（proto-level.js の localStorage キー） */
async function setLevel(page, lv) {
  await page.addInitScript((l) => {
    try { localStorage.setItem('adminMockLevel', l); } catch (e) { /* 既定(lv4)で進む */ }
  }, lv);
}

/** 見出しテキストからブロックの表示状態を取る（各ブロックの見出しは .dash-sec で共通） */
async function blockVisible(page, heading) {
  return page.evaluate((h) => {
    const el = [...document.querySelectorAll('.dash-sec')]
      .find((e) => e.textContent.trim().startsWith(h));
    return !!el && el.offsetParent !== null;
  }, heading);
}

/** 表の行から onclick の遷移先を取り出す */
async function rowTargets(page, tableId) {
  return page.evaluate((id) => [...document.querySelectorAll(`#${id} .dash-trow`)]
    .filter((r) => r.offsetParent !== null)
    .map((r) => r.getAttribute('onclick') || ''), tableId);
}

const BLOCKS = {
  B: 'あなたの作業',
  C: '案件パイプライン',
  NS: '会期前・新規作成アンケート',
  D: '会期中・終了間際のアンケート',
  NU: '直近の新規登録ユーザー',
  STUCK: '滞留している作業',
};

/** Lvごとのブロック可視性。§本文の「Lv別見出し数」記載どおり */
const EXPECTED_BLOCKS = {
  lv1: { B: true, C: false, NS: false, D: false, NU: false, STUCK: false },
  lv2: { B: false, C: true, NS: false, D: false, NU: false, STUCK: true },
  lv3: { B: false, C: true, NS: true, D: true, NU: true, STUCK: true },
  lv4: { B: false, C: true, NS: true, D: true, NU: true, STUCK: true },
};

test.describe('ダッシュボードのブロック構成(2026-08-18 入金の確認を撤去)', () => {
  for (const lv of ['lv1', 'lv2', 'lv3', 'lv4']) {
    test(`${lv}: 6ブロックの表示/非表示が仕様どおり`, async ({ page }) => {
      await setLevel(page, lv);
      await openScreen(page, '/03_admin/index.html');
      const result = {};
      for (const [key, heading] of Object.entries(BLOCKS)) {
        result[key] = await blockVisible(page, heading);
      }
      expect(result).toEqual(EXPECTED_BLOCKS[lv]);
    });
  }

  test('Lv2では上段2カラム(会期前・新規作成アンケート/会期中・終了間際のアンケート)と直近の新規登録ユーザーが表示されない(滞留している作業は表示される)', async ({ page }) => {
    await setLevel(page, 'lv2');
    await openScreen(page, '/03_admin/index.html');
    expect(await blockVisible(page, BLOCKS.NS), '会期前・新規作成アンケートが出ている').toBe(false);
    expect(await blockVisible(page, BLOCKS.D), 'Dが出ている').toBe(false);
    expect(await blockVisible(page, BLOCKS.NU), '直近の新規登録ユーザーが出ている').toBe(false);
    expect(await blockVisible(page, BLOCKS.STUCK), '滞留している作業が出ていない').toBe(true);
  });

  const HEADING_COUNT = { lv1: 1, lv2: 2, lv3: 5, lv4: 5 };
  for (const [lv, n] of Object.entries(HEADING_COUNT)) {
    test(`${lv}: 見出し(.dash-sec)の可視数は${n}`, async ({ page }) => {
      await setLevel(page, lv);
      await openScreen(page, '/03_admin/index.html');
      const count = await page.locator('.dash-sec')
        .evaluateAll((els) => els.filter((e) => e.offsetParent !== null).length);
      expect(count).toBe(n);
    });
  }

  test('上段2カラムのDOM順は左=会期前・新規作成アンケート、右=会期中・終了間際のアンケート', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const order = await page.evaluate(() => [...document.querySelectorAll('.dash-sec')]
      .map((e) => e.textContent.trim())
      .filter((t) => t.startsWith('会期前・新規作成アンケート') || t.startsWith('会期中・終了間際のアンケート')));
    expect(order[0]).toMatch(/^会期前・新規作成アンケート/);
    expect(order[1]).toMatch(/^会期中・終了間際のアンケート/);
  });

  test('下段2カラムのDOM順は左=直近の新規登録ユーザー、右=滞留している作業', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const order = await page.evaluate(() => [...document.querySelectorAll('.dash-sec')]
      .map((e) => e.textContent.trim())
      .filter((t) => t.startsWith('直近の新規登録ユーザー') || t.startsWith('滞留している作業')));
    expect(order[0]).toMatch(/^直近の新規登録ユーザー/);
    expect(order[1]).toMatch(/^滞留している作業/);
  });
});

test.describe('案件パイプライン(C)のLv2/Lv3+切替(無変更ブロックの回帰確認)', () => {
  async function pipelineCards(page) {
    return page.evaluate(() => {
      const sec = [...document.querySelectorAll('.dash-sec')]
        .find((e) => e.textContent.startsWith('案件パイプライン'));
      const wrap = sec.closest('[data-min-lv]');
      return [...wrap.querySelectorAll('.dash-card')]
        .filter((c) => c.offsetParent !== null)
        .map((c) => ({
          label: (c.querySelector('.dash-card-label').textContent || '').replace(/\s+/g, ''),
          isStatic: c.classList.contains('dash-card-static'),
        }));
    });
  }

  test('Lv2は会期前・会期中が遷移なしの静的カードに切り替わる(6枚)', async ({ page }) => {
    await setLevel(page, 'lv2');
    await openScreen(page, '/03_admin/index.html');
    const cards = await pipelineCards(page);
    expect(cards).toHaveLength(6);
    const zenki = cards.find((c) => c.label.includes('会期前'));
    const kaikichu = cards.find((c) => c.label === '会期中');
    expect(zenki, '会期前カードが見つからない').toBeTruthy();
    expect(kaikichu, '会期中カードが見つからない').toBeTruthy();
    expect(zenki.isStatic, 'Lv2で会期前カードが静的化していない').toBe(true);
    expect(kaikichu.isStatic, 'Lv2で会期中カードが静的化していない').toBe(true);
  });

  for (const lv of ['lv3', 'lv4']) {
    test(`${lv}は会期前・会期中がアンケート管理へ遷移するカードになる(静的カードなし・6枚)`, async ({ page }) => {
      await setLevel(page, lv);
      await openScreen(page, '/03_admin/index.html');
      const cards = await pipelineCards(page);
      expect(cards).toHaveLength(6);
      expect(cards.filter((c) => c.isStatic), '静的カードが残っている').toEqual([]);
    });
  }
});

test.describe('会期中・終了間際のアンケート(D)', () => {
  test('全2件・終了が近い順(SV-10257→SV-10259)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html'); // 既定Lv4
    const targets = await rowTargets(page, 'dashSurveyTbl');
    const ids = targets.map((t) => (t.match(/id=(SV-\d+)/) || [])[1]);
    expect(ids).toEqual(['SV-10257', 'SV-10259']);
    const t = await page.locator('#dashSurveyTbl').innerText();
    expect(t).not.toContain('SV-10254');
    expect(t).not.toContain('SV-10248');
    expect(t).not.toContain('SV-10241');
  });

  test('行押下でアンケート詳細へ遷移する(SV-10257)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await page.locator('#dashSurveyTbl .dash-trow').first().click();
    await expect(page).toHaveURL(/\/survey-detail\.html\?id=SV-10257$/);
  });

  test('納期日に時刻が含まれない(時刻表記削除の回帰防止)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const dueTexts = await page.locator('#dashSurveyTbl .dash-trow > span:last-child')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(dueTexts).toEqual(['2026/08/05', '2026/08/03']);
    for (const t of dueTexts) {
      expect(t, `納期日に時刻が含まれている: ${t}`).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    }
  });
});

test.describe('会期前・新規作成アンケート(下段2カラム・新設)', () => {
  test('全1件(SV-10262)のみ', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const targets = await rowTargets(page, 'dashUpcomingSurveyTbl');
    const ids = targets.map((t) => (t.match(/id=(SV-\d+)/) || [])[1]);
    expect(ids).toEqual(['SV-10262']);
  });

  test('行押下でアンケート詳細へ遷移する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await page.locator('#dashUpcomingSurveyTbl .dash-trow').first().click();
    await expect(page).toHaveURL(/\/survey-detail\.html\?id=SV-10262$/);
  });

  test('下に「アンケート管理で全件表示」リンクがある', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const sec = page.locator('.dash-2col').locator('div', { has: page.locator('#dashUpcomingSurveyTbl') });
    await expect(sec.locator('a:has-text("アンケート管理で全件表示")')).toBeVisible();
  });
});

test.describe('直近の新規登録ユーザー(下段2カラム・新設)', () => {
  test('全5件・登録日時降順(U-1052→U-1051→U-1050→U-1049→U-1038)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const targets = await rowTargets(page, 'dashNewUsersTbl');
    const ids = targets.map((t) => (t.match(/id=(U-\d+)/) || [])[1]);
    expect(ids).toEqual(['U-1052', 'U-1051', 'U-1050', 'U-1049', 'U-1038']);
  });

  test('状態バッジが仕様どおり(有効/招待中/本登録未了/有効/停止)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const statuses = await page.locator('#dashNewUsersTbl .dash-trow .status-badge')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(statuses).toEqual(['有効', '招待中', '本登録未了', '有効', '停止']);
  });

  test('行押下でユーザー詳細へ遷移する(U-1052)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await page.locator('#dashNewUsersTbl .dash-trow').first().click();
    await expect(page).toHaveURL(/\/user-detail\.html\?id=U-1052$/);
  });

  test('下に「ユーザー管理で全件表示」リンクがある', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const sec = page.locator('.dash-2col').locator('div', { has: page.locator('#dashNewUsersTbl') });
    await expect(sec.locator('a:has-text("ユーザー管理で全件表示")')).toBeVisible();
  });
});

test.describe('滞留している作業(下段2カラム・復活)', () => {
  /** 行の先頭セルから、現在のLvで可視なテキストのSV-IDを取り出す */
  async function stuckRowIds(page) {
    return page.locator('#dashStuckTbl .dash-trow').evaluateAll((rows) => rows.map((r) => {
      const cell = r.querySelector('.dash-clamp2');
      const spans = [...cell.querySelectorAll('span')];
      const visible = spans.find((s) => s.offsetParent !== null) || cell;
      return (visible.textContent.match(/SV-\d+/) || [])[0];
    }));
  }

  test('全4件・進捗が低い順(SV-10236→SV-10238→SV-10233→SV-10244)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html'); // 既定Lv4
    const ids = await stuckRowIds(page);
    expect(ids).toEqual(['SV-10236', 'SV-10238', 'SV-10233', 'SV-10244']);
    const progress = await page.locator('#dashStuckTbl .dash-trow .dash-r strong')
      .evaluateAll((els) => els.map((e) => e.textContent.trim()));
    expect(progress).toEqual(['12%', '18%', '24%', '37%']);
  });

  test('Lv2はアンケートIDのみでタイトルは出さない', async ({ page }) => {
    await setLevel(page, 'lv2');
    await openScreen(page, '/03_admin/index.html');
    const t = await page.locator('#dashStuckTbl .dash-trow').first().innerText();
    expect(t).toContain('SV-10236');
    expect(t).not.toContain('スマート物流EXPO');
  });

  for (const lv of ['lv3', 'lv4']) {
    test(`${lv}はアンケートIDにタイトルを併記する`, async ({ page }) => {
      await setLevel(page, lv);
      await openScreen(page, '/03_admin/index.html');
      const t = await page.locator('#dashStuckTbl .dash-trow').first().innerText();
      expect(t).toContain('SV-10236');
      expect(t).toContain('スマート物流EXPO');
    });
  }

  test('経過26時間の行(SV-10236)だけ経過セルがwarn強調される', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const rows = page.locator('#dashStuckTbl .dash-trow');
    await expect(rows.nth(0).locator('.dash-warn-cell')).toHaveText('26時間');
    for (const i of [1, 2, 3]) {
      expect(await rows.nth(i).locator('.dash-warn-cell').count(), `${i}行目にwarn強調が付いている`).toBe(0);
    }
  });

  test('行押下でデータ入力対象一覧へ遷移する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await page.locator('#dashStuckTbl .dash-trow').first().click();
    await expect(page).toHaveURL(/\/data-entry\/index\.html$/);
  });

  test('下に「データ入力対象一覧へ」リンクがある', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const sec = page.locator('div:has(> #dashStuckTbl)');
    await expect(sec.locator('a:has-text("データ入力対象一覧へ")')).toBeVisible();
  });

  test('対象件数・納期は照合結果一覧(reconciliation)の同IDの表示値と一致する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const stuck = await page.evaluate(() => [...document.querySelectorAll('#dashStuckTbl .dash-trow')].map((r) => {
      const cells = [...r.children];
      const id = (cells[0].textContent.match(/SV-\d+/) || [])[0];
      return { id, target: cells[2].textContent.trim(), due: cells[6].textContent.trim() };
    }));
    expect(stuck).toHaveLength(4);

    await openScreen(page, '/03_admin/reconciliation/index.html');
    const recon = await page.evaluate(() => {
      const map = {};
      document.querySelectorAll('#reconList [data-pg]').forEach((r) => {
        const cells = [...r.children];
        map[r.getAttribute('data-f-sid')] = {
          total: cells[5].textContent.trim(),
          due: cells[10].textContent.trim(),
        };
      });
      return map;
    });

    for (const row of stuck) {
      const r = recon[row.id];
      expect(r, `照合結果一覧に${row.id}が無い`).toBeTruthy();
      expect(row.target, `${row.id} 対象件数`).toBe(r.total);
      const dueDate = (r.due.match(/^\d{4}\/\d{2}\/\d{2}/) || [])[0];
      expect(row.due, `${row.id} 納期`).toBe(dueDate);
    }
  });
});

test.describe('主要な導線', () => {
  test('あなたの作業(B)の「入力を開始」ボタンで名刺入力画面へ遷移する(Lv1)', async ({ page }) => {
    await setLevel(page, 'lv1');
    await openScreen(page, '/03_admin/index.html');
    await page.click('.dash-start-btn');
    await expect(page).toHaveURL(/\/data-entry\/form\.html$/);
  });

  test('案件パイプライン(C)の照合待ちカードで照合結果一覧へ遷移する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await page.locator('.dash-card', { hasText: '照合待ち' }).first().click();
    await expect(page).toHaveURL(/\/reconciliation\/index\.html$/);
  });
});

test.describe('廃止された旧構成の要素が残っていない', () => {
  test('旧ブロック見出しが出ない(本日の要対応/稼働と要員/顧客と請求/運用状況サマリ/新規発生の状況/名刺データ化申込状況/現在会期中のアンケート一覧)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const t = await page.locator('#main-content').innerText();
    const banned = [
      '本日の要対応', '稼働と要員', '顧客と請求',
      '運用状況サマリ', '新規発生の状況', '名刺データ化申込状況', '現在会期中のアンケート一覧',
    ];
    const hit = banned.filter((w) => t.includes(w));
    expect(hit, `旧見出しが残っている: ${hit.join(' / ')}`).toEqual([]);
  });

  test('#dashTodo(本日の要対応)が存在しない(滞留している作業#dashStuckTblは復活済みのため対象外)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    expect(await page.locator('#dashTodo').count()).toBe(0);
    expect(await page.locator('#dashStuckTbl').count()).toBe(1);
  });

  test('名刺データ化申込状況の累計表(.tbl-plans)が存在しない', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    expect(await page.locator('.tbl-plans').count()).toBe(0);
  });

  test('クーポンへの単独ショートカット(カード・行・リンク)が無い', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const t = await page.locator('#main-content').innerText();
    expect(t).not.toContain('クーポン');
    const links = await page.evaluate(() => [...document.querySelectorAll('[onclick]')]
      .map((e) => e.getAttribute('onclick'))
      .filter((v) => /coupon-management/.test(v)));
    expect(links).toEqual([]);
  });

  test('監査ログへの遷移導線が無い(A本日の要対応の廃止に伴い0件)', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const auditLinks = await page.evaluate(() => [...document.querySelectorAll('[onclick]')]
      .map((e) => e.getAttribute('onclick'))
      .filter((v) => /audit-log\.html/.test(v)));
    expect(auditLinks, `監査ログへの遷移が${auditLinks.length}箇所ある(0件が正)`).toEqual([]);
  });
});

test.describe('再取得ボタン', () => {
  test('押すと取得中表示を経て集計最終更新の時刻が進む', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const before = await page.locator('#dashUpdated').innerText();
    const btn = page.locator('.dash-refresh');
    await btn.click();
    await expect(btn).toHaveText('取得中…');
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('↻ 再取得');
    const after = await page.locator('#dashUpdated').innerText();
    expect(after, '集計最終更新が進んでいない').not.toBe(before);
  });
});
