/* =====================================================================
   Lettering Tools — 「SPEED AD」レタリング当てはめ確認ツール（開発者向け）
   起動: URL に ?lettering=1 が付いている時だけ歯車が出る。
   完全クライアントサイド・揮発（リロードで消える／保存しない）。
   撤去: このファイルと css/lettering-tools.css を削除し、index.html の
        <link>/<script> 2行を消すだけ。本番に残留なし。

   できること:
   - ヘッダー / ヒーロー / フッターの「SPEED AD」テキストに SVG・PNG を重ねる
     （アップロードするとその箇所の元テキストは隠れる）
   - 同じ画像を全スロットへ一括適用 ⇄ スロットごとに別画像（トグル）
   - 四隅ドラッグで対角固定リサイズ（Shift でアスペクト比固定）/ 本体ドラッグで移動
   - 画像を縦/横に切って改行配置（例: 「SPEED AD」→「SPEED」「AD」を別行に）
   - Ctrl・Shift＋クリックで複数の断片を選択し、まとめて移動・リサイズ / Delete で削除
   - マス目（グリッド）表示トグル
   - W×H・X/Y・拡大率を数値表示 / 戻る(Ctrl+Z)・進む(Ctrl+Y)・リセット
   ※スクショは OS の Snipping Tool 等で撮る前提（撮影機能は持たない）
   ===================================================================== */
