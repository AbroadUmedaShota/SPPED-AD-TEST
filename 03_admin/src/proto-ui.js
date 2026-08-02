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

    // 一覧のページネーション(モック): 行に data-pg="n"、リスト容器に id、
    // ページャ容器に id="{listId}-pager"、件数表示に id="{listId}-range" を付けて使う
    window.pPage = function (listId, n) {
        var list = document.getElementById(listId);
        if (!list) { return; }
        list.querySelectorAll('[data-pg]').forEach(function (r) {
            // 行はインラインstyleに display:grid を持つため、''でのクリアだと
            // 非表示指定ごとgridも消えてblockに落ちる。gridを明示して復元する
            r.style.display = (r.getAttribute('data-pg') === String(n)) ? 'grid' : 'none';
        });
        var pager = document.getElementById(listId + '-pager');
        if (!pager) { return; }
        pager.setAttribute('data-current', String(n));
        pager.querySelectorAll('button[data-page]').forEach(function (b) {
            var on = (b.getAttribute('data-page') === String(n));
            b.style.background = on ? '#3467d6' : '#fff';
            b.style.color = on ? '#fff' : '#374151';
            b.style.border = '1px solid ' + (on ? '#3467d6' : '#c8cdd8');
            b.style.fontWeight = on ? '700' : '400';
        });
        var act = pager.querySelector('button[data-page="' + n + '"]');
        var lbl = document.getElementById(listId + '-range');
        if (act && lbl) { lbl.textContent = act.getAttribute('data-range') || ''; }
    };

    window.pPageStep = function (listId, delta) {
        var pager = document.getElementById(listId + '-pager');
        if (!pager) { return; }
        var next = (parseInt(pager.getAttribute('data-current') || '1', 10)) + delta;
        if (pager.querySelector('button[data-page="' + next + '"]')) { window.pPage(listId, next); }
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
