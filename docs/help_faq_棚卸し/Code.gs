/**
 * help/FAQ 棚卸しDB 自動同期（Google Apps Script）
 * --------------------------------------------------------------
 * 正本JSON（GitHub Pages 配信）を直接フェッチし、スプレッドシートの
 * 「台帳 / 事実チェック / 用語揺れ」タブへ自動で書き込む。
 *
 * 設計の肝：自動で書き込む列と、人が記入する判断列を分離する。
 *   同期のたびに、判断列は ID をキーに前回値をマージして温存する
 *   （＝再同期しても手入力の判定・推奨表記・担当などは消えない）。
 *
 * セットアップ：
 *   1) 対象のGoogleスプレッドシートを開く →「拡張機能」→「Apps Script」
 *   2) このファイル全体を貼り付けて保存
 *   3) スプレッドシートを再読み込み →メニュー「棚卸しDB」→「今すぐ同期」
 *      （初回のみ権限承認のダイアログが出る）
 *   4) 定期実行：メニュー「棚卸しDB」→「自動同期を毎日ONにする」
 *
 * 嘘の真偽判定は人が行う前提。判定列（仕様上の値 / 一致 / 判定メモ / 判定者 /
 * 推奨表記 / 最終確認日 / 確認ステータス / 担当）は空欄で生成し、人の記入を温存する。
 */

// ============ 設定 ============
var BASE = 'https://abroadumedashota.github.io/SPPED-AD-TEST/05_support/';
var SRC = {
  faq: BASE + 'assets/data/faq.json',
  help: BASE + 'assets/data/help_articles.json',
  plans: BASE + 'plans/' // 用語の出現カウント用（HTML）
};

// タブ名・ID列・判断列（＝マージで温存する列）の定義
var SPEC = {
  ledger: {
    tab: '台帳',
    id: '台帳ID',
    header: ['台帳ID', '種別', 'カテゴリID', 'カテゴリ名', '項目ID', '質問・タイトル',
             '要約', '回答本文(改行は空白化)', '注目', '更新日', '参照リンク',
             '最終確認日', '確認ステータス', '担当'],
    human: ['最終確認日', '確認ステータス', '担当']
  },
  facts: {
    tab: '事実チェック',
    id: 'チェックID',
    header: ['チェックID', '出典台帳ID', '主張内容(原文ママ抜粋)', '主張種別',
             '照合先候補', '備考(事実のみ)', '仕様上の値', '一致(○/△/×/要確認)',
             '判定メモ', '判定者'],
    human: ['仕様上の値', '一致(○/△/×/要確認)', '判定メモ', '判定者']
  },
  terms: {
    tab: '用語揺れ',
    id: 'グループ',
    header: ['グループ', '概念(意味)', '出現バリエーション(原文ママ)',
             'FAQ出現(目安)', 'HELP出現(目安)', 'plansページ出現(目安)',
             '出現箇所メモ', '備考(事実のみ)', '推奨表記', '判定メモ'],
    human: ['推奨表記', '判定メモ']
  }
};