(function () {
  'use strict';

  // ---- 起動ゲート（これより前に副作用を起こさない）-------------------
  if (new URLSearchParams(location.search).get('lettering') !== '1') return;

  var MIN = 12;            // 最小サイズ(px)
  var MAX_FILE = 10 * 1024 * 1024;
  var HISTORY_MAX = 30;
  var FULL = { x: 0, y: 0, w: 1, h: 1 };  // クリップ無し（画像全体）

  // ---- スロット定義 ---------------------------------------------------
  var SLOT_DEFS = [
    { key: 'header', sel: '.site-top-header__brand-name', label: 'ヘッダー', inline: true },
    { key: 'hero', sel: '#hero-title', label: 'ヒーロー', inline: false },
    { key: 'footer', sel: '.site-footer__brand span', label: 'フッター', inline: true }
  ];
  var SLOTS = {};            // key -> { def, el, overlay }
  SLOT_DEFS.forEach(function (d) {
    SLOTS[d.key] = { def: d, el: document.querySelector(d.sel), overlay: null };
  });
  var presentKeys = SLOT_DEFS.map(function (d) { return d.key; })
    .filter(function (k) { return !!SLOTS[k].el; });
  if (!presentKeys.length) return;   // 対象が1つも無ければ起動しない

  document.body.classList.add('lt-active');

  // ---- 状態 -----------------------------------------------------------
  var fragSeq = 0;
  var cutMode = null;        // null | 'v' | 'h'
  var state = { activeSlot: presentKeys[0], selection: [], applyAll: true, grid: false, slots: {} };
  presentKeys.forEach(function (k) { state.slots[k] = { fragments: [], textHidden: false }; });

  var history = { stack: [], index: -1 };

  // ---- SVG 正規化（emblem-tools と同じ）------------------------------
  function cleanSvg(text) {
    return String(text)
      .replace(/<\?xml[\s\S]*?\?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .trim();
  }

  // ====================================================================
  //  パネル UI
  // ====================================================================
  var gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'lt-gear';
  gear.title = 'レタリング当てはめツール';
  gear.setAttribute('aria-label', 'レタリング当てはめツールを開く');
  gear.textContent = '🅰';

  var panel = document.createElement('div');
  panel.className = 'lt-panel';
  panel.hidden = true;

  var tabsHtml = presentKeys.map(function (k) {
    return '<button type="button" class="lt-tab" data-tab="' + k + '">' + SLOTS[k].def.label +
      '<span class="lt-tab__dot" data-dot="' + k + '" hidden></span></button>';
  }).join('');

  panel.innerHTML = [
    '<div class="lt-panel__head">',
    '  <span class="lt-panel__title">レタリング当てはめツール</span>',
    '  <button type="button" class="lt-panel__close" aria-label="閉じる">×</button>',
    '</div>',

    '<div class="lt-sec">',
    '  <span class="lt-sec__label">対象（SPEED AD）</span>',
    '  <div class="lt-tabs">' + tabsHtml + '</div>',
    '  <input type="file" class="lt-file" accept=".svg,.png,image/svg+xml,image/png">',
    '  <label class="lt-check"><input type="checkbox" data-applyall checked> 同じ画像を全' + presentKeys.length + 'スロットに当てはめる</label>',
    '  <p class="lt-note">アップロード先: <strong data-upload-target></strong>。チェックを外すとスロットごとに別画像を設定できます。SVG / PNG 対応・その場限り（保存しない）。</p>',
    '  <label class="lt-check"><input type="checkbox" data-grid> マス目を表示（20px / 太線100px）</label>',
    '</div>',

    '<div class="lt-sec">',
    '  <span class="lt-sec__label">数値（選択中）</span>',
    '  <div class="lt-readout">',
    '    <div class="lt-readout__cell"><span class="lt-readout__name">幅 × 高さ</span><span class="lt-readout__val" data-ro="size">—</span></div>',
    '    <div class="lt-readout__cell"><span class="lt-readout__name">位置 X / Y</span><span class="lt-readout__val" data-ro="pos">—</span></div>',
    '    <div class="lt-readout__cell"><span class="lt-readout__name">拡大率</span><span class="lt-readout__val" data-ro="scale">—</span></div>',
    '  </div>',
    '  <p class="lt-note">四隅ドラッグでリサイズ（Shift でアスペクト固定）/ 画像ドラッグで移動 / Ctrl・Shift＋クリックで複数選択。</p>',
    '</div>',

    '<div class="lt-sec">',
    '  <span class="lt-sec__label">切り取り（改行配置）</span>',
    '  <div class="lt-actions">',
    '    <button type="button" class="lt-btn" data-act="cut-v">｜ 縦に切る</button>',
    '    <button type="button" class="lt-btn" data-act="cut-h">— 横に切る</button>',
    '    <button type="button" class="lt-btn" data-act="del">選択を削除</button>',
    '  </div>',
    '  <p class="lt-note">ボタンを押し、画像の上で切る位置をクリック。切った断片はドラッグで改行配置でき、Ctrl・Shift＋クリックでまとめて調整できます。選択中の断片は Delete / Backspace キーでも削除できます（余白の断片を消すのに便利）。</p>',
    '</div>',

    '<div class="lt-sec">',
    '  <span class="lt-sec__label">操作</span>',
    '  <div class="lt-actions">',
    '    <button type="button" class="lt-btn" data-act="undo">← 戻る (Ctrl+Z)</button>',
    '    <button type="button" class="lt-btn" data-act="redo">進む (Ctrl+Y) →</button>',
    '    <button type="button" class="lt-btn" data-act="reset">リセット</button>',
    '  </div>',
    '  <p class="lt-note">戻る = Ctrl+Z / 進む = Ctrl+Y（または Ctrl+Shift+Z）。スクショは Snipping Tool 等でどうぞ。</p>',
    '  <p class="lt-msg" data-msg></p>',
    '</div>'
  ].join('');

  var grid = document.createElement('div');
  grid.className = 'lt-grid';
  grid.hidden = true;

  document.body.appendChild(grid);
  document.body.appendChild(gear);
  document.body.appendChild(panel);

  var fileInput = panel.querySelector('.lt-file');
  var applyAllCb = panel.querySelector('[data-applyall]');
  var gridCb = panel.querySelector('[data-grid]');
  var msgEl = panel.querySelector('[data-msg]');

  function openPanel() { panel.hidden = false; syncUI(); }
  function closePanel() { panel.hidden = true; }
  gear.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel(); });
  panel.querySelector('.lt-panel__close').addEventListener('click', closePanel);

  function msg(t) { if (msgEl) msgEl.textContent = t || ''; }
  function msgClear() { msg(''); }

  // タブ切替
  panel.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      exitCut();
      state.activeSlot = btn.dataset.tab;
      var data = state.slots[state.activeSlot];
      state.selection = data.fragments.length ? [data.fragments[0].id] : [];
      exitTransform();
      refreshSelectionVisual();
      if (state.selection.length) enterTransform();
      positionHandles();
      syncUI();
    });
  });

  // ファイル選択
  fileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    onFile(state.activeSlot, file);
    e.target.value = '';
  });

  // 全スロット一括適用トグル
  applyAllCb.addEventListener('change', function () { state.applyAll = applyAllCb.checked; syncUI(); });

  // マス目表示トグル
  gridCb.addEventListener('change', function () { state.grid = gridCb.checked; grid.hidden = !state.grid; });

  // 切り取り・削除ボタン
  panel.querySelector('[data-act="cut-v"]').addEventListener('click', function () { enterCut('v'); });
  panel.querySelector('[data-act="cut-h"]').addEventListener('click', function () { enterCut('h'); });
  panel.querySelector('[data-act="del"]').addEventListener('click', deleteSelected);

  // 操作ボタン
  panel.querySelector('[data-act="undo"]').addEventListener('click', undo);
  panel.querySelector('[data-act="redo"]').addEventListener('click', redo);
  panel.querySelector('[data-act="reset"]').addEventListener('click', reset);

  // ---- UI 同期 --------------------------------------------------------
  function syncUI() {
    panel.querySelectorAll('[data-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tab === state.activeSlot));
    });
    panel.querySelectorAll('[data-dot]').forEach(function (d) {
      d.hidden = !(state.slots[d.dataset.dot] && state.slots[d.dataset.dot].fragments.length);
    });
    if (applyAllCb) applyAllCb.checked = state.applyAll;
    if (gridCb) gridCb.checked = state.grid;
    var tgt = panel.querySelector('[data-upload-target]');
    if (tgt) tgt.textContent = state.applyAll ? '全スロット' : SLOTS[state.activeSlot].def.label;
    updateReadout();
    var u = panel.querySelector('[data-act="undo"]'); if (u) u.disabled = history.index <= 0;
    var r = panel.querySelector('[data-act="redo"]'); if (r) r.disabled = history.index >= history.stack.length - 1;
  }

  function updateReadout() {
    var frags = getSelectedFragments();
    var size = panel.querySelector('[data-ro="size"]');
    var pos = panel.querySelector('[data-ro="pos"]');
    var sc = panel.querySelector('[data-ro="scale"]');
    if (!frags.length) { size.textContent = '—'; pos.textContent = '—'; sc.textContent = '—'; return; }
    if (frags.length === 1) {
      var f = frags[0];
      size.textContent = Math.round(f.w) + ' × ' + Math.round(f.h) + ' px';
      pos.textContent = Math.round(f.x) + ' / ' + Math.round(f.y) + ' px';
      sc.textContent = f.natW > 0 ? Math.round(f.w / f.natW * 100) + ' %' : '—';
    } else {
      var bb = bboxOf(frags);
      size.textContent = Math.round(bb.w) + ' × ' + Math.round(bb.h) + ' px';
      pos.textContent = Math.round(bb.x) + ' / ' + Math.round(bb.y) + ' px';
      sc.textContent = '× ' + frags.length + ' 選択';
    }
  }

  // ---- ヘルパ ---------------------------------------------------------
  function getFrag(key, id) {
    var fs = state.slots[key] ? state.slots[key].fragments : [];
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return null;
  }
  function getSelectedFragments() {
    var fs = state.slots[state.activeSlot] ? state.slots[state.activeSlot].fragments : [];
    return fs.filter(function (f) { return state.selection.indexOf(f.id) !== -1; });
  }
  function selectedEls() {
    var slot = SLOTS[state.activeSlot];
    if (!slot.overlay) return [];
    return state.selection
      .map(function (id) { return slot.overlay.querySelector('[data-frag-id="' + id + '"]'); })
      .filter(Boolean);
  }
  function bboxOf(frags) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    frags.forEach(function (f) {
      x1 = Math.min(x1, f.x); y1 = Math.min(y1, f.y);
      x2 = Math.max(x2, f.x + f.w); y2 = Math.max(y2, f.y + f.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  // 画面座標 → 対象要素ローカル座標（transform/vw のスケールを補正）
  function screenToLocal(host, sx, sy) {
    var r = host.getBoundingClientRect();
    var ow = host.offsetWidth || r.width || 1;
    var oh = host.offsetHeight || r.height || 1;
    var scx = r.width / ow; if (!isFinite(scx) || scx <= 0) scx = 1;
    var scy = r.height / oh; if (!isFinite(scy) || scy <= 0) scy = 1;
    return { x: (sx - r.left) / scx, y: (sy - r.top) / scy };
  }
  // フラグメント要素（ラッパ .lt-img + 内側 img）にサイズ・位置・クリップを反映。
  // overflow:hidden のラッパに、拡大した img をオフセット配置してスライスを表現する。
  function styleFrag(el, f) {
    var c = f.clip || FULL;
    el.style.left = f.x + 'px'; el.style.top = f.y + 'px';
    el.style.width = f.w + 'px'; el.style.height = f.h + 'px';
    var img = el.querySelector('img');
    if (!img) return;
    var fullW = f.w / (c.w || 1), fullH = f.h / (c.h || 1);
    img.style.width = fullW + 'px'; img.style.height = fullH + 'px';
    img.style.left = (-(c.x || 0) * fullW) + 'px';
    img.style.top = (-(c.y || 0) * fullH) + 'px';
  }
  function applySelectedStyles() {
    var slot = SLOTS[state.activeSlot];
    if (!slot.overlay) return;
    getSelectedFragments().forEach(function (f) {
      var el = slot.overlay.querySelector('[data-frag-id="' + f.id + '"]');
      if (el) styleFrag(el, f);
    });
  }

  // ---- アップロード ---------------------------------------------------
  function onFile(key, file) {
    if (!file) return;
    var name = file.name || '';
    var isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(name);
    var isPng = file.type === 'image/png' || /\.png$/i.test(name);
    if (!isSvg && !isPng) { msg('SVG か PNG を選択してください（' + (file.type || name) + ' は非対応）'); return; }
    if (file.size > MAX_FILE) { msg('ファイルが大きすぎます（10MB 以下にしてください）'); return; }

    var keys = state.applyAll ? presentKeys.slice() : [key];
    var reader = new FileReader();
    if (isSvg) {
      reader.onload = function () {
        var clean = cleanSvg(reader.result);
        if (!/<svg[\s>]/i.test(clean)) { msg('有効な <svg> が見つかりませんでした'); return; }
        var src;
        try { src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(clean))); }
        catch (err) { msg('SVG をエンコードできませんでした'); return; }
        placeInto(keys, src, 'svg');
      };
      reader.readAsText(file);
    } else {
      reader.onload = function () { placeInto(keys, reader.result, 'png'); };
      reader.readAsDataURL(file);
    }
  }

  // 対象要素の元テキスト矩形に contain フィットさせた Fragment を作る
  function fitFragment(key, src, type, natW, natH) {
    var slotEl = SLOTS[key].el;
    var r = slotEl.getBoundingClientRect();
    var boxW = slotEl.offsetWidth || r.width || 1;
    var boxH = slotEl.offsetHeight || r.height || 1;
    var nw = natW, nh = natH;
    var aspect = (nw > 0 && nh > 0) ? nw / nh : (boxW / boxH || 1);
    if (!(nw > 0)) { nw = Math.round(boxW); nh = Math.round(boxW / aspect); }
    var w, h;
    if (boxW / boxH > aspect) { h = boxH; w = boxH * aspect; } else { w = boxW; h = boxW / aspect; }
    return {
      id: 'f' + (++fragSeq), src: src, type: type, natW: nw, natH: nh,
      x: (boxW - w) / 2, y: (boxH - h) / 2, w: w, h: h, clip: { x: 0, y: 0, w: 1, h: 1 }, z: 0
    };
  }

  // 1つ以上のスロットへ同じ画像を当てはめる（各スロットの矩形に個別フィット）
  function placeInto(keys, src, type) {
    var probe = new Image();
    probe.onload = function () {
      var natW = probe.naturalWidth || 0;
      var natH = probe.naturalHeight || 0;
      var noSize = !(natW > 0);
      keys.forEach(function (key) {
        var data = state.slots[key];
        data.fragments = [fitFragment(key, src, type, natW, natH)];
        data.textHidden = true;
      });
      if (keys.indexOf(state.activeSlot) === -1) state.activeSlot = keys[0];
      var d = state.slots[state.activeSlot];
      state.selection = d.fragments.length ? [d.fragments[0].id] : [];
      msg(noSize ? '画像の実サイズを取得できなかったため仮の比率で配置しました（viewBox 無しの SVG など）' : '');
      render();
      enterTransform();
      positionHandles();
      pushHistory();
    };
    probe.onerror = function () { msg('画像を読み込めませんでした'); };
    probe.src = src;
  }

  // ---- 描画 -----------------------------------------------------------
  function render() {
    presentKeys.forEach(function (key) {
      var slot = SLOTS[key];
      var data = state.slots[key];
      slot.el.classList.toggle('lt-text-hidden', !!data.textHidden);

      if (data.fragments.length) {
        slot.el.classList.add('lt-host');
        if (slot.def.inline) slot.el.classList.add('lt-host--inline');
        if (!slot.overlay) {
          slot.overlay = document.createElement('div');
          slot.overlay.className = 'lt-overlay';
          slot.el.appendChild(slot.overlay);
        }
        slot.overlay.innerHTML = '';
        data.fragments.forEach(function (f) {
          var el = document.createElement('div');
          el.className = 'lt-img';
          el.dataset.fragId = f.id;
          el.dataset.slot = key;
          var img = document.createElement('img');
          img.src = f.src;
          img.alt = '';
          img.draggable = false;
          el.appendChild(img);
          styleFrag(el, f);
          if (key === state.activeSlot && state.selection.indexOf(f.id) !== -1) el.classList.add('lt-img--selected');
          el.addEventListener('pointerdown', onImgPointerDown);
          slot.overlay.appendChild(el);
        });
      } else {
        if (slot.overlay) { slot.overlay.remove(); slot.overlay = null; }
        slot.el.classList.remove('lt-host', 'lt-host--inline');
      }
    });
    positionHandles();
    syncUI();
  }

  function refreshSelectionVisual() {
    document.querySelectorAll('.lt-img--selected').forEach(function (x) { x.classList.remove('lt-img--selected'); });
    selectedEls().forEach(function (el) { el.classList.add('lt-img--selected'); });
  }

  // ---- クロム（フレーム / ヒント / 四隅ハンドル）----------------------
  var transforming = false;
  var frame = document.createElement('div'); frame.className = 'lt-frame'; frame.style.display = 'none';
  var hint = document.createElement('div'); hint.className = 'lt-hint'; hint.style.display = 'none';
  hint.textContent = '四隅=リサイズ / 本体=移動 / Ctrl・Shift+クリック=複数選択';
  document.body.appendChild(frame); document.body.appendChild(hint);
  var CORNERS = ['nw', 'ne', 'sw', 'se'];
  var handles = CORNERS.map(function (cn) {
    var h = document.createElement('div');
    h.className = 'lt-handle lt-handle--' + cn;
    h.dataset.corner = cn;
    h.style.display = 'none';
    h.addEventListener('pointerdown', function (e) { startResize(cn, e); });
    document.body.appendChild(h);
    return h;
  });

  function enterTransform() { transforming = true; positionHandles(); }
  function exitTransform() { transforming = false; hideChrome(); }
  function hideChrome() {
    frame.style.display = 'none'; hint.style.display = 'none';
    handles.forEach(function (h) { h.style.display = 'none'; });
  }
  function unionRect(els) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
    });
    return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
  }
  function positionHandles() {
    var els = selectedEls();
    if (!transforming || !els.length) { hideChrome(); return; }
    var r = unionRect(els);
    frame.style.display = 'block';
    frame.style.left = r.left + 'px'; frame.style.top = r.top + 'px';
    frame.style.width = r.width + 'px'; frame.style.height = r.height + 'px';
    hint.style.display = 'block';
    hint.style.left = r.left + 'px'; hint.style.top = (r.bottom + 6) + 'px';
    var pts = { nw: [r.left, r.top], ne: [r.right, r.top], sw: [r.left, r.bottom], se: [r.right, r.bottom] };
    handles.forEach(function (h) {
      var p = pts[h.dataset.corner];
      h.style.display = 'block';
      h.style.left = (p[0] - 6.5) + 'px';
      h.style.top = (p[1] - 6.5) + 'px';
    });
  }

  // ---- 画像クリック（選択 / 複数選択 / カット）+ 移動 -----------------
  var moveStart = null;
  function onImgPointerDown(e) {
    if (cutMode) { e.preventDefault(); doCut(e); return; }
    e.preventDefault();
    var id = e.currentTarget.dataset.fragId;
    var key = e.currentTarget.dataset.slot;
    if (key !== state.activeSlot) { state.activeSlot = key; state.selection = []; }
    var multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi) {
      var i = state.selection.indexOf(id);
      if (i === -1) state.selection.push(id); else state.selection.splice(i, 1);
      if (!state.selection.length) state.selection = [id];
    } else if (state.selection.indexOf(id) === -1) {
      state.selection = [id];   // 既に選択済みならグループ維持（まとめてドラッグ可）
    }
    refreshSelectionVisual();
    enterTransform();
    positionHandles();
    syncUI();
    startMove(e);
  }
  function startMove(e) {
    var frags = getSelectedFragments();
    if (!frags.length) return;
    var host = SLOTS[state.activeSlot].el;
    var p0 = screenToLocal(host, e.clientX, e.clientY);
    moveStart = { px: p0.x, py: p0.y, orig: frags.map(function (f) { return { f: f, x: f.x, y: f.y }; }) };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endMove, { once: true });
  }
  function onMove(e) {
    if (!moveStart) return;
    var host = SLOTS[state.activeSlot].el;
    var p = screenToLocal(host, e.clientX, e.clientY);
    var dx = p.x - moveStart.px, dy = p.y - moveStart.py;
    moveStart.orig.forEach(function (o) { o.f.x = o.x + dx; o.f.y = o.y + dy; });
    applySelectedStyles(); positionHandles(); updateReadout();
  }
  function endMove() {
    moveStart = null;
    window.removeEventListener('pointermove', onMove);
    pushHistory();
  }

  // ---- 対角固定リサイズ（単一・グループ共通）------------------------
  var resizeStart = null;
  function startResize(corner, e) {
    e.preventDefault(); e.stopPropagation();
    var frags = getSelectedFragments(); if (!frags.length) return;
    var bb = bboxOf(frags);
    var ax = (corner === 'nw' || corner === 'sw') ? bb.x + bb.w : bb.x;
    var ay = (corner === 'nw' || corner === 'ne') ? bb.y + bb.h : bb.y;
    resizeStart = {
      corner: corner, ax: ax, ay: ay, bb: bb, aspect: bb.h > 0 ? bb.w / bb.h : 1,
      minW: Math.min.apply(null, frags.map(function (f) { return f.w; })),
      minH: Math.min.apply(null, frags.map(function (f) { return f.h; })),
      orig: frags.map(function (f) { return { f: f, x: f.x, y: f.y, w: f.w, h: f.h }; })
    };
    window.addEventListener('pointermove', onResize);
    window.addEventListener('pointerup', endResize, { once: true });
  }
  function onResize(e) {
    if (!resizeStart) return;
    var host = SLOTS[state.activeSlot].el;
    var p = screenToLocal(host, e.clientX, e.clientY);
    var ax = resizeStart.ax, ay = resizeStart.ay, bb = resizeStart.bb;
    var newW = Math.abs(p.x - ax), newH = Math.abs(p.y - ay);
    if (e.shiftKey && resizeStart.aspect > 0) {
      if (newW / newH > resizeStart.aspect) newH = newW / resizeStart.aspect; else newW = newH * resizeStart.aspect;
    }
    var sx = newW / bb.w, sy = newH / bb.h;
    if (!isFinite(sx) || sx <= 0) sx = 0.01;
    if (!isFinite(sy) || sy <= 0) sy = 0.01;
    if (resizeStart.minW * sx < MIN) sx = MIN / resizeStart.minW;   // 最小サイズクランプ
    if (resizeStart.minH * sy < MIN) sy = MIN / resizeStart.minH;
    resizeStart.orig.forEach(function (o) {
      o.f.w = o.w * sx; o.f.h = o.h * sy;
      o.f.x = ax + (o.x - ax) * sx;
      o.f.y = ay + (o.y - ay) * sy;
    });
    applySelectedStyles(); positionHandles(); updateReadout();
  }
  function endResize() {
    resizeStart = null;
    window.removeEventListener('pointermove', onResize);
    pushHistory();
  }

  // ---- カット（縦/横に切って改行配置）-------------------------------
  function enterCut(axis) {
    cutMode = axis;
    document.body.classList.add('lt-cutting');
    msg('画像の上で切る位置をクリックしてください（' + (axis === 'v' ? '縦' : '横') + 'カット）。やめる場合はもう一度ボタンか別操作で解除。');
  }
  function exitCut() {
    cutMode = null;
    document.body.classList.remove('lt-cutting');
  }
  function mkPiece(f, place, clip) {
    return {
      id: 'f' + (++fragSeq), src: f.src, type: f.type, natW: f.natW, natH: f.natH,
      x: place.x, y: place.y, w: place.w, h: place.h, clip: clip, z: f.z || 0
    };
  }
  function doCut(e) {
    var key = e.currentTarget.dataset.slot, id = e.currentTarget.dataset.fragId;
    var f = getFrag(key, id);
    if (!f) { exitCut(); return; }
    var host = SLOTS[key].el;
    var p = screenToLocal(host, e.clientX, e.clientY);
    var c = f.clip || FULL;
    var pieces;
    if (cutMode === 'v') {
      var t = (p.x - f.x) / f.w; t = Math.min(0.92, Math.max(0.08, t));
      pieces = [
        mkPiece(f, { x: f.x, y: f.y, w: f.w * t, h: f.h }, { x: c.x, y: c.y, w: c.w * t, h: c.h }),
        mkPiece(f, { x: f.x + f.w * t, y: f.y, w: f.w * (1 - t), h: f.h }, { x: c.x + c.w * t, y: c.y, w: c.w * (1 - t), h: c.h })
      ];
    } else {
      var u = (p.y - f.y) / f.h; u = Math.min(0.92, Math.max(0.08, u));
      pieces = [
        mkPiece(f, { x: f.x, y: f.y, w: f.w, h: f.h * u }, { x: c.x, y: c.y, w: c.w, h: c.h * u }),
        mkPiece(f, { x: f.x, y: f.y + f.h * u, w: f.w, h: f.h * (1 - u) }, { x: c.x, y: c.y + c.h * u, w: c.w, h: c.h * (1 - u) })
      ];
    }
    var data = state.slots[key];
    var idx = data.fragments.indexOf(f);
    Array.prototype.splice.apply(data.fragments, [idx, 1].concat(pieces));
    state.activeSlot = key;
    state.selection = [pieces[1].id];   // 2つ目の断片を選択 → ドラッグで改行配置
    exitCut();
    render();
    enterTransform();
    positionHandles();
    pushHistory();
    msg('切りました。選択中の断片をドラッグして改行配置できます（Ctrl・Shift＋クリックで複数選択）。');
  }

  // ---- 選択中の断片を削除（余白カット片の除去など）------------------
  function deleteSelected() {
    if (!state.selection.length) return;
    var data = state.slots[state.activeSlot];
    if (!data) return;
    data.fragments = data.fragments.filter(function (f) { return state.selection.indexOf(f.id) === -1; });
    if (!data.fragments.length) data.textHidden = false;   // 全部消したら元テキスト復帰
    state.selection = [];
    exitCut();
    exitTransform();
    render();
    pushHistory();
  }

  // アンカー内の画像クリックでナビゲーションさせない
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.lt-overlay')) e.preventDefault();
  }, true);

  // キーボード操作（入力欄にフォーカス中は無効）
  //  - Ctrl/Cmd+Z = 戻る、Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = 進む
  //  - Delete / Backspace = 選択断片を削除
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var tag = (t && t.tagName || '').toLowerCase();
    var inField = tag === 'input' || tag === 'textarea' || (t && t.isContentEditable);
    if (inField) return;
    var ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection.length) { e.preventDefault(); deleteSelected(); }
  });

  // スクロール / リサイズでハンドル追従
  window.addEventListener('scroll', positionHandles, true);
  window.addEventListener('resize', positionHandles);

  // ---- 履歴（undo / redo / reset）------------------------------------
  function snapshot() {
    var slots = {};
    presentKeys.forEach(function (k) { slots[k] = JSON.parse(JSON.stringify(state.slots[k])); });
    return { slots: slots, activeSlot: state.activeSlot, selection: state.selection.slice() };
  }
  function pushHistory() {
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snapshot());
    if (history.stack.length > HISTORY_MAX) history.stack.shift();
    history.index = history.stack.length - 1;
    syncUI();
  }
  function restore(snap) {
    presentKeys.forEach(function (k) { state.slots[k] = JSON.parse(JSON.stringify(snap.slots[k])); });
    state.activeSlot = snap.activeSlot;
    state.selection = snap.selection.slice();
    exitCut();
    exitTransform();
    render();
    if (selectedEls().length) { enterTransform(); positionHandles(); }
  }
  function undo() { if (history.index <= 0) return; history.index--; restore(history.stack[history.index]); syncUI(); }
  function redo() { if (history.index >= history.stack.length - 1) return; history.index++; restore(history.stack[history.index]); syncUI(); }
  function reset() {
    presentKeys.forEach(function (k) { state.slots[k] = { fragments: [], textHidden: false }; });
    state.selection = [];
    exitCut();
    exitTransform();
    render();
    pushHistory();
    msgClear();
  }

  // ---- 初期化 ---------------------------------------------------------
  render();
  pushHistory();   // 空状態を履歴の起点に（undo で空へ戻れる）
  openPanel();
})();
