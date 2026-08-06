// proto-ui.js — 管理画面モックの共通モーダル制御(design_handoff_admin_ui/prototype.dc.html 準拠)
// .proto-modal(オーバーレイ) > .proto-dialog(本体) の構造を前提に、
// 開閉・Escキー・オーバーレイクリックの3系統クローズを提供する。
(function () {
    'use strict';

    var lastFocused = null;

    // モーダル表示中は背面(ヘッダー・サイドバー・メイン)を inert 化し、Tab移動もクリックも遮断する
    function setBackgroundInert(on) {
        ['header-placeholder', 'sidebar-placeholder', 'main-content'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) { return; }
            if (on) { el.setAttribute('inert', ''); } else { el.removeAttribute('inert'); }
        });
    }

    var FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

    function openModal() {
        return document.querySelector('.proto-modal:not([hidden])');
    }

    /** モーダル内で実際にフォーカスできる要素を、表示順に返す */
    function focusable(m) {
        return Array.prototype.filter.call(m.querySelectorAll(FOCUSABLE), function (el) {
            if (el.disabled || el.getAttribute('tabindex') === '-1') { return false; }
            if (el.closest('[hidden], [inert]')) { return false; }
            return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
    }

    window.pOpen = function (id) {
        // 正本(prototype)は常に単一モーダル表示のため、開く前に他をすべて閉じる
        var wasOpen = document.querySelector('.proto-modal:not([hidden])');
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        var m = document.getElementById(id);
        if (!m) {
            document.body.style.overflow = '';
            setBackgroundInert(false);
            return;
        }
        if (!wasOpen) { lastFocused = document.activeElement; }
        m.hidden = false;
        document.body.style.overflow = 'hidden';
        setBackgroundInert(true);
        // 初期フォーカス: data-initial-focus 指定を最優先(破壊的な既定アクションを避けたいモーダル用)。
        // 無ければ主ボタン(最後のbutton)、それも無ければその他のフォーカス可能要素
        var first = m.querySelector('[data-initial-focus]');
        if (!first) {
            var btns = Array.prototype.filter.call(m.querySelectorAll('button'), function (b) { return !b.disabled; });
            first = btns.length ? btns[btns.length - 1] : m.querySelector('[href], input, textarea, select, [tabindex]');
        }
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
        if (!(e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z'))) { return; }
        var el = e.target;
        if (!el || el.dataset === undefined || el.dataset.prevUndo === undefined) { return; }
        e.preventDefault();
        var cur = el.value;
        el.value = el.dataset.prevUndo;
        el.dataset.prevUndo = cur;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // tabindex付きのクリック要素(一覧行・カード・候補・チップ・×ボタン)を Enter / Space でも発火させる。
    // 一覧行は div のため既定のキーボード操作を持たない
    document.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) { return; }
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }  // 修飾キー付きはショートカット側に譲る
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        var t = e.target;
        if (!t || !t.closest) { return; }
        // 行内のボタン・リンク・入力欄は各要素の既定動作に委ねる(行の遷移を二重発火させない)
        if (t.closest('button, a, input, select, textarea')) { return; }
        var el = t.closest('[tabindex]');
        if (!el || !(el.hasAttribute('onclick') || el.onclick)) { return; }
        e.preventDefault();
        el.click();
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
            // data-out は絞り込みで外れた行。ページに関わらず常に隠す
            var on = !r.hasAttribute('data-out') && r.getAttribute('data-pg') === String(n);
            r.style.display = on ? 'grid' : 'none';
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
        // 端に達したページ送り矢印は淡色化(動作は元々no-op)
        var nums = Array.prototype.map.call(pager.querySelectorAll('button[data-page]'), function (b) { return parseInt(b.getAttribute('data-page'), 10); });
        var steppers = Array.prototype.filter.call(pager.querySelectorAll('button'), function (b) { return !b.hasAttribute('data-page'); });
        if (steppers.length === 2 && nums.length) {
            steppers[0].style.color = (n <= Math.min.apply(null, nums)) ? '#c3c9d4' : '#374151';
            steppers[1].style.color = (n >= Math.max.apply(null, nums)) ? '#c3c9d4' : '#374151';
        }
    };

    // 一覧の並び替え(モック): 容器に data-sortable を付けると見出しの各セルが押せるようになる。
    // 値は行の同じ位置のセルのテキストから取り、数値・件数(1,234)・日付は数として比較する。
    // 並び替えたあとはページを振り直す(pPageSize が data-pg を付け直す)
    var SORT_ARROW = 'margin-left:4px;font-size:10px;color:#3467d6';

    function sortRows(list) {
        // 見出しを除いた子のうち、ページングを持つならその行、無ければ子をそのまま扱う
        var kids = Array.prototype.slice.call(list.children).slice(1);
        var paged = kids.filter(function (r) { return r.hasAttribute('data-pg'); });
        if (paged.length) { return paged; }
        return kids.filter(function (r) { return r.id !== (list.id + '-empty'); });
    }
    function sortText(row, col) {
        var c = row.children[col];
        return c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
    }
    function sortNum(t) {
        // 値の全体が数値のときだけ数として扱う。U-1002 や 2026/07/31 09:12 を
        // 数と誤認しないよう、部分一致では拾わない
        var v = String(t).replace(/[,\s]/g, '');
        var m = /^[-+]?\d+(\.\d+)?(%|円|件|名|通|回|人|分)?$/.exec(v);
        return m ? parseFloat(m[0]) : null;
    }
    function paintSortHead(list) {
        var head = list.firstElementChild;
        if (!head) { return; }
        var col = list.getAttribute('data-sort-col');
        var dir = list.getAttribute('data-sort-dir') || 'asc';
        Array.prototype.forEach.call(head.children, function (c) {
            if (!c.hasAttribute('data-sort-html')) { return; }
            var on = (c.getAttribute('data-sort-col') === col);
            c.innerHTML = c.getAttribute('data-sort-html')
                + (on ? '<span style="' + SORT_ARROW + '">' + (dir === 'asc' ? '▲' : '▼') + '</span>' : '');
            c.setAttribute('aria-sort', on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
        });
    }
    window.pSort = function (listId, col) {
        var list = document.getElementById(listId);
        if (!list) { return; }
        var same = (list.getAttribute('data-sort-col') === String(col));
        var dir = (same && list.getAttribute('data-sort-dir') === 'asc') ? 'desc' : 'asc';
        list.setAttribute('data-sort-col', String(col));
        list.setAttribute('data-sort-dir', dir);
        var rows = sortRows(list);
        var numeric = rows.every(function (r) {
            var t = sortText(r, col);
            return !t || t === '—' || sortNum(t) !== null;
        });
        rows.sort(function (a, b) {
            var x = sortText(a, col), y = sortText(b, col), d;
            if (numeric) {
                var nx = sortNum(x), ny = sortNum(y);
                // 値が無い行(— や空)は末尾へ寄せる
                if (nx === null && ny === null) { return 0; }
                if (nx === null) { return 1; }
                if (ny === null) { return -1; }
                d = nx - ny;
            } else {
                d = x.localeCompare(y, 'ja');
            }
            return dir === 'asc' ? d : -d;
        });
        rows.forEach(function (r) { list.appendChild(r); });
        // 行以外(該当なしの表示など)は末尾へ戻す
        Array.prototype.filter.call(list.children, function (r) {
            return r !== list.firstElementChild && !r.hasAttribute('data-pg');
        }).forEach(function (r) { list.appendChild(r); });
        paintSortHead(list);
        if (list.querySelector('[data-pg]')) {
            window.pPageSize(listId, parseInt(list.getAttribute('data-page-size') || '10', 10));
        }
    };
    window.pSortable = function (listId) {
        var list = document.getElementById(listId);
        if (!list) { return; }
        var head = list.firstElementChild;
        if (!head) { return; }
        Array.prototype.forEach.call(head.children, function (c, i) {
            var base = c.innerHTML.replace(/\s*[▲▼]\s*/g, '');
            if (!c.textContent.replace(/[▲▼\s]/g, '') || c.hasAttribute('data-no-sort')) { return; }
            c.setAttribute('data-sort-html', base);
            c.setAttribute('data-sort-col', String(i));
            c.setAttribute('role', 'button');
            c.setAttribute('tabindex', '0');
            c.style.cursor = 'pointer';
            c.style.userSelect = 'none';
            c.title = c.textContent.replace(/[▲▼]/g, '').trim() + 'で並び替え';
            c.onclick = function () { window.pSort(listId, i); };
            // 既定の並び順が示されている列を初期状態にする
            if (/[▲▼]/.test(c.textContent) && !list.hasAttribute('data-sort-col')) {
                list.setAttribute('data-sort-col', String(i));
                list.setAttribute('data-sort-dir', /▲/.test(c.textContent) ? 'asc' : 'desc');
            }
        });
        paintSortHead(list);
    };

    // 表示件数の切替。行を再分割してページ番号ボタンを作り直す
    // 絞り込みで外れた行(data-out)は数えない
    window.pPageSize = function (listId, size) {
        var list = document.getElementById(listId);
        var pager = document.getElementById(listId + '-pager');
        if (!list || !size) { return; }
        list.setAttribute('data-page-size', String(size));
        var rows = Array.prototype.slice.call(list.querySelectorAll('[data-pg]:not([data-out])'));
        var empty = document.getElementById(listId + '-empty');
        if (empty) { empty.style.display = rows.length ? 'none' : 'block'; }
        if (!pager) {
            // ページャを持たない一覧は絞り込み結果をそのまま表示する
            list.querySelectorAll('[data-pg]').forEach(function (r) {
                r.style.display = r.hasAttribute('data-out') ? 'none' : 'grid';
            });
            return;
        }
        if (!rows.length) {
            Array.prototype.forEach.call(pager.querySelectorAll('button[data-page]'), function (b) {
                b.parentNode.removeChild(b);
            });
            list.querySelectorAll('[data-pg]').forEach(function (r) { r.style.display = 'none'; });
            var lbl0 = document.getElementById(listId + '-range');
            if (lbl0) { lbl0.textContent = '0〜0'; }
            return;
        }
        rows.forEach(function (r, i) { r.setAttribute('data-pg', String(Math.floor(i / size) + 1)); });
        var pages = Math.ceil(rows.length / size);
        var tmpl = pager.querySelector('button[data-page]');
        var style = tmpl ? tmpl.getAttribute('style') : '';
        var steppers = Array.prototype.filter.call(pager.querySelectorAll('button'), function (b) {
            return !b.hasAttribute('data-page');
        });
        Array.prototype.forEach.call(pager.querySelectorAll('button[data-page]'), function (b) {
            b.parentNode.removeChild(b);
        });
        for (var i = 1; i <= pages; i++) {
            var btn = document.createElement('button');
            btn.setAttribute('data-page', String(i));
            btn.setAttribute('data-range', ((i - 1) * size + 1) + '\u301c' + Math.min(i * size, rows.length));
            btn.setAttribute('style', style);
            btn.textContent = String(i);
            btn.onclick = (function (n) { return function () { window.pPage(listId, n); }; })(i);
            pager.insertBefore(btn, steppers[1] || null);
        }
        // 1ページに収まる場合もページャは残す(ページ送りは pPage 側で淡色化される)
        window.pPage(listId, 1);
    };

    // --- 一覧の絞り込み(モック) ---
    // 行に data-f-<key>、絞り込みUIに data-f-key、一覧容器に data-filter-keys、
    // 絞り込みバーに data-filter-for="{listId}" を付けて使う。
    // 他画面からは同名のクエリ(?uid=U-1052 等)で同じ条件を引き継ぐ
    var P_EXACT = { status: 1, plan: 1, coupon: 1, group: 1, lv: 1, lang: 1, month: 1, type: 1, today: 1, isnew: 1, premium: 1 };
    var P_LABEL = {
        uid: 'ユーザーID', sid: 'アンケートID', oid: 'オペレーターID', cid: 'クーポンID',
        company: '会社名', name: '氏名', mail: 'メールアドレス', code: 'コード', cname: 'クーポン名',
        status: '状態', plan: '納期区分', group: '所属グループ', lv: '権限', lang: '言語',
        month: '発行月', type: '操作種別', target: '対象', actor: '操作者', any: '氏名・メール・ID', from: '開始日', to: '終了日',
        coupon: 'クーポン', today: '本日会期のみ', isnew: '新着のみ', premium: 'プレミアム'
    };

    function pFilterBar(listId) {
        return document.querySelector('[data-filter-for="' + listId + '"]');
    }

    function pRenderChip(listId, conds) {
        var list = document.getElementById(listId);
        var chip = document.getElementById(listId + '-chip');
        var keys = Object.keys(conds);
        if (!chip) {
            if (!keys.length) { return; }
            chip = document.createElement('div');
            chip.id = listId + '-chip';
            chip.setAttribute('style', 'margin-top:12px;display:flex;align-items:center;gap:10px;'
                + 'background:#eef2fb;border:1px solid #b9caee;border-radius:6px;padding:7px 12px;'
                + 'font-size:12.5px;color:#1f3d80');
            list.parentNode.insertBefore(chip, list);
        }
        if (!keys.length) { chip.style.display = 'none'; return; }
        var text = keys.map(function (k) {
            var label = P_LABEL[k] || k;
            return (conds[k] === '1' && P_EXACT[k]) ? label : label + ' = ' + conds[k];
        }).join(' / ');
        chip.innerHTML = '';
        var span = document.createElement('span');
        span.textContent = '絞り込み中: ' + text;
        var btn = document.createElement('button');
        btn.textContent = '解除';
        btn.setAttribute('style', 'background:#fff;color:#3467d6;border:1px solid #b9caee;border-radius:5px;'
            + 'padding:3px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit');
        btn.onclick = function () { window.pClearSearch(listId); };
        chip.appendChild(span);
        chip.appendChild(btn);
        chip.style.display = 'flex';
    }

    window.pFilter = function (listId, conds) {
        var list = document.getElementById(listId);
        if (!list) { return; }
        var use = {};
        Object.keys(conds || {}).forEach(function (k) {
            var v = String(conds[k] === undefined || conds[k] === null ? '' : conds[k]).trim();
            if (v) { use[k] = v; }
        });
        var keys = Object.keys(use);
        Array.prototype.forEach.call(list.querySelectorAll('[data-pg]'), function (r) {
            var hit = keys.every(function (k) {
                // from/to は data-f-date に対する期間比較(ISO形式なので文字列比較で足りる)
                if (k === 'from' || k === 'to') {
                    var d = r.getAttribute('data-f-date');
                    if (!d) { return false; }
                    return (k === 'from') ? (d >= use[k]) : (d <= use[k]);
                }
                var have = r.getAttribute('data-f-' + k);
                if (have === null) { return false; }
                return P_EXACT[k] ? (have === use[k])
                    : (have.toLowerCase().indexOf(use[k].toLowerCase()) >= 0);
            });
            if (hit) { r.removeAttribute('data-out'); } else { r.setAttribute('data-out', '1'); }
        });
        var shown = list.querySelectorAll('[data-pg]:not([data-out])').length;
        var totalEl = document.getElementById(listId + '-total');
        if (totalEl) { totalEl.textContent = shown.toLocaleString('en-US'); }
        pRenderChip(listId, use);
        window.pPageSize(listId, parseInt(list.getAttribute('data-page-size') || '10', 10));
    };

    // 「検索」ボタン: 絞り込みバーの入力値を集めて適用する
    window.pSearch = function (listId) {
        var bar = pFilterBar(listId);
        if (!bar) { return; }
        var conds = {};
        Array.prototype.forEach.call(bar.querySelectorAll('[data-f-key]'), function (el) {
            var k = el.getAttribute('data-f-key');
            conds[k] = (el.type === 'checkbox') ? (el.checked ? '1' : '') : el.value;
        });
        window.pFilter(listId, conds);
    };

    // 「条件をクリア」/絞り込みバッジの「解除」: 入力とURLのクエリを落として全件へ戻す
    window.pClearSearch = function (listId) {
        var bar = pFilterBar(listId);
        if (bar) {
            Array.prototype.forEach.call(bar.querySelectorAll('[data-f-key]'), function (el) {
                if (el.type === 'checkbox') { el.checked = false; }
                else if (el.tagName === 'SELECT') { el.selectedIndex = 0; }
                else { el.value = ''; }
            });
        }
        if (window.history && history.replaceState) {
            history.replaceState(null, '', location.pathname);
        }
        window.pFilter(listId, {});
    };

    // 起動時: URLのクエリのうち data-filter-keys に載っているものを適用する
    function pApplyUrlFilter(list) {
        var listId = list.id;
        var allowed = (list.getAttribute('data-filter-keys') || '').split(',').map(function (s) { return s.trim(); });
        var q = new URLSearchParams(location.search);
        var conds = {};
        allowed.forEach(function (k) { if (k && q.get(k)) { conds[k] = q.get(k); } });
        if (!Object.keys(conds).length) { return; }
        var bar = pFilterBar(listId);
        if (bar) {
            Object.keys(conds).forEach(function (k) {
                var el = bar.querySelector('[data-f-key="' + k + '"]');
                if (!el) { return; }
                if (el.type === 'checkbox') { el.checked = (conds[k] === '1'); }
                else { el.value = conds[k]; }
            });
        }
        window.pFilter(listId, conds);
    }

    window.pPageStep = function (listId, delta) {
        var pager = document.getElementById(listId + '-pager');
        if (!pager) { return; }
        var next = (parseInt(pager.getAttribute('data-current') || '1', 10)) + delta;
        if (pager.querySelector('button[data-page="' + next + '"]')) { window.pPage(listId, next); }
    };


    // 名刺画像エンジン: ホバー追従拡大・クリック固定・90度回転(回転時は収まるよう自動縮小)
    // 名刺入力画面・名刺情報照合の共用。+/− と R はキーボードから、入力欄フォーカス中は Alt を併用する
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


    // 操作の結果を短く知らせる。実データを持たないモックでも、押した操作が通ったことを示す
    window.pToast = function (msg, kind) {
        var box = document.getElementById('p-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'p-toast';
            box.setAttribute('role', 'status');
            box.setAttribute('aria-live', 'polite');
            box.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);'
                + 'z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;'
                + 'pointer-events:none';
            document.body.appendChild(box);
        }
        var t = document.createElement('div');
        t.style.cssText = 'background:' + (kind === 'error' ? '#c23934' : '#1f2733')
            + ';color:#fff;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;'
            + 'box-shadow:0 8px 24px rgba(12,18,30,.28);opacity:0;transition:opacity .12s';
        t.textContent = msg;
        box.appendChild(t);
        requestAnimationFrame(function () { t.style.opacity = '1'; });
        setTimeout(function () {
            t.style.opacity = '0';
            setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 200);
        }, 2600);
    };

    // 画面のデータからCSVを組み立てて保存する。Excelで開けるようBOM付きUTF-8・CRLF
    window.pCsv = function (name, rows) {
        var body = rows.map(function (r) {
            return r.map(function (v) {
                v = (v === undefined || v === null) ? '' : String(v);
                return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(',');
        }).join('\r\n');
        var blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 0);
        window.pToast(name + ' を保存しました');
    };

    // 一覧の表示中の行からCSVを作る。列見出しは一覧のヘッダーをそのまま使う。
    // 操作ログ・オペレーター実績確認の共用
    window.pListCsv = function (listId, name) {
        var list = document.getElementById(listId);
        if (!list) { return; }
        var head = list.firstElementChild;
        var cols = [];
        Array.prototype.forEach.call(head.children, function (c) {
            cols.push(c.textContent.replace(/[▼▲]/g, '').trim());
        });
        var rows = [cols];
        Array.prototype.forEach.call(list.querySelectorAll('[data-pg]:not([data-out])'), function (r) {
            var line = [];
            Array.prototype.forEach.call(r.children, function (c) {
                line.push(c.textContent.replace(/\s+/g, ' ').trim());
            });
            rows.push(line);
        });
        // 操作列は出力しない
        var last = cols.length - 1;
        if (/^操作$/.test(cols[last])) {
            rows = rows.map(function (r) { return r.slice(0, last); });
        }
        window.pCsv(name, rows);
    };

    // 回答データDLモーダル(#mDl)の選択で実際にファイルを保存する。
    // 名刺画像は実ファイルを作れないため受付のみ知らせる。
    // アンケート管理・アンケート詳細・照合結果一覧の共用
    window.pDlPick = function (kind) {
        var sid = (document.querySelector('#mDl [data-slot="dlSid"]') || {}).textContent
            || (document.getElementById('mDl').innerText.match(/SV-\d+/) || ['export'])[0];
        if (kind === 'zip') {
            window.pToast(sid + ' の名刺画像(ZIP)の取得を受け付けました');
            window.pClose('mDl');
            return;
        }
        var head = ['回答ID', '氏名', '会社名', '部署名', '役職名', 'メールアドレス', '電話番号', '受信日時'];
        var rows = [head];
        var n = (kind === 'all') ? 8 : 5;
        for (var i = 1; i <= n; i++) {
            rows.push(['#' + (8800 + i), '—', '—', '—', '—', '—', '—', '—']);
        }
        window.pCsv(sid + (kind === 'all' ? '_all' : '_final') + '.csv', rows);
        window.pClose('mDl');
    };

    // 一覧の行を書き換える。cells は 0 起点の位置 → HTML
    window.pRowSet = function (row, cells, attrs) {
        if (!row) { return; }
        var kids = row.children;
        Object.keys(cells || {}).forEach(function (i) {
            if (kids[i]) { kids[i].innerHTML = cells[i]; }
        });
        Object.keys(attrs || {}).forEach(function (k) {
            row.setAttribute('data-f-' + k, attrs[k]);
        });
    };

    // 一覧の行を取り出す(data-f-<key> の完全一致)
    window.pRow = function (listId, key, val) {
        return document.querySelector('#' + listId + ' [data-f-' + key + '="' + val + '"]');
    };

    window.pClose = function (id) {
        var m = document.getElementById(id);
        if (m) { m.hidden = true; }
        document.body.style.overflow = '';
        setBackgroundInert(false);
        restoreFocus();
    };

    window.pCloseAll = function () {
        var had = document.querySelector('.proto-modal:not([hidden])');
        document.querySelectorAll('.proto-modal').forEach(function (m) { m.hidden = true; });
        document.body.style.overflow = '';
        setBackgroundInert(false);
        if (had) { restoreFocus(); }
    };

    document.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) { return; }
        if (e.key === 'Escape') { window.pCloseAll(); }
        if (e.key === 'Tab') { trapTab(e); }
    });

    // Tab をモーダルの中で循環させる。
    // 背面は inert なのでフォーカスが背面の要素へ移ることはないが、そのままだと
    // body へ抜けてしまい、キーボードだけではモーダルのボタンへ戻れなくなる
    function trapTab(e) {
        var m = openModal();
        if (!m) { return; }
        var items = focusable(m);
        if (!items.length) { return; }
        var at = items.indexOf(document.activeElement);
        var next;
        if (at < 0) {
            // すでに外へ出ている場合は端から入れ直す
            next = e.shiftKey ? items[items.length - 1] : items[0];
        } else if (e.shiftKey && at === 0) {
            next = items[items.length - 1];
        } else if (!e.shiftKey && at === items.length - 1) {
            next = items[0];
        } else {
            return;     // 中ほどの移動はブラウザに任せる
        }
        e.preventDefault();
        next.focus();
    }

    // オーバーレイ(背景)クリックで閉じる。ダイアログ内クリックは対象外
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('proto-modal')) { window.pCloseAll(); }
    });

    // 初期化: ページャの初期状態適用と、理由必須ボタン(data-requires)の非活性制御
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[id$="-pager"]').forEach(function (pager) {
            var listId = pager.id.slice(0, -6);
            var list = document.getElementById(listId);
            if (!list) { return; }
            if (!list.getAttribute('data-page-size')) { list.setAttribute('data-page-size', '10'); }
            window.pPage(listId, parseInt(pager.getAttribute('data-current') || '1', 10));
        });
        // 他画面から引き継いだ絞り込み条件を適用する(ページャの有無は問わない)
        document.querySelectorAll('[data-filter-keys]').forEach(function (list) {
            if (list.id) { pApplyUrlFilter(list); }
        });
        document.querySelectorAll('button[data-requires]').forEach(function (btn) {
            var inp = document.getElementById(btn.getAttribute('data-requires'));
            if (!inp) { return; }
            function sync() {
                var ok = !!inp.value.trim();
                btn.disabled = !ok;
                btn.style.opacity = ok ? '' : '0.55';
                btn.style.cursor = ok ? 'pointer' : 'default';
            }
            inp.addEventListener('input', sync);
            sync();
        });
    });

    // data-sortable が付いた一覧に並び替えを配線する
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-sortable]').forEach(function (l) {
            if (l.id) { window.pSortable(l.id); }
        });
    });
})();
