const { test, expect } = require('@playwright/test');
const { SCREENS, openScreen } = require('./_screens');

/**
 * 2026-08-06 の通しレビューで人が目で見つけた指摘を、毎回走る検査にしたもの。
 *
 * まだ直していない項目は test.fail() を付けてある。「落ちるのが正しい」状態で、
 * 直すと不意に通って赤くなるので、そのとき注釈を外す。
 * どの項目かは docs/architecture/admin_architecture.json の findings（R-xx）と対応する。
 */

/** 画面に実際に出ている文字（タグの外側のテキスト） */
async function visibleText(page, path) {
  await openScreen(page, path);
  return page.locator('#main-content').innerText();
}

/** 全16画面の表示テキストを集める */
async function allText(page) {
  const out = {};
  for (const s of SCREENS) {
    out[s.name] = await visibleText(page, s.path);
  }
  return out;
}

test.describe('決着済みの用語（戻ったら落ちる）', () => {
  test('「例外対応」は使わない（2026-08-06 に「要注意操作」へ改称）', async ({ page }) => {
    test.slow();
    const texts = await allText(page);
    const hit = Object.entries(texts).filter(([, t]) => t.includes('例外対応')).map(([n]) => n);
    expect(hit, `旧称が残っている画面: ${hit.join(', ')}`).toEqual([]);
  });

  test('実在しそうな連絡先を画面に出さない', async ({ page }) => {
    test.slow();
    const texts = await allText(page);
    // モックで使ってよいのは架空のドメインと 03-1234 / 090-8765 系のダミーだけ。
    // 実在の名刺から拾った値が紛れ込むのを防ぐ
    const banned = [/@repinc\.co\.jp/, /s-umeda@/, /03-6895-\d{4}/, /03-5835-\d{4}/];
    const hit = [];
    for (const [name, t] of Object.entries(texts)) {
      for (const re of banned) {
        if (re.test(t)) { hit.push(`${name}: ${t.match(re)[0]}`); }
      }
    }
    expect(hit, `実在の連絡先らしき文字列: ${hit.join(' / ')}`).toEqual([]);
  });
});

test.describe('R-30 見出し階層', () => {
  for (const s of SCREENS) {
    test(`${s.name}: h1 がちょうど1つある`, async ({ page }) => {
      await openScreen(page, s.path);
      expect(await page.locator('h1').count()).toBe(1);
    });
  }
});

test.describe('R-24 画面内の遷移に矢印を使わない', () => {
  test('請求書管理の一覧に → が出ない', async ({ page }) => {
    const t = await visibleText(page, '/03_admin/invoice-management.html');
    expect(t).not.toContain('→');
  });

  test('新規タブで開くものだけ ↗ を付けてよい', async ({ page }) => {
    await openScreen(page, '/03_admin/invoice-management.html');
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#main-content a, #main-content button').forEach((el) => {
        if ((el.textContent || '').includes('↗') && el.getAttribute('target') !== '_blank') {
          out.push((el.textContent || '').trim().slice(0, 24));
        }
      });
      return out;
    });
    expect(bad, `別タブで開かないのに ↗ が付いている: ${bad.join(', ')}`).toEqual([]);
  });
});

