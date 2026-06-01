/**
 * ログイン前LP: フルページ・ホイールナビゲーション
 * 少しのスクロールで隣接する .lp-page へスムーズに移動する（1ホイール=1ページ）。
 * - PC幅(>=1101px)のみ有効。タブレット/スマホは通常スクロール。
 * - prefers-reduced-motion 指定時は無効（通常スクロール）。
 * - モック切替パネル(.hero-copy-picker)上では横取りしない。
 */
(function () {
  'use strict';

  var MIN_WIDTH = 1101;
  var COOLDOWN_MS = 850; // 連続発火を抑え、1ジェスチャー=1ページ移動にする
  var DELTA_THRESHOLD = 3;

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var widthQuery = window.matchMedia('(min-width: ' + MIN_WIDTH + 'px)');
  var lastNav = 0;

  function enabled() {
    return widthQuery.matches && !motionQuery.matches;
  }

  function pages() {
    return Array.prototype.slice.call(document.querySelectorAll('.lp-page'));
  }

  function currentIndex(list) {
    var y = window.scrollY || window.pageYOffset || 0;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < list.length; i++) {
      var dist = Math.abs(list[i].offsetTop - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function goTo(list, index) {
    var clamped = Math.max(0, Math.min(list.length - 1, index));
    list[clamped].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onWheel(event) {
    if (!enabled()) {
      return;
    }
    if (event.target && event.target.closest && event.target.closest('.hero-copy-picker')) {
      return; // モックツールの内部スクロールは尊重
    }
    event.preventDefault();

    if (Math.abs(event.deltaY) < DELTA_THRESHOLD) {
      return;
    }
    var now = performance.now();
    if (now - lastNav < COOLDOWN_MS) {
      return;
    }
    var list = pages();
    if (list.length === 0) {
      return;
    }
    lastNav = now;
    var direction = event.deltaY > 0 ? 1 : -1;
    goTo(list, currentIndex(list) + direction);
  }

  window.addEventListener('wheel', onWheel, { passive: false });
})();
