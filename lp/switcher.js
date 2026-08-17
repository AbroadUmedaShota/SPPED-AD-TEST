/*
 * LPタイプ切替の歯車UI（lp/ 配下の各LPページ共通）。
 * window.__lpSwitcher('<currentKey>') を呼ぶと右下に歯車ボタンとメニューを挿入し、
 * 選択したバリアントへ location.href で遷移する。
 *
 * バリアントを増やすときは VARIANTS に1行足すだけ。group が同じものは
 * ひとつの見出しの下にまとまる（テーマ内で見せ方を並べるための区切り）。
 */
(function () {
  var VARIANTS = [
    { key: 'speed-ad',           group: '料金',   label: '事実型（現行）',   desc: '月額0円と料金の仕組みを軸に訴求',           href: '../speed-ad/index.html' },
    { key: 'compare',            group: '料金',   label: '他社比較型',       desc: '他社A〜Cとの費用・条件比較を軸に訴求',       href: '../compare/index.html' },
    { key: 'cost-simulator',     group: '料金',   label: 'シミュレーション型', desc: '枚数と速度プランを入れて概算費用を出す',   href: '../cost-simulator/index.html' },
    { key: 'cost-breakdown',     group: '料金',   label: '内訳分解型',       desc: '請求の3行を開いて、かからないものも出す',   href: '../cost-breakdown/index.html' },
    { key: 'cost-vs-now',        group: '料金',   label: '現状比較型',       desc: '紙と手入力の今と、費用がどこに乗るかを対比', href: '../cost-vs-now/index.html' },
    { key: 'cost-problem',       group: '料金',   label: '課題解決型',       desc: '料金で止まる4つの引っかかりと、その答え',   href: '../cost-problem/index.html' },

    { key: 'multilang',          group: '多言語', label: '事実型',           desc: '機能と料金の事実を並べる',                   href: '../multilang/index.html' },
    { key: 'multilang-vs-now',   group: '多言語', label: '現状比較型',       desc: '多言語対応なしの今と、入れたあとを場面別に', href: '../multilang-vs-now/index.html' },
    { key: 'multilang-timeline', group: '多言語', label: '時系列型',         desc: '会期前・会期中・会期後の順に追う',           href: '../multilang-timeline/index.html' },
    { key: 'multilang-problem',  group: '多言語', label: '課題解決型',       desc: 'よくある詰まり方4つと、その解き方',          href: '../multilang-problem/index.html' },
    { key: 'multilang-compare',  group: '多言語', label: '他社比較型',       desc: '他社の選択肢と同じ物差しで横並び',       href: '../multilang-compare/index.html' }
  ];

  var CSS = [
    '#lp-switcher { position: fixed; right: 24px; bottom: 24px; z-index: 99999; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif; }',
    '#lp-switcher .sw-gear { width: 56px; height: 56px; border: 1.5px solid #ee8500; border-radius: 999px; background: #171a21; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(20,22,28,.35); transition: background .18s ease; padding: 0; }',
    '#lp-switcher .sw-gear:hover { background: #2a2e38; }',
    '#lp-switcher .sw-gear svg { width: 26px; height: 26px; transition: transform .3s ease; }',
    '#lp-switcher .sw-gear[aria-expanded="true"] svg { transform: rotate(60deg); }',
    '#lp-switcher .sw-menu { display: none; width: 320px; max-height: 72vh; overflow-y: auto; background: #ffffff; border: 1px solid #ebe8e1; border-radius: 8px; box-shadow: 0 8px 28px rgba(20,22,28,.22); }',
    '#lp-switcher .sw-menu.open { display: block; }',
    '#lp-switcher .sw-head { position: sticky; top: 0; padding: 12px 16px; background: #f0ede5; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; color: #6f6b64; }',
    '#lp-switcher .sw-group { padding: 9px 16px 7px; background: #fbfaf8; border-top: 1px solid #eceae4; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #a29c92; }',
    '#lp-switcher .sw-item { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 12px 16px; border: 0; border-top: 1px solid #f2f0ea; background: #ffffff; cursor: pointer; text-align: left; font-family: inherit; font-size: 14px; font-weight: 700; letter-spacing: .5px; color: #1a1d24; line-height: 1.5; }',
    '#lp-switcher .sw-item:hover { background: #fbfaf8; }',
    '#lp-switcher .sw-check { width: 18px; flex-shrink: 0; color: #b35c00; font-weight: 900; visibility: hidden; }',
    '#lp-switcher .sw-item[aria-checked="true"] .sw-check { visibility: visible; }',
    '#lp-switcher .sw-item[aria-checked="true"] { background: #fdf6ec; }',
    '#lp-switcher .sw-item:focus-visible, #lp-switcher .sw-gear:focus-visible { outline: 2px solid #b35c00; outline-offset: -2px; }',
    '#lp-switcher .sw-desc { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 500; color: #6f6b64; }'
  ].join('\n');

  var GEAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3.2"></circle>' +
    '<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1.02-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.02H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z"></path>' +
    '</svg>';

  window.__lpSwitcher = function (currentKey) {
    if (document.getElementById('lp-switcher')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    /* group が変わるところに見出しを差し込む */
    var lastGroup = null;
    var itemsHtml = VARIANTS.map(function (v) {
      var head = '';
      if (v.group && v.group !== lastGroup) {
        head = '<div class="sw-group">' + v.group + '</div>';
        lastGroup = v.group;
      }
      var active = v.key === currentKey;
      return head +
        '<button type="button" class="sw-item" role="menuitemradio" aria-checked="' + (active ? 'true' : 'false') + '" data-href="' + v.href + '" data-active="' + active + '">' +
        '<span class="sw-check">✓</span>' +
        '<span>' + v.label + '<span class="sw-desc">' + v.desc + '</span></span>' +
        '</button>';
    }).join('');

    var wrap = document.createElement('div');
    wrap.id = 'lp-switcher';
    wrap.innerHTML =
      '<div class="sw-menu" role="menu" aria-label="LPタイプ切替">' +
      '<div class="sw-head">LPタイプを切り替え</div>' + itemsHtml + '</div>' +
      '<button type="button" class="sw-gear" aria-label="LPタイプを切り替え" aria-expanded="false" aria-haspopup="menu">' + GEAR_SVG + '</button>';
    document.body.appendChild(wrap);

    var gear = wrap.querySelector('.sw-gear');
    var menu = wrap.querySelector('.sw-menu');

    var items = Array.prototype.slice.call(wrap.querySelectorAll('.sw-item'));

    /* ロービングタブインデックス。メニュー内のタブストップは常に1つ */
    function setRoving(target) {
      items.forEach(function (b) { b.tabIndex = b === target ? 0 : -1; });
    }
    setRoving(items.filter(function (b) { return b.dataset.active === 'true'; })[0] || items[0]);

    function toggleMenu(open) {
      var willOpen = open !== undefined ? open : !menu.classList.contains('open');
      menu.classList.toggle('open', willOpen);
      gear.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) {
        var cur = items.filter(function (b) { return b.dataset.active === 'true'; })[0] || items[0];
        setRoving(cur);
        cur.focus();
      }
    }

    /* 矢印キー・Home/End での移動（role="menu" の作法に合わせる） */
    menu.addEventListener('keydown', function (e) {
      var i = items.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (e.key === 'ArrowDown') next = items[(i + 1) % items.length];
      else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length];
      else if (e.key === 'Home') next = items[0];
      else if (e.key === 'End') next = items[items.length - 1];
      if (!next) return;
      e.preventDefault();
      setRoving(next);
      next.focus();
    });

    gear.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(); });
    Array.prototype.forEach.call(wrap.querySelectorAll('.sw-item'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.dataset.active === 'true') { toggleMenu(false); return; }
        location.href = btn.dataset.href;
      });
    });
    document.addEventListener('click', function () { toggleMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !menu.classList.contains('open')) return;
      toggleMenu(false);
      gear.focus();   /* 閉じたらフォーカスを歯車へ戻す */
    });
  };
})();