test.describe('R-14 日付の書式', () => {
  // 未修正: 会期・最終ログインは年なし、作成日時・請求日は年あり。
  // 実際に混ざっているのはこの6画面だけ。他の画面は検査を有効にしたまま残す（退行を拾うため）
  const MIXED = ['ダッシュボード', 'ユーザー管理', 'ユーザー詳細', 'アンケート詳細', 'オペレーター管理', '照合結果一覧'];

  for (const s of SCREENS) {
    test(`${s.name}: 年ありと年なしの日付が混ざらない`, async ({ page }) => {
      test.fail(MIXED.includes(s.name));
      const t = await visibleText(page, s.path);
      const withYear = t.match(/20\d\d\/\d\d?\/\d\d?/g) || [];
      const withoutYear = (t.match(/(?<![\d/])\d{2}\/\d{2}(?![\d/])/g) || []);
      expect(
        withYear.length > 0 && withoutYear.length > 0,
        `年あり(${withYear.length}件) と 年なし(${withoutYear.length}件) が同じ画面にある`,
      ).toBe(false);
    });
  }

  test('ISO 形式（2026-08-08）と和式（2026年04月）を表示に使わない', async ({ page }) => {
    test.fail(); // 未修正: 営業日カレンダー2件・ユーザー詳細の請求月
    test.slow();
    const texts = await allText(page);
    const hit = [];
    for (const [name, t] of Object.entries(texts)) {
      if (/20\d\d-\d\d-\d\d/.test(t)) { hit.push(`${name}: ISO`); }
      if (/20\d\d年\d+月/.test(t)) { hit.push(`${name}: 和式`); }
    }
    expect(hit, hit.join(' / ')).toEqual([]);
  });
});

test.describe('R-15 / R-16 記号', () => {
  test('日本語の文中では全角の括弧を使う', async ({ page }) => {
    // 未着手: 半角が大多数で全角は7箇所だけ。どちらへ寄せるかは表記の方針決定が要る
    test.fail();
    test.slow();
    const texts = await allText(page);
    const hit = [];
    for (const [name, t] of Object.entries(texts)) {
      // 「(株)」は会社名の略記なので対象外。それ以外で 仮名/漢字 の直後に来る半角括弧を見る
      const m = t.replace(/\(株\)/g, '').match(/[ぁ-んァ-ヶ一-龥][()]/g);
      if (m) { hit.push(`${name}: ${m.length}件`); }
    }
    expect(hit, hit.join(' / ')).toEqual([]);
  });

  test('空欄の — と マイナスの − を取り違えない', async ({ page }) => {
    test.slow();
    const texts = await allText(page);
    // 金額・割合のマイナスは半角にする。全角マイナス(U+2212)は空欄の em dash と
    // 見分けが付かず、値が無いのか負の数なのか読めない。
    // 拡大縮小の「＋ / −」は全角のペアなので対象外（数字が続かない）
    const hit = [];
    for (const [name, t] of Object.entries(texts)) {
      const m = t.match(/−\s?[\d]/g);
      if (m) { hit.push(`${name}: ${m.join(' ')}`); }
    }
    expect(hit, `数値の前に全角マイナス: ${hit.join(' / ')}`).toEqual([]);
  });
});

test.describe('R-05 〜 R-13 用語の統一', () => {
  const CASES = [
    { id: 'R-05', label: '納期区分', words: ['納期区分', '申込プラン', 'データ化申込プラン', 'データ化の申込'] },
    { id: 'R-06', label: 'ログの呼称', words: ['操作ログ', '監査ログ'] },
    { id: 'R-10', label: 'ユーザーの呼称', words: ['ユーザー', '利用者'] },
  ];
  for (const c of CASES) {
    test(`${c.id} ${c.label}: 呼び方を1つに絞る`, async ({ page }) => {
      test.slow();
      const texts = await allText(page);
      const used = c.words.filter((w) => Object.values(texts).some((t) => t.includes(w)));
      expect(used, `${used.length}通りの呼び方が使われている: ${used.join(' / ')}`).toHaveLength(1);
    });
  }

  test('R-13 人を数える一覧は「名」で数える', async ({ page }) => {
    for (const path of ['/03_admin/user-management.html', '/03_admin/operator-management.html',
      '/03_admin/performance-management.html']) {
      const t = await visibleText(page, path);
      const m = /全\s*\d+\s*([件名])中\s*[\d〜]+\s*([件名])を表示/.exec(t);
      expect(m, `件数表示が読めない: ${path}`).not.toBeNull();
      expect([m[1], m[2]], `${path} が「件」で人を数えている`).toEqual(['名', '名']);
    }
  });

  test('R-07 サイドバーの項目名と、遷移先の画面名が一致する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    const links = await page.evaluate(() => [...document.querySelectorAll('#sidebar-placeholder a')]
      .map((a) => ({ label: (a.textContent || '').trim(), href: a.getAttribute('href') }))
      .filter((x) => x.label && x.href && !x.href.startsWith('#')));

    // 見出しは HTML に直書きなので、12画面を描画せず取得だけで足りる
    // （全部開くと並列実行のときに時間切れになる）
    const mismatch = [];
    for (const l of links) {
      const url = new URL(l.href, page.url()).href;
      const body = await (await page.request.get(url)).text();
      const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(body);
      const title = m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
      if (title && title !== l.label) { mismatch.push(`${l.label} → ${title}`); }
    }
    expect(mismatch.length, `サイドバーと画面名が違う: ${mismatch.join(' / ')}`).toBe(0);
  });
});