// ============ 事実チェックの主張（原文ママ抜粋・安定ID）============
// id は並び替えに強い安定キー。主張を増やすときはここに行を足す。
var CLAIMS = [
  ['gen001-svc', 'FAQ-gen001', '「アンケート作成、名刺のデータ化、お礼メールの送信といった一連のリード管理プロセスを効率化するWebアプリケーション」', 'サービス定義', 'プロダクト概要/トップページ', ''],
  ['gen002-responsive', 'FAQ-gen002', '「レスポンシブデザインに対応」スマホ・タブレット利用可', '対応環境', '実画面/PC前提方針', '対応の前提は要確認（PC表示が大前提との運用方針あり）'],
  ['acc006-cancel', 'FAQ-acc006', '月額（月単位）契約は次回更新日の前日までの手続きで当月末解約・追加費用なし。年間/キャンペーン契約は解約金が発生する場合', '契約・解約', '利用規約/料金仕様書', 'HELP-bil005と整合確認（helpは「次回更新日の前日までで更新停止」）'],
  ['acc007-privacy', 'FAQ-acc007', '名刺データ等は国内データセンター保管・通信/保管時に暗号化・第三者提供は法令等を除き行わない・海外移転時は同意取得', '法務・データ保護', 'プライバシーポリシー', '公開ポリシー文と一字一句の整合要確認'],
  ['plan001-free-limits', 'FAQ-plan001 / HELP-plan001', '無料プラン：アンケート最大20問・名刺データ化2項目まで', '数量上限・プラン', '料金プラン仕様書/plansページ', 'plansページの速度別単価は「お試し=2項目/通常以上=10項目」。「無料プラン」という名称はplansページに無い（スタンダード=月額なし）'],
  ['plan002-domain', 'FAQ-plan002 / HELP-plan002', '自社ドメイン送信はプレミアムプラン機能・SPF/DKIMのドメイン認証が必要', '機能・対応プラン', '料金プラン仕様書', ''],
  ['plan003-speed', 'FAQ-plan003 / HELP-plan003', '特急＝スタンダード以上、超特急・オンデマンド＝プレミアム', '対応プラン', 'plansページ/料金仕様書', 'plansページではオンデマンド=「プレミアム限定」。特急/超特急の対応プラン条件を要確認'],
  ['bil004-payment', 'FAQ-bil004', 'クレカ(Visa/Mastercard/JCB/American Express)標準。請求書払い(銀行振込・月末締め翌月末払い)はスタンダード以上の年間契約で対応', '支払い', '料金仕様書/運用担当', '本文に「※仮文言。対応プランの条件・支払いサイトは運用担当に要確認」と自己申告あり。HELP-bil001はJCBを記載していない'],
  ['bil005-invoice', 'FAQ-bil005', 'インボイス制度対応。請求書に適格請求書発行事業者登録番号(T＋13桁)と税率別内訳を記載', '法務・請求', '特定商取引法に基づく表示/請求書', '本文に「※登録番号および表示内容は本番公開時に確定・記載予定」と自己申告あり'],
  ['func002-csv', 'FAQ-func002 / HELP-use004', '回答データをCSV形式(UTF-8)でエクスポート可', 'エクスポート仕様', '実画面/仕様書', 'FAQ-func008は「UTF-8 BOM付き・Excel2016以降Windowsで直接読込可」、HELP-use004は「UTF-8。Excelで文字化けする場合はインポート」。同じCSVの説明が不一致'],
  ['func003-branch', 'FAQ-func003 / HELP-use002', '条件分岐機能はプレミアムプラン以上で提供', '機能・対応プラン', '料金プラン仕様書', ''],
  ['func005-autosave', 'FAQ-func005', '回答内容は定期的に自動で下書き保存され、再開できる', '機能', '実画面/仕様書', ''],
  ['func008-export', 'FAQ-func008', '回答CSVはUTF-8 BOM付き(Excel2016以降Windows版で直接読込可)。名刺データはCSVに加えプレミアムでvCard(.vcf)対応', 'エクスポート仕様', '実画面/仕様書', 'vCard対応の有無・対応プランを要確認'],
  ['gs004-browser', 'HELP-gs004', '推奨ブラウザは最新版のChrome/Firefox/Safari/Edge', '対応環境', '動作環境仕様', 'HELP-ts001は「Chrome/Firefox推奨」、HELP-ts003は「Chrome/Firefox」。推奨ブラウザの記載範囲が項目で揺れる'],
  ['acc003-2fa', 'HELP-acc003', '二段階認証を認証アプリ(Google Authenticator/Authy等)またはSMSで設定可', '機能・認証', '実画面/仕様書', '二段階認証の実装有無を要確認'],
  ['acc004-password', 'HELP-acc004', 'パスワードは8文字以上・英数記号の混在を推奨', '認証ポリシー', 'パスワードポリシー仕様(AD-09等)', '実際のバリデーション値と整合確認'],
  ['acc005-group', 'HELP-acc005', 'グループ管理機能でメンバー招待・アンケート共有・回答データ共同確認が可能', '機能', 'グループ/招待仕様(AD-09等)', 'plansページは「グループ機能」「グループアカウント」表記。名称の整合要確認'],
  ['ts004-domain', 'HELP-ts004', '受信許可リストに @speed-ad.com を追加。30分以上届かなければ問い合わせ', 'ドメイン・連絡先', '送信ドメイン設定', '送信元ドメイン @speed-ad.com が実在/正かを要確認（運営会社ドメインと別）'],
  ['ts005-dltimeout', 'HELP-ts005', 'ダウンロードが10分以上開始しなければサポートへ', '手順・目安', '運用基準', ''],
  ['plan004-upgrade', 'HELP-plan004', 'アップグレードはいつでも可・即時適用・差額分のみ請求', '契約・課金', '料金/課金仕様', ''],
  ['plan005-noprorate', 'HELP-plan005', '日割り計算は行わない。月途中契約でも1ヶ月分の料金が発生', '料金', '料金仕様書/利用規約', ''],
  ['bil001-payment-help', 'HELP-bil001', '支払いはクレジットカード(VISA/Mastercard/American Express)と銀行振込', '支払い', '料金仕様書', 'FAQ-bil004はJCBを含む4ブランド。カードブランドの記載が不一致'],
  ['bil005h-refund', 'HELP-bil005', '途中解約でも残期間分の返金なし。次回更新日の前日までの手続きで更新停止', '契約・解約', '利用規約', 'FAQ-acc006と整合確認'],
  ['misc004-enterprise', 'HELP-misc004', 'API はエンタープライズプランのお客様向けに提供', 'プラン・機能', '料金プラン仕様書', 'plansページはスタンダード/プレミアムの2プランのみ。「エンタープライズプラン」はplansページに存在しない'],
  ['misc005-company', 'HELP-misc005', '運営会社は株式会社 Abroad Outsourcing', '会社情報', 'フッター/特定商取引法に基づく表示', '正式社名・表記の整合要確認'],
  ['mail-pricing', 'FAQ-plan001 / plansページ', 'お礼メール：100通まで無料・101通目以降1円/通（plansページ記載）', '料金', 'plansページ/料金仕様書', 'help/faqのお礼メール記事には100通無料/1円の料金条件の記載が無い（情報の非対称）']
];

