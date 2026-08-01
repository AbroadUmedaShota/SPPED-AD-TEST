// proto-ui.js — 管理画面モックの共通モーダル制御(design_handoff_admin_ui/prototype.dc.html 準拠)
// .proto-modal(オーバーレイ) > .proto-dialog(本体) の構造を前提に、
// 開閉・Escキー・オーバーレイクリックの3系統クローズを提供する。
(function () {
    'use strict';

    window.pOpen = function (id) {
        // 正本(prototype)は常に単一モーダル表示のため、開く前に他をすべて閉じる
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        var m = document.getElementById(id);
        if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
    };

    // 候補値・定型チップの複写用: 対象inputへ値を設定
    window.pSet = function (inputId, value) {
        var el = document.getElementById(inputId);
        if (el) { el.value = value; el.focus(); }
    };

    // よく使う入力チップ用: 対象inputの末尾へ追記
    window.pAppend = function (inputId, value) {
        var el = document.getElementById(inputId);
        if (el) { el.value += value; el.focus(); }
    };

    window.pClose = function (id) {
        var m = document.getElementById(id);
        if (m) { m.hidden = true; }
        document.body.style.overflow = '';
    };

    window.pCloseAll = function () {
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { window.pCloseAll(); }
    });

    // オーバーレイ(背景)クリックで閉じる。ダイアログ内クリックは対象外
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('proto-modal')) { t.hidden = true; }
    });
})();
