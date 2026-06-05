/* =====================================================================
   Emblem Tools — ヘッダーエンブレム調整ツール（開発者向け）
   起動: URL に ?emblemtools=1 が付いている時だけ歯車が出る。
   完全クライアントサイド・揮発（リロードで消える/保存しない）。
   撤去: このファイルと css/emblem-tools.css を削除し、index.html の
        <link>/<script> 2行を消すだけ。本番に残留なし。
   ===================================================================== */
(function () {
  'use strict';

  // ---- 起動ゲート -----------------------------------------------------
  if (new URLSearchParams(location.search).get('emblemtools') !== '1') return;

  var logoSpan = document.querySelector('.site-top-header__logo');
  if (!logoSpan) return;

  // ヘッダー（位置クランプ用の基準）
  var headerEl = document.querySelector('.site-top-header__inner') ||
                 document.querySelector('.site-top-header');

  // ---- 状態 -----------------------------------------------------------
  var DEFAULTS = {
    source: 'current',        // 'current' | 'a' | 'b' | 'upload'
    strokeOn: true,
    strokeWidth: 8,
    strokeColor: '#ffffff',
    round: true,              // round ⇄ miter
    glow: false,
    shadow: false,
    opacity: 1,
    angle: 0,
    offsetX: 0,
    offsetY: 0
  };
  var state = Object.assign({}, DEFAULTS);

  // ソースSVGマークアップのキャッシュ
  var cache = {
    current: logoSpan.innerHTML.trim(),  // ページ読込時の現行インラインSVG
    a: null, b: null, upload: null
  };

  // ---- SVG 正規化（プロローグ/コメント/スクリプト/イベント除去）-------
  function cleanSvg(text) {
    return String(text)
      .replace(/<\?xml[\s\S]*?\?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .trim();
  }

  // ---- stroke / 効果を SVG 要素へ適用 ---------------------------------
  function applyEffects(svgEl) {
    var shapes = svgEl.querySelectorAll('path,polygon,polyline,circle,ellipse,rect,line');
    shapes.forEach(function (s) {
      if (state.strokeOn && state.strokeWidth > 0) {
        s.setAttribute('stroke', state.strokeColor);
        s.setAttribute('stroke-width', state.strokeWidth);
        s.setAttribute('paint-order', 'stroke');
        s.setAttribute('stroke-linejoin', state.round ? 'round' : 'miter');
        s.setAttribute('stroke-linecap', state.round ? 'round' : 'butt');
      } else {
        s.removeAttribute('stroke');
        s.removeAttribute('stroke-width');
        s.removeAttribute('paint-order');
      }
    });

    var filters = [];
    if (state.glow) filters.push('drop-shadow(0 0 3px rgba(255,255,255,0.75))');
    if (state.shadow) filters.push('drop-shadow(2px 3px 3px rgba(0,0,0,0.55))');
    svgEl.style.filter = filters.join(' ');
    svgEl.style.opacity = String(state.opacity);
  }

  // ---- ソース取得（A/B は fetch、他はキャッシュ）----------------------
  function withSource(src, cb) {
    if (cache[src]) return cb(cache[src]);
    var map = { a: 'img/emblem-eagle-a.svg', b: 'img/emblem-eagle-b.svg' };
    if (!map[src]) return cb(cache.current);
    fetch(map[src])
      .then(function (r) { return r.text(); })
      .then(function (t) { cache[src] = cleanSvg(t); cb(cache[src]); })
      .catch(function () { cb(cache.current); });
  }

  // ---- 描画 -----------------------------------------------------------
  function draw(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = cleanSvg(markup);
    var svgEl = tmp.querySelector('svg');
    if (!svgEl) return;
    svgEl.setAttribute('class', 'site-top-header__logo-image');
    svgEl.setAttribute('aria-hidden', 'true');
    svgEl.setAttribute('focusable', 'false');
    applyEffects(svgEl);

    logoSpan.innerHTML = '';
    logoSpan.appendChild(svgEl);
    applyTransform();
    if (transforming) positionHandles();
  }

  function render() {
    if (state.source === 'current') draw(cache.current);
    else if (state.source === 'upload') draw(cache.upload || cache.current);
    else withSource(state.source, draw);
  }

  // ---- サイズ/位置トランスフォーム ------------------------------------
  function applyTransform() {
    logoSpan.style.transformOrigin = 'center center';
    logoSpan.style.transform =
      'translate(' + state.offsetX + 'px,' + state.offsetY + 'px) rotate(' + state.angle + 'deg)';
    logoSpan.style.willChange = 'transform';
  }

  // ====================================================================
  //  パネル UI
  // ====================================================================
  var gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'emt-gear';
  gear.title = 'エンブレム調整ツール';
  gear.setAttribute('aria-label', 'エンブレム調整ツールを開く');
  gear.textContent = '⚙';

  var panel = document.createElement('div');
  panel.className = 'emt-panel';
  panel.hidden = true;
  panel.innerHTML = [
    '<div class="emt-panel__head">',
    '  <span class="emt-panel__title">エンブレム調整ツール</span>',
    '  <button type="button" class="emt-panel__close" aria-label="閉じる">×</button>',
    '</div>',

    '<div class="emt-sec">',
    '  <span class="emt-sec__label">SVG ソース</span>',
    '  <div class="emt-srcrow">',
    '    <button type="button" class="emt-srcbtn" data-src="current">現行</button>',
    '    <button type="button" class="emt-srcbtn" data-src="a">A 塗り</button>',
    '    <button type="button" class="emt-srcbtn" data-src="b">B 線</button>',
    '  </div>',
    '  <input type="file" class="emt-file" accept=".svg,image/svg+xml">',
    '  <p class="emt-note">アップロードはその場限り（保存せず・リロードで消える）。パス系SVGのみstroke対応。</p>',
    '</div>',

    '<div class="emt-sec">',
    '  <span class="emt-sec__label">ストローク（デフォルト）</span>',
    '  <label class="emt-check"><input type="checkbox" data-fx="strokeOn" checked> 線を付ける</label>',
    '  <div class="emt-row"><span class="emt-row__name">太さ</span>',
    '    <input type="range" min="0" max="24" step="0.5" value="8" data-range="strokeWidth">',
    '    <span class="emt-row__val" data-val="strokeWidth">8</span></div>',
    '  <div class="emt-row"><span class="emt-row__name">色</span>',
    '    <input type="color" value="#ffffff" data-color="strokeColor">',
    '    <span class="emt-row__val" data-val="strokeColor" style="flex:1 1 auto;text-align:left">#ffffff</span></div>',
    '  <label class="emt-check"><input type="checkbox" data-fx="round" checked> 角を丸める（round / miter）</label>',
    '</div>',

    '<div class="emt-sec">',
    '  <span class="emt-sec__label">定番エフェクト（既定オフ）</span>',
    '  <label class="emt-check"><input type="checkbox" data-fx="glow"> 外側グロー</label>',
    '  <label class="emt-check"><input type="checkbox" data-fx="shadow"> ドロップシャドウ</label>',
    '  <div class="emt-row"><span class="emt-row__name">不透明度</span>',
    '    <input type="range" min="0.2" max="1" step="0.05" value="1" data-range="opacity">',
    '    <span class="emt-row__val" data-val="opacity">1.0</span></div>',
    '</div>',

    '<div class="emt-sec">',
    '  <span class="emt-sec__label">位置・角度</span>',
    '  <div class="emt-row"><span class="emt-row__name">角度</span>',
    '    <input type="range" min="-180" max="180" step="1" value="0" data-range="angle">',
    '    <span class="emt-row__val" data-val="angle">0°</span></div>',
    '  <label class="emt-check"><input type="checkbox" id="emt-transform-toggle"> ハンドルで位置・角度調整（アイコンも直接クリック可）</label>',
    '</div>',

    '<div class="emt-sec">',
    '  <div class="emt-actions">',
    '    <button type="button" class="emt-btn" data-act="copy">設定をコピー</button>',
    '    <button type="button" class="emt-btn" data-act="reset">リセット</button>',
    '  </div>',
    '</div>'
  ].join('');

  document.body.appendChild(gear);
  document.body.appendChild(panel);

  // ---- パネル開閉 -----------------------------------------------------
  function openPanel() { panel.hidden = false; syncUI(); }
  function closePanel() { panel.hidden = true; }
  gear.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel(); });
  panel.querySelector('.emt-panel__close').addEventListener('click', closePanel);

  // ---- UI 同期（state → コントロール表示）-----------------------------
  function syncUI() {
    panel.querySelectorAll('[data-src]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.src === state.source));
    });
    panel.querySelectorAll('[data-fx]').forEach(function (c) { c.checked = !!state[c.dataset.fx]; });
    panel.querySelectorAll('[data-range]').forEach(function (r) { r.value = state[r.dataset.range]; });
    panel.querySelector('[data-color]').value = state.strokeColor;
    updateVal('strokeWidth'); updateVal('opacity'); updateVal('angle');
    var sc = panel.querySelector('[data-val="strokeColor"]'); if (sc) sc.textContent = state.strokeColor;
    var tt = document.getElementById('emt-transform-toggle'); if (tt) tt.checked = transforming;
  }
  function updateVal(key) {
    var el = panel.querySelector('[data-val="' + key + '"]');
    if (!el) return;
    if (key === 'opacity') el.textContent = Number(state.opacity).toFixed(1);
    else if (key === 'angle') el.textContent = Math.round(state.angle) + '°';
    else el.textContent = String(state[key]);
  }

  // ---- ソース切替 -----------------------------------------------------
  panel.querySelectorAll('[data-src]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.source = btn.dataset.src;
      syncUI(); render();
    });
  });

  // ---- アップロード ---------------------------------------------------
  panel.querySelector('.emt-file').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var okType = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (!okType) { alert('SVGファイルを選択してください（' + (file.type || file.name) + ' は非対応）'); e.target.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function () {
      cache.upload = cleanSvg(reader.result);
      if (!/<svg[\s>]/i.test(cache.upload)) { alert('有効な<svg>が見つかりませんでした'); return; }
      state.source = 'upload';
      syncUI(); render();
    };
    reader.readAsText(file);
  });

  // ---- チェック（strokeOn/round/glow/shadow）-------------------------
  panel.querySelectorAll('[data-fx]').forEach(function (c) {
    c.addEventListener('change', function () { state[c.dataset.fx] = c.checked; render(); });
  });

  // ---- スライダー（strokeWidth/opacity/scale）------------------------
  panel.querySelectorAll('[data-range]').forEach(function (r) {
    r.addEventListener('input', function () {
      var k = r.dataset.range;
      state[k] = parseFloat(r.value);
      updateVal(k);
      if (k === 'angle') applyTransform(); else render();
      if (transforming) positionHandles();
    });
  });

  // ---- カラーピッカー -------------------------------------------------
  var colorInput = panel.querySelector('[data-color]');
  colorInput.addEventListener('input', function () {
    state.strokeColor = colorInput.value;
    var sc = panel.querySelector('[data-val="strokeColor"]'); if (sc) sc.textContent = state.strokeColor;
    render();
  });

  // ---- 設定コピー / リセット -----------------------------------------
  panel.querySelector('[data-act="copy"]').addEventListener('click', function (e) {
    var lines = [
      '/* emblem settings */',
      'source: ' + state.source,
      'stroke: ' + (state.strokeOn ? (state.strokeColor + ' / width ' + state.strokeWidth + ' / ' + (state.round ? 'round' : 'miter')) : 'off'),
      'glow: ' + state.glow + ', shadow: ' + state.shadow + ', opacity: ' + state.opacity,
      'angle: ' + Math.round(state.angle) + '°, offset: (' + Math.round(state.offsetX) + ',' + Math.round(state.offsetY) + ')'
    ].join('\n');
    var btn = e.currentTarget;
    var done = function () { var t = btn.textContent; btn.textContent = 'コピーしました'; setTimeout(function () { btn.textContent = t; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines).then(done, done);
    else done();
  });
  panel.querySelector('[data-act="reset"]').addEventListener('click', function () {
    state = Object.assign({}, DEFAULTS);
    if (transforming) exitTransform();
    syncUI(); render();
  });

  // ====================================================================
  //  項目5: 視覚リサイズ + ヘッダー内ドラッグ移動
  // ====================================================================
  var transforming = false;
  var frame = null;
  var hint = null;
  var handles = [];
  var HCORNERS = ['nw', 'ne', 'sw', 'se'];

  function enterTransform() {
    if (transforming) return;
    transforming = true;
    logoSpan.classList.add('emt-transforming');
    frame = document.createElement('div'); frame.className = 'emt-frame'; document.body.appendChild(frame);
    hint = document.createElement('div'); hint.className = 'emt-hint';
    hint.textContent = '四角ドラッグ=回転 / 本体ドラッグ=移動'; document.body.appendChild(hint);
    HCORNERS.forEach(function (cn) {
      var h = document.createElement('div');
      h.className = 'emt-handle emt-handle--' + cn;
      h.dataset.corner = cn;
      h.title = '回転';
      document.body.appendChild(h);
      handles.push(h);
      h.addEventListener('pointerdown', startRotate);
    });
    logoSpan.addEventListener('pointerdown', startMove);
    positionHandles();
    var tt = document.getElementById('emt-transform-toggle'); if (tt) tt.checked = true;
  }
  function exitTransform() {
    if (!transforming) return;
    transforming = false;
    logoSpan.classList.remove('emt-transforming');
    logoSpan.removeEventListener('pointerdown', startMove);
    handles.forEach(function (h) { h.remove(); }); handles = [];
    if (frame) { frame.remove(); frame = null; }
    if (hint) { hint.remove(); hint = null; }
    var tt = document.getElementById('emt-transform-toggle'); if (tt) tt.checked = false;
  }
  function centerOf() {
    var r = logoSpan.getBoundingClientRect();
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: r };
  }
  function positionHandles() {
    if (!transforming) return;
    var c = centerOf(), r = c.r;
    if (frame) { frame.style.left = r.left + 'px'; frame.style.top = r.top + 'px'; frame.style.width = r.width + 'px'; frame.style.height = r.height + 'px'; }
    if (hint) { hint.style.left = r.left + 'px'; hint.style.top = (r.bottom + 6) + 'px'; }
    var pts = { nw: [r.left, r.top], ne: [r.right, r.top], sw: [r.left, r.bottom], se: [r.right, r.bottom] };
    handles.forEach(function (h) {
      var p = pts[h.dataset.corner];
      h.style.left = (p[0] - 6) + 'px';
      h.style.top = (p[1] - 6) + 'px';
    });
  }

  // ヘッダー内に収めるクランプ
  function clampOffset() {
    if (!headerEl) return;
    var hr = headerEl.getBoundingClientRect();
    var lr = logoSpan.getBoundingClientRect();
    // 現在の見た目位置から、はみ出し量だけ offset を戻す
    var dx = 0, dy = 0;
    if (lr.left < hr.left) dx = hr.left - lr.left;
    if (lr.right > hr.right) dx = hr.right - lr.right;
    if (lr.top < hr.top) dy = hr.top - lr.top;
    if (lr.bottom > hr.bottom) dy = hr.bottom - lr.bottom;
    state.offsetX += dx; state.offsetY += dy;
    if (dx || dy) applyTransform();
  }

  // --- 移動ドラッグ ---
  var moveStart = null;
  function startMove(e) {
    if (!transforming) return;
    if (e.target.closest('.emt-handle')) return;
    e.preventDefault();
    moveStart = { x: e.clientX, y: e.clientY, ox: state.offsetX, oy: state.offsetY };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endMove, { once: true });
  }
  function onMove(e) {
    if (!moveStart) return;
    state.offsetX = moveStart.ox + (e.clientX - moveStart.x);
    state.offsetY = moveStart.oy + (e.clientY - moveStart.y);
    applyTransform(); positionHandles();
  }
  function endMove() {
    moveStart = null;
    window.removeEventListener('pointermove', onMove);
    clampOffset(); positionHandles();
  }

  // --- 回転ドラッグ（中心基準）---
  var rotStart = null;
  function startRotate(e) {
    if (!transforming) return;
    e.preventDefault(); e.stopPropagation();
    var c = centerOf();
    var a0 = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    rotStart = { a0: a0, ang0: state.angle };
    window.addEventListener('pointermove', onRotate);
    window.addEventListener('pointerup', endRotate, { once: true });
  }
  function onRotate(e) {
    if (!rotStart) return;
    var c = centerOf();
    var a = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    var ang = rotStart.ang0 + (a - rotStart.a0) * 180 / Math.PI;
    while (ang > 180) ang -= 360;
    while (ang < -180) ang += 360;
    state.angle = ang;
    applyTransform(); positionHandles();
    var sr = panel.querySelector('[data-range="angle"]'); if (sr) sr.value = Math.round(state.angle);
    updateVal('angle');
  }
  function endRotate() {
    rotStart = null;
    window.removeEventListener('pointermove', onRotate);
    positionHandles();
  }

  // トグル & アイコン直接クリックで変形モード
  document.getElementById('emt-transform-toggle').addEventListener('change', function (e) {
    e.target.checked ? enterTransform() : exitTransform();
  });
  // ツール起動中はブランドリンクのナビを止めてアイコンクリック=変形モード
  var brand = logoSpan.closest('a');
  if (brand) {
    brand.addEventListener('click', function (e) {
      if (!transforming && e.target.closest('.site-top-header__logo')) {
        e.preventDefault(); enterTransform();
      } else if (transforming) {
        e.preventDefault();
      }
    });
  }

  // スクロール/リサイズでハンドル追従
  window.addEventListener('scroll', positionHandles, true);
  window.addEventListener('resize', function () { positionHandles(); clampOffset(); });

  // ---- 初期描画 -------------------------------------------------------
  render();
})();