// ============ 用語揺れグループ（バリエーションは原文ママ）============
var GROUPS = [
  ['G1', '回答者へ送る自動フォローメール', ['お礼メール', '御礼メール', 'サンクスメール'], 'plansページのみ「御礼メール送信費用」。help/faqは「お礼メール」、helpの動画記事は「サンクスメール」'],
  ['G2', '回答完了後に表示する画面', ['サンクス画面', 'お礼画面', '回答完了画面'], 'func004/use003は「お礼画面（サンクス画面）」「サンクス画面（回答完了画面）」と併記。G1のメールとは別概念'],
  ['G3', '下位プラン（無償/基本）', ['無料プラン', 'スタンダード', 'スタンダードプラン'], 'help/faqは「無料プラン」。plansページは「スタンダード（月額なし）」。無料プラン＝スタンダードかは要確認'],
  ['G4-特急', '速度プラン：特急', ['特急', '特急作業プラン'], 'plansページは「特急」、help/faqは「特急作業プラン」'],
  ['G4-超特急', '速度プラン：超特急', ['超特急', '超特急作業プラン'], 'plansページは「超特急」、help/faqは「超特急作業プラン」'],
  ['G4-オンデ', '速度プラン：オンデマンド', ['オンデマンド', 'オンデマンドプラン'], 'plansページは「オンデマンド」、help/faqは「オンデマンドプラン」'],
  ['G5', '複数ユーザーの共同運用', ['グループ管理', 'グループ機能', 'グループアカウント'], 'helpは「グループ管理」、plansページは「グループ機能」「グループアカウント」'],
  ['G6', '上位プラン', ['プレミアム', 'プレミアムプラン'], '「プレミアム」「プレミアムプラン」が混在'],
  ['G7', '最上位/法人向けプラン', ['エンタープライズプラン'], 'misc004にのみ登場。plansページの2プラン構成（スタンダード/プレミアム）に存在しない'],
  ['G8', '対応カードブランド', ['Visa', 'VISA', 'Mastercard', 'JCB', 'American Express', 'Amex'], 'FAQ-bil004はJCBを含む4ブランド、HELP-bil001はJCBなし3ブランド。VISA/Visaの表記揺れも'],
  ['G9', 'アンケート作成の起点導線', ['アンケート新規作成', 'アンケート一覧', '新しいアンケート'], 'ボタン名/導線の呼称が記事間で揺れる'],
  ['G10', '問い合わせ導線', ['お問い合わせ', 'サポート', 'bug-report'], 'ラベルは「お問い合わせ」だがリンク先は ../bug-report/'],
  ['G11', '名刺のテキスト化', ['名刺データ化', '名刺のデータ化'], '助詞「の」有無の揺れ'],
  ['G12', '回答CSVの文字コード説明', ['UTF-8 BOM付き', 'UTF-8'], 'func008は「UTF-8 BOM付き・直接読込可」、use004は「UTF-8・文字化けする場合あり」。同一CSVの説明差']
];

// ============ メニュー ============
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('棚卸しDB')
    .addItem('今すぐ同期', 'syncAll')
    .addSeparator()
    .addItem('自動同期を毎日ONにする', 'enableDailyTrigger')
    .addItem('自動同期をOFFにする', 'disableTriggers')
    .addToUi();
}

// ============ メイン ============
function syncAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var faq = JSON.parse(fetchText_(SRC.faq));
    var help = JSON.parse(fetchText_(SRC.help));
    var rawFaq = fetchText_(SRC.faq);
    var rawHelp = fetchText_(SRC.help);
    var rawPlans = fetchText_(SRC.plans);

    syncTable_(ss, SPEC.ledger, buildLedger_(faq, help));
    syncTable_(ss, SPEC.facts, buildFacts_());
    syncTable_(ss, SPEC.terms, buildTerms_(rawFaq, rawHelp, rawPlans));

    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    ss.toast('同期完了（' + stamp + '）', '棚卸しDB', 5);
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast('同期エラー: ' + e.message, '棚卸しDB', 10);
    throw e;
  }
}

