// proto-ui.js — 管理画面モックの共通モーダル制御(design_handoff_admin_ui/prototype.dc.html 準拠)
// .proto-modal(オーバーレイ) > .proto-dialog(本体) の構造を前提に、
// 開閉・Escキー・オーバーレイクリックの3系統クローズを提供する。
(function () {
    'use strict';

    var lastFocused = null;

    window.pOpen = function (id) {
        // 正本(prototype)は常に単一モーダル表示のため、開く前に他をすべて閉じる
        var wasOpen = document.querySelector('.proto-modal:not([hidden])');
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        var m = document.getElementById(id);
        if (!m) { return; }
        if (!wasOpen) { lastFocused = document.activeElement; }
        m.hidden = false;
        document.body.style.overflow = 'hidden';
        // 初期フォーカスは主ボタン(最後のbutton)。無ければその他のフォーカス可能要素
        var btns = m.querySelectorAll('button');
        var first = btns.length ? btns[btns.length - 1] : m.querySelector('[href], input, textarea, select, [tabindex]');
        if (first) { first.focus(); }
    };

    function restoreFocus() {
        if (lastFocused && document.body.contains(lastFocused) && lastFocused.focus) {
            lastFocused.focus();
        }
        lastFocused = null;
    }

    // 値の設定(1段Undo付き)。複写・チップ由来の変更は Ctrl+Z で直前の値に戻せる
    window.pApplyValue = function (el, value) {
        if (!el) { return; }
        el.dataset.prevUndo = el.value;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // 候補値の複写用: 対象inputへ値を設定し全選択(そのまま打ち直せる)
    window.pSet = function (inputId, value) {
        var el = document.getElementById(inputId);
        if (!el) { return; }
        window.pApplyValue(el, value);
        el.focus();
        if (el.setSelectionRange) { el.setSelectionRange(0, el.value.length); }
    };

    // 手入力が入ったら複写Undoは破棄し、ブラウザ標準のUndoへ返す
    document.addEventListener('input', function (e) {
        var el = e.target;
        if (e.isTrusted && el && el.dataset && el.dataset.prevUndo !== undefined) {
            delete el.dataset.prevUndo;
        }
    });

    // Ctrl+Z: 複写・チップ由来の変更を直前の値と入れ替える(もう一度でやり直し)
    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey && (e.key === 'z' || e.key === 'Z'))) { return; }
        var el = e.target;
        if (!el || el.dataset === undefined || el.dataset.prevUndo === undefined) { return; }
        e.preventDefault();
        var cur = el.value;
        el.value = el.dataset.prevUndo;
        el.dataset.prevUndo = cur;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // tabindex付きのクリック要素(候補・チップ・×ボタン)を Enter / Space でも発火させる
    document.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) { return; }
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }  // 修飾キー付きはショートカット側に譲る
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        var t = e.target;
        if (t && t.tagName === 'SPAN' && t.hasAttribute('tabindex') && (t.hasAttribute('onclick') || t.onclick)) {
            e.preventDefault();
            t.click();
        }
    });

    // よく使う入力チップ用: 対象inputのカーソル位置へ挿入(選択範囲は置換)
    window.pAppend = function (inputId, value) {
        var el = document.getElementById(inputId);
        if (!el) { return; }
        el.dataset.prevUndo = el.value;
        var st = el.selectionStart;
        var en = el.selectionEnd;
        if (typeof st === 'number') {
            el.value = el.value.slice(0, st) + value + el.value.slice(en);
            el.focus();
            var pos = st + value.length;
            el.setSelectionRange(pos, pos);
        } else {
            el.value += value;
            el.focus();
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
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
        if (act && lbl && act.getAttribute('data-range')) { lbl.textContent = act.getAttribute('data-range'); }
    };

    window.pPageStep = function (listId, delta) {
        var pager = document.getElementById(listId + '-pager');
        if (!pager) { return; }
        var next = (parseInt(pager.getAttribute('data-current') || '1', 10)) + delta;
        if (pager.querySelector('button[data-page="' + next + '"]')) { window.pPage(listId, next); }
    };


    // 名刺画像エンジン: ホバー追従拡大・クリック固定・90度回転(回転時は収まるよう自動縮小)
    // 入力個票・照合個票の共用。+/− と R はキーボードから、入力欄フォーカス中は Alt を併用する
    window.pInitCardZoom = function () {
        if (window.__cardZoomInit) { return; }
        window.__cardZoomInit = true;
        var zoom = 2;
        var current = null;
        function fitScale(img) {
            if (parseInt(img.dataset.rot || '0', 10) % 180 === 0) { return 1; }
            var w = img.offsetWidth;
            var h = img.offsetHeight;
            if (!w || !h) { return 1; }
            return Math.min(w / h, h / w);
        }
        function apply(img, scaled) {
            if (!scaled) { img.style.transformOrigin = 'center center'; }
            var sc = (scaled ? zoom : 1) * fitScale(img);
            img.style.transform = (sc !== 1 ? 'scale(' + sc + ') ' : '') + 'rotate(' + (img.dataset.rot || 0) + 'deg)';
        }
        function refreshLabel() {
            var el = document.getElementById('zoomLabel');
            if (el) { el.textContent = 'ホバー拡大・クリック固定 ×' + zoom.toFixed(1); }
        }
        window.pZoomDelta = function (d) {
            zoom = Math.min(4, Math.max(1, Math.round((zoom + d) * 10) / 10));
            refreshLabel();
            document.querySelectorAll('.card-zoom img').forEach(function (img) {
                if (img.dataset.pinned === '1') { apply(img, true); }
            });
        };
        window.pRotate = function () {
            var img = current;
            if (!img || !document.body.contains(img) || img.offsetParent === null) {
                img = document.querySelector('.card-zoom img');
            }
            if (!img) { return; }
            img.dataset.rot = String((parseInt(img.dataset.rot || '0', 10) + 90) % 360);
            apply(img, img.dataset.pinned === '1');
        };
        window.pResetCardZoom = function () {
            document.querySelectorAll('.card-zoom img').forEach(function (img) {
                img.dataset.rot = '0';
                img.dataset.pinned = '';
                img.style.transform = '';
                img.style.outline = '';
                img.style.cursor = 'zoom-in';
            });
            current = null;
            refreshLabel();
        };
        document.querySelectorAll('.card-zoom img').forEach(function (img) {
            img.addEventListener('mouseenter', function () { current = img; });
            img.addEventListener('mousemove', function (e) {
                if (img.dataset.pinned === '1') { return; }
                var rc = img.getBoundingClientRect();
                img.style.transformOrigin = ((e.clientX - rc.left) / rc.width * 100) + '% ' + ((e.clientY - rc.top) / rc.height * 100) + '%';
                apply(img, true);
            });
            img.addEventListener('mouseleave', function () {
                if (img.dataset.pinned === '1') { return; }
                apply(img, false);
            });
            img.addEventListener('click', function () {
                if (img.dataset.pinned === '1') {
                    img.dataset.pinned = '';
                    img.style.outline = '';
                    img.style.cursor = 'zoom-in';
                    apply(img, false);
                } else {
                    img.dataset.pinned = '1';
                    img.style.outline = '2px solid #3467d6';
                    img.style.cursor = 'zoom-out';
                    apply(img, true);
                }
            });
        });
        document.addEventListener('keydown', function (e) {
            if (e.isComposing || e.keyCode === 229) { return; }
            if (e.ctrlKey || e.metaKey) { return; }  // Ctrl+R(リロード)等のブラウザ操作は奪わない
            if (document.querySelector('.proto-modal:not([hidden])')) { return; }
            var t = e.target;
            var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
            if (inField && !e.altKey) { return; }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); window.pZoomDelta(0.5); }
            else if (e.key === '-') { e.preventDefault(); window.pZoomDelta(-0.5); }
            else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); window.pRotate(); }
        });
        refreshLabel();
    };

    window.pClose = function (id) {
        var m = document.getElementById(id);
        if (m) { m.hidden = true; }
        document.body.style.overflow = '';
        restoreFocus();
    };

    window.pCloseAll = function () {
        var had = document.querySelector('.proto-modal:not([hidden])');
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        document.body.style.overflow = '';
        if (had) { restoreFocus(); }
    };

    document.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) { return; }
        if (e.key === 'Escape') { window.pCloseAll(); }
    });

    // オーバーレイ(背景)クリックで閉じる。ダイアログ内クリックは対象外
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('proto-modal')) { window.pCloseAll(); }
    });
})();
