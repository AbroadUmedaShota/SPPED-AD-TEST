// support-memos.js — 対応履歴(ユーザー詳細・アンケート詳細)の共用モックデータ。
// 記録の実体は「対象(ユーザー or アンケート)につき1つ」で、画面側は表示だけを集約する。
// ユーザー詳細には、本人への記録に加えて「作成者が本人」または「本人がメンバーの
// グループで作成」のアンケートの記録を出典付きで時系列に混ぜて表示する(2026-08-18 確定)。
// 集約はユーザー詳細側のみ(アンケート詳細はそのアンケートへの記録だけを表示する)。
// グループの判定は表示時点のメンバーで行う。
(function () {
    'use strict';

    // ユーザーへの記録(キー: ユーザーID)
    var USER_MEMOS = {
        'U-1052': [
            { date: '2026/07/28', by: '佐藤 由紀', text: '請求書の宛名を「経理部御中」へ変更してほしいと電話。次回発行分から反映すると回答。' },
            { date: '2026/07/20', by: '山本 彩', text: '日中は電話がつながりにくいため、連絡はメールを希望との申し出。以後メールで対応。' },
            { date: '2026/07/12', by: '佐藤 由紀', text: '名刺データ化の納期について問い合わせ。超特急は会期終了日の翌営業日から1営業日と案内。' },
            { date: '2026/06/30', by: '佐藤 由紀', text: 'プレミアム契約の更新について確認の連絡。継続の意向あり。' }
        ],
        'U-1038': [
            { date: '2026/07/02', by: '山本 彩', text: 'アカウント停止。会期直前の解約申し出により、契約書§7に沿って当月分は請求する旨を説明し合意。' },
            { date: '2026/06/28', by: '山本 彩', text: '解約の相談。理由は社内方針の変更とのこと。違約金の有無を確認したいと依頼あり。' }
        ]
    };

    // アンケートへの記録(キー: アンケートID)
    var SURVEY_MEMOS = {
        'SV-10262': [
            { date: '2026/07/30', by: '佐藤 由紀', text: '主催者から会期を1日前倒ししたいと電話。管理者へ引き継いで会期日時を変更してもらい、作成者へ確認依頼メールを送付。' }
        ],
        'SV-10244': [
            { date: '2026/07/27', by: '山本 彩', text: '納品予定の前倒し可否について問い合わせ。超特急のため予定どおりと案内。' },
            { date: '2026/07/24', by: '佐藤 由紀', text: '会期終了の連絡とあわせて、名刺データ化の進め方について説明。' }
        ]
    };

    // アンケートの帰属。作成者・グループは survey-management.html / billing-management.html の
    // 表示と同値に保つ(同数原則)
    var SURVEY_OWNERS = {
        'SV-10262': { title: '人事・労務フォーラム 来場者アンケート', creator: 'U-1049', group: '' },
        'SV-10244': { title: 'マーケティングサミット2026 来場者アンケート', creator: 'U-1052', group: 'イベント企画部' }
    };

    // グループのメンバー(キー: グループ名)。user-detail.html の所属グループカードと同値に保つ
    var GROUP_MEMBERS = {
        'イベント企画部': ['U-1052', 'U-1049']
    };

    // 対象ユーザーのユーザー詳細に表示する記録。アンケート由来の行は sid/title を持つ
    function forUser(uid) {
        var out = (USER_MEMOS[uid] || []).map(function (r) {
            return { date: r.date, by: r.by, text: r.text, sid: '', title: '' };
        });
        Object.keys(SURVEY_OWNERS).forEach(function (sid) {
            var o = SURVEY_OWNERS[sid];
            var mine = o.creator === uid
                || (o.group && (GROUP_MEMBERS[o.group] || []).indexOf(uid) >= 0);
            if (!mine) { return; }
            (SURVEY_MEMOS[sid] || []).forEach(function (r) {
                out.push({ date: r.date, by: r.by, text: r.text, sid: sid, title: o.title });
            });
        });
        // 新しい順。同日はユーザーへの記録を先に出す(sortは安定)
        out.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
        return out;
    }

    function forSurvey(sid) {
        return (SURVEY_MEMOS[sid] || []).slice();
    }

    window.SupportMemos = {
        forUser: forUser,
        forSurvey: forSurvey,
        addUser: function (uid, rec) {
            (USER_MEMOS[uid] = USER_MEMOS[uid] || []).unshift(rec);
        },
        addSurvey: function (sid, rec) {
            (SURVEY_MEMOS[sid] = SURVEY_MEMOS[sid] || []).unshift(rec);
        }
    };
})();