// ============ 行データ生成 ============
function buildLedger_(faq, help) {
  var rows = [];
  faq.categories.forEach(function (c) {
    c.questions.forEach(function (q) {
      rows.push(['FAQ-' + q.id, 'FAQ', c.id, c.name, q.id, q.question,
        '', collapse_(q.answer), q.isFeatured ? '★' : '', '',
        '/05_support/faq/#' + q.id, '', '', '']);
    });
  });
  help.categories.forEach(function (c) {
    c.questions.forEach(function (q) {
      rows.push(['HELP-' + q.id, 'ヘルプ記事', c.id, c.name, q.id, q.question,
        collapse_(q.summary), collapse_(q.answer), q.isFeatured ? '★' : '', q.updatedAt || '',
        '/05_support/help-content/?article=' + q.id, '', '', '']);
    });
  });
  return rows;
}

function buildFacts_() {
  // CLAIMS = [id, 出典, 主張, 種別, 照合先, 備考]
  return CLAIMS.map(function (c) {
    return [c[0], c[1], c[2], c[3], c[4], c[5], '', '', '', ''];
  });
}

function buildTerms_(rawFaq, rawHelp, rawPlans) {
  return GROUPS.map(function (g) {
    var gid = g[0], concept = g[1], variants = g[2], note = g[3];
    var joined = variants.join(' / ');
    var fCnt = sumCounts_(rawFaq, variants);
    var hCnt = sumCounts_(rawHelp, variants);
    var pCnt = sumCounts_(rawPlans, variants);
    return [gid, concept, joined, fCnt, hCnt, pCnt, '', note, '', ''];
  });
}

// ============ 書き込み（判断列をIDキーでマージ）============
function syncTable_(ss, spec, rows) {
  var sh = ss.getSheetByName(spec.tab) || ss.insertSheet(spec.tab);

  // 既存の判断列の値を ID キーで退避
  var saved = {};
  var old = sh.getDataRange().getValues();
  if (old.length > 1) {
    var oh = old[0];
    var oIdIdx = oh.indexOf(spec.id);
    if (oIdIdx >= 0) {
      for (var r = 1; r < old.length; r++) {
        var key = old[r][oIdIdx];
        if (key === '' || key == null) continue;
        var obj = {};
        spec.human.forEach(function (h) {
          var ci = oh.indexOf(h);
          if (ci >= 0) obj[h] = old[r][ci];
        });
        saved[key] = obj;
      }
    }
  }

  // 新しい行に、退避した判断列の値を書き戻す
  var idIdx = spec.header.indexOf(spec.id);
  var humanIdx = spec.human.map(function (h) { return { h: h, i: spec.header.indexOf(h) }; })
    .filter(function (x) { return x.i >= 0; });
  rows.forEach(function (row) {
    var s = saved[row[idIdx]];
    if (!s) return;
    humanIdx.forEach(function (x) {
      if (s[x.h] !== undefined && s[x.h] !== '') row[x.i] = s[x.h];
    });
  });

  // 全消し→ヘッダ＋全行を一括書き込み
  sh.clear();
  var all = [spec.header].concat(rows);
  sh.getRange(1, 1, all.length, spec.header.length).setValues(all);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, spec.header.length).setFontWeight('bold');
  sh.autoResizeColumns(1, Math.min(spec.header.length, 6));
}

// ============ ユーティリティ ============
function fetchText_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('取得失敗 ' + code + ': ' + url);
  return res.getContentText('UTF-8');
}

function collapse_(s) {
  return (s == null ? '' : String(s)).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function sumCounts_(text, variants) {
  return variants.reduce(function (n, v) { return n + (text.split(v).length - 1); }, 0);
}

// ============ 即時同期エンドポイント（任意・push連動用）============
// GAS を「ウェブアプリ」としてデプロイすると、外部（GitHub Actions 等）から
// POST で同期を起動できる。コンテンツを編集→デプロイ→数分でスプシ反映、が実現する。
// スクリプトプロパティ SYNC_TOKEN を設定し、同じ値を ?token= で渡すこと。
function doPost(e) {
  var want = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  var got = (e && e.parameter && e.parameter.token) || '';
  if (want && got !== want) {
    return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
  }
  syncAll();
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

// ============ トリガー管理 ============
function enableDailyTrigger() {
  disableTriggers();
  ScriptApp.newTrigger('syncAll').timeBased().everyDays(1).atHour(6).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('毎日6時台に自動同期します', '棚卸しDB', 5);
}

function disableTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });
}