test.describe('R-27 / R-28 モーダルのキーボード操作', () => {
  const MODALS = [
    { screen: 'ユーザー管理', path: '/03_admin/user-management.html', open: 'button:has-text("ユーザーを招待")' },
    { screen: 'クーポン管理', path: '/03_admin/coupon-management.html', open: 'button:has-text("クーポンを作成")' },
    { screen: 'オペレーター管理', path: '/03_admin/operator-management.html', open: 'button:has-text("新規招待")' },
  ];

  for (const m of MODALS) {
    test(`${m.screen}: Tab がモーダルの外へ出ない`, async ({ page }) => {
      await openScreen(page, m.path);
      await page.click(m.open);
      await page.waitForTimeout(300);

      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
          const modal = [...document.querySelectorAll('.proto-modal')].find((x) => !x.hidden);
          return modal ? modal.contains(document.activeElement) : null;
        });
        expect(inside, `${i + 1} 回目の Tab でモーダルの外へ出た`).toBe(true);
      }
    });

    test(`${m.screen}: 開いた直後に実行系のボタンへフォーカスしない`, async ({ page }) => {
      await openScreen(page, m.path);
      await page.click(m.open);
      await page.waitForTimeout(300);
      const focused = await page.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName, text: (a.textContent || '').trim() };
      });
      const dangerous = /保存|送信|作成|実行|削除|停止/;
      expect(
        focused.tag === 'BUTTON' && dangerous.test(focused.text),
        `開いた直後のフォーカスが「${focused.text}」`,
      ).toBe(false);
    });
  }

  test('Esc で閉じ、開いたボタンへフォーカスが戻る', async ({ page }) => {
    await openScreen(page, MODALS[0].path);
    await page.click(MODALS[0].open);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => (document.activeElement.textContent || '').trim());
    expect(back).toContain('招待');
  });
});

test.describe('R-29 文字色のコントラスト（WCAG AA）', () => {
  for (const s of SCREENS.slice(0, 6)) {
    test(`${s.name}: 本文が 4.5:1 以上ある`, async ({ page }) => {
      test.fail(); // 未修正: 補助テキストの #8a93a5 が白背景で 3.09:1（308箇所で使用）
      await openScreen(page, s.path);
      const bad = await page.evaluate(() => {
        const lum = (c) => {
          const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const out = [];
        document.querySelectorAll('#main-content *').forEach((el) => {
          if (el.children.length || !(el.textContent || '').trim()) { return; }
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) { return; }
          const cs = getComputedStyle(el);
          let bg = cs.backgroundColor;
          let n = el;
          while (bg === 'rgba(0, 0, 0, 0)' && n.parentElement) { n = n.parentElement; bg = getComputedStyle(n).backgroundColor; }
          if (bg === 'rgba(0, 0, 0, 0)') { bg = 'rgb(255,255,255)'; }
          const l1 = lum(cs.color);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const px = parseFloat(cs.fontSize);
          const need = (px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700)) ? 3 : 4.5;
          if (ratio < need) { out.push(`${Math.round(ratio * 100) / 100}:1 ${cs.color} 「${(el.textContent || '').trim().slice(0, 18)}」`); }
        });
        return [...new Set(out)].slice(0, 3);
      });
      expect(bad, bad.join(' / ')).toEqual([]);
    });
  }
});

