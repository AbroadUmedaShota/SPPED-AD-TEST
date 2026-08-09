// theme-init.js — 表示テーマ(ライト/ダーク)の初期適用
// <head> で同期読み込みし、最初の描画より前に <html data-theme> を確定させる。
// body より後ろで当てると、ライトで一瞬描画されてからダークへ切り替わってちらつく。
(function () {
    'use strict';
    var KEY = 'adminTheme';   // 'light' | 'dark' | 'system'

    function stored() {
        var v = null;
        try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
        return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
    }

    function prefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    /** 実際に当てる値を返す。system のときは OS の設定に従う */
    function resolve(mode) {
        return (mode === 'dark' || (mode === 'system' && prefersDark())) ? 'dark' : 'light';
    }

    function apply(mode) {
        document.documentElement.setAttribute('data-theme', resolve(mode));
    }

    window.pTheme = {
        get: stored,
        set: function (mode) {
            try { localStorage.setItem(KEY, mode); } catch (e) { /* 保存できなくても表示は切り替える */ }
            apply(mode);
            document.dispatchEvent(new CustomEvent('admin:theme-change', { detail: resolve(mode) }));
        },
        resolved: function () { return resolve(stored()); }
    };

    apply(stored());

    // ヘッダーの切替ボタン。ヘッダーは admin.js が非同期に差し込むため、
    // 完了通知と DOMContentLoaded の両方から配線する（先に揃っていた場合の保険）
    function wireToggle() {
        var btn = document.getElementById('themeToggle');
        if (!btn || btn.dataset.wired) { return; }
        btn.dataset.wired = '1';
        var paint = function () {
            var dark = resolve(stored()) === 'dark';
            btn.setAttribute('aria-pressed', String(dark));
            // ボタンは「押すとどうなるか」を出す
            document.getElementById('themeToggleIcon').textContent = dark ? '☀' : '🌙';
            document.getElementById('themeToggleLabel').textContent = dark ? 'ライト' : 'ダーク';
        };
        btn.addEventListener('click', function () {
            window.pTheme.set(resolve(stored()) === 'dark' ? 'light' : 'dark');
            paint();
        });
        document.addEventListener('admin:theme-change', paint);
        paint();
    }
    document.addEventListener('admin:chrome-ready', wireToggle);
    document.addEventListener('DOMContentLoaded', wireToggle);

    // OS 側の設定変更に追従する（明示的に light/dark を選んでいる間は追従しない）
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function () { if (stored() === 'system') { apply('system'); } };
        if (mq.addEventListener) { mq.addEventListener('change', onChange); }
        else if (mq.addListener) { mq.addListener(onChange); }
    }
}());
