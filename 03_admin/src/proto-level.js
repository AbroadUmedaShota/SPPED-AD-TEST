// proto-level.js — 表示シナリオ(Lv1〜Lv4)の切替
// スプシ「管理画面_たたき台」G列(閲覧可否+データ範囲)のモック表現。実際の認可制御ではない。
// マークアップ側の宣言:
//   data-min-lv="N" / data-max-lv="N" … 現在シナリオのLvが範囲外なら非表示
//   <main data-page-min-lv="N">        … 範囲外シナリオではページ本文をガード表示に差し替え
(function () {
    'use strict';

    var LEVELS = {
        lv1: { n: 1, label: 'Lv1 Operator',      mail: 'l.wang@officeworks.co.jp', group: 'オフィスワークス株式会社' },
        lv2: { n: 2, label: 'Lv2 OperatorAdmin', mail: 'a.yamamoto@abroad-o.com',  group: 'アブロード本体' },
        lv3: { n: 3, label: 'Lv3 Admin',         mail: 'admin@abroad-o.com',       group: '' },
        lv4: { n: 4, label: 'Lv4 MasterAdmin',   mail: 'master@abroad-o.com',      group: '' }
    };
    var KEY = 'adminMockLevel'; // 既定はLv4(MasterAdmin)

    function currentKey() {
        var v = localStorage.getItem(KEY);
        return LEVELS[v] ? v : 'lv4';
    }

    function applyVisibility(lv) {
        document.querySelectorAll('[data-min-lv], [data-max-lv]').forEach(function (el) {
            var min = parseInt(el.getAttribute('data-min-lv') || '1', 10);
            var max = parseInt(el.getAttribute('data-max-lv') || '4', 10);
            if (lv >= min && lv <= max) {
                el.style.display = el.getAttribute('data-lv-display') || '';
            } else {
                el.style.display = 'none';
            }
        });
    }

    function applyPage(key) {
        var conf = LEVELS[key];
        document.body.setAttribute('data-level', key);
        applyVisibility(conf.n);

        var main = document.getElementById('main-content');
        if (!main) { return; }

        var pageMin = parseInt(main.getAttribute('data-page-min-lv') || '1', 10);
        if (conf.n < pageMin) {
            main.innerHTML =
                '<div class="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">' +
                '<div style="background:#fff;border:1px solid #e2e6ed;border-radius:8px;padding:40px 32px;text-align:center">' +
                '<div style="font-size:16px;font-weight:700;color:#1f2733">この画面は ' + conf.label + ' シナリオでは表示されません</div>' +
                '<div style="margin-top:10px;font-size:12.5px;color:#5b6577">閲覧可能: Lv' + pageMin + '以上(スプシ「管理画面_たたき台」G列)。ヘッダー右上の表示シナリオで切り替えられます。</div>' +
                '</div></div>';
            return;
        }

        // Lv1〜2は自グループ範囲であることを帯で明示(モックのためデータの絞り込みはしない)
        if (conf.n <= 2 && !document.getElementById('proto-range-note')) {
            var band = document.createElement('div');
            band.id = 'proto-range-note';
            band.innerHTML =
                '<div style="max-width:72rem;margin:0 auto;padding:16px 24px 0">' +
                '<div style="font-size:11.5px;color:#8a6414;background:#fdf6ec;border:1px solid #e8cf9e;border-radius:6px;padding:6px 12px;display:inline-block">' +
                '表示シナリオ ' + conf.label + ': 表示範囲は自グループ(' + conf.group + ')のみ(スプシG列)。モックの見せ分けのため一覧データは絞り込んでいません。' +
                '</div></div>';
            main.insertBefore(band, main.firstChild);
        }
    }

    // ヘッダー・サイドバーは admin.js が非同期注入するため、現れたタイミングで配線する
    function wireChrome(key) {
        var sel = document.getElementById('levelSelect');
        if (sel && !sel.dataset.wired) {
            sel.dataset.wired = '1';
            sel.value = key;
            sel.addEventListener('change', function () {
                localStorage.setItem(KEY, sel.value);
                location.reload();
            });
        }
        var mail = document.getElementById('profileMail');
        var badge = document.getElementById('profileLevel');
        if (mail) { mail.textContent = LEVELS[key].mail; }
        if (badge) { badge.textContent = LEVELS[key].label; }
        applyVisibility(LEVELS[key].n); // サイドバーnavの data-min-lv を再適用
    }

    document.addEventListener('DOMContentLoaded', function () {
        var key = currentKey();
        applyPage(key);
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            wireChrome(key);
            if (tries > 30) { clearInterval(timer); }
        }, 100);
    });
})();