test.describe('R-19 〜 R-23 表示の読み取りやすさ', () => {
  test('R-19 請求管理のクーポン操作が、押すと何が起きるか読める', async ({ page }) => {
    await openScreen(page, '/03_admin/billing-management.html');
    const labels = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#billingList [data-pg]').forEach((r) => {
        const coupon = (r.getAttribute('data-f-coupon') || '').trim();
        const btn = [...r.querySelectorAll('button')].find((b) => /クーポン/.test(b.textContent));
        if (btn) { out.push({ coupon, label: btn.textContent.trim() }); }
      });
      return out;
    });
    expect(labels.length).toBeGreaterThan(0);
    for (const x of labels) {
      // 名詞1語（「クーポン」だけ）では何が起きるか分からない
      expect(x.label, 'ボタンが動詞になっていない').toMatch(/を(適用|変更)$/);
      const applied = x.coupon && x.coupon !== '—';
      expect(x.label, `クーポン=${x.coupon || 'なし'} の行のラベルが合っていない`)
        .toBe(applied ? 'クーポンを変更' : 'クーポンを適用');
    }
  });

  test('R-20 クーポン管理で使用回数とメモが離れている', async ({ page }) => {
    await openScreen(page, '/03_admin/coupon-management.html');
    // 淡色の期限切れ行だけ書き方が違って余白が当たらない、ということがあったので全行見る
    const rows = await page.evaluate(() => [...document.querySelectorAll('#couponList [data-pg]')].map((r) => {
      const cells = [...r.children];
      const used = cells[7].getBoundingClientRect();
      const memo = cells[8].getBoundingClientRect();
      return {
        id: cells[0].textContent.trim(),
        space: Math.round(memo.left - used.right) + parseFloat(getComputedStyle(cells[8]).paddingLeft),
        used: cells[7].textContent.trim(),
        memo: cells[8].textContent.trim(),
      };
    }));
    expect(rows.length).toBeGreaterThan(0);
    const tight = rows.filter((r) => r.space < 12);
    expect(tight.map((r) => `${r.id}「${r.used}${r.memo}」`), '使用回数とメモの間隔が狭い行').toEqual([]);
  });

  test('R-21 正答率の警告色にしきい値が書いてある', async ({ page }) => {
    const t = await visibleText(page, '/03_admin/performance-management.html');
    expect(t, 'しきい値の説明が画面に無い').toMatch(/95\s*%\s*未満/);
  });

  test('R-22 対応言語の制約の説明が1つだけ', async ({ page }) => {
    await openScreen(page, '/03_admin/survey-detail.html?id=SV-10259');
    const t = await page.locator('#main-content').innerText();
    const hits = (t.match(/3\s*言語まで/g) || []).length;
    expect(hits, `同じ制約が ${hits} 箇所に出ている`).toBe(1);
  });

  test('R-23 照合画面の色見本が凡例だと分かる', async ({ page }) => {
    await openScreen(page, '/03_admin/reconciliation/detail.html');
    const t = await page.locator('#main-content').innerText();
    expect(t, '色見本に「凡例」の断りが無く、押せる操作に見える').toContain('凡例');
  });
});

test.describe('R-25 検索欄のラベル', () => {
  for (const s of SCREENS) {
    test(`${s.name}: 入力欄に名前が付いている`, async ({ page }) => {
      await openScreen(page, s.path);
      const unnamed = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#main-content input:not([type=hidden]), #main-content select, #main-content textarea')
          .forEach((el) => {
            if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) { return; }
            if (el.id && document.querySelector(`label[for="${el.id}"]`)) { return; }
            if (el.closest('label')) { return; }
            out.push(el.tagName.toLowerCase() + ' placeholder=' + (el.getAttribute('placeholder') || '(なし)'));
          });
        return out;
      });
      expect(unnamed, `名前の無い入力欄: ${unnamed.join(', ')}`).toEqual([]);
    });
  }
});
