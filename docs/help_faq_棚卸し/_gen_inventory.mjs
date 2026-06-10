import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/user/Desktop/workspace20/SPPED-AD-TEST';
const SUP = path.join(ROOT, '05_support');
const OUT = path.join(ROOT, 'docs', 'help_faq_棚卸し');
fs.mkdirSync(OUT, { recursive: true });

const faq = JSON.parse(fs.readFileSync(path.join(SUP, 'assets/data/faq.json'), 'utf8'));
const help = JSON.parse(fs.readFileSync(path.join(SUP, 'assets/data/help_articles.json'), 'utf8'));

// raw texts for factual occurrence counting (terminology drift)
const rawFaq = fs.readFileSync(path.join(SUP, 'assets/data/faq.json'), 'utf8');
const rawHelp = fs.readFileSync(path.join(SUP, 'assets/data/help_articles.json'), 'utf8');
const rawPlans = fs.readFileSync(path.join(SUP, 'plans/index.html'), 'utf8');

// ---- CSV helpers (UTF-8 BOM, RFC4180 quoting) ----
const esc = v => {
  v = (v == null ? '' : String(v));
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const toCsv = rows => '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
const writeCsv = (file, rows) => {
  fs.writeFileSync(path.join(OUT, file), toCsv(rows), 'utf8');
  console.log('wrote', file, rows.length - 1, 'rows');
};
const collapse = s => (s || '').replace(/\s+/g, ' ').trim();
const countAll = (text, needle) => text.split(needle).length - 1;

// =========================================================
// Tab A: コンテンツ台帳
// =========================================================
const ledger = [[
  '台帳ID', '種別', 'カテゴリID', 'カテゴリ名', '項目ID', '質問・タイトル',
  '要約', '回答本文(改行は空白化)', '注目', '更新日', '参照リンク',
  '最終確認日', '確認ステータス', '担当'
]];

faq.categories.forEach(c => {
  c.questions.forEach(q => {
    ledger.push([
      'FAQ-' + q.id, 'FAQ', c.id, c.name, q.id, q.question,
      '', collapse(q.answer), q.isFeatured ? '★' : '', '',
      '/05_support/faq/#' + q.id, '', '', ''
    ]);
  });
});
help.categories.forEach(c => {
  c.questions.forEach(q => {
    ledger.push([
      'HELP-' + q.id, 'ヘルプ記事', c.id, c.name, q.id, q.question,
      collapse(q.summary), collapse(q.answer), q.isFeatured ? '★' : '', q.updatedAt || '',
      '/05_support/help-content/?article=' + q.id, '', '', ''
    ]);
  });
});
writeCsv('01_コンテンツ台帳.csv', ledger);

// =========================================================
// Tab B: 事実チェック（嘘棚卸し）— 主張は原文ママ抜粋。判定列は空欄。
//   照合先候補 = 確認先のルーティング（判定ではない）
//   備考 = 事実のみ（自己申告の※、他項目との差異など）
// =========================================================
const fc = [[
  'チェックID', '出典台帳ID', '主張内容(原文ママ抜粋)', '主張種別',
  '照合先候補', '備考(事実のみ)', '仕様上の値', '一致(○/△/×/要確認)', '判定メモ', '判定者'
]];
const claims = [
  ['FAQ-gen001', '「アンケート作成、名刺のデータ化、お礼メールの送信といった一連のリード管理プロセスを効率化するWebアプリケーション」', 'サービス定義', 'プロダクト概要/トップページ', '', '', '', ''],
  ['FAQ-gen002', '「レスポンシブデザインに対応」スマホ・タブレット利用可', '対応環境', '実画面/PC前提方針', '', '', '対応の前提は要確認（PC表示が大前提との運用方針あり）', ''],
  ['FAQ-acc006', '月額（月単位）契約は次回更新日の前日までの手続きで当月末解約・追加費用なし。年間/キャンペーン契約は解約金が発生する場合', '契約・解約', '利用規約/料金仕様書', '', '', 'HELP-bil005と整合確認（helpは「次回更新日の前日までで更新停止」）', ''],
  ['FAQ-acc007', '名刺データ等は国内データセンター保管・通信/保管時に暗号化・第三者提供は法令等を除き行わない・海外移転時は同意取得', '法務・データ保護', 'プライバシーポリシー', '', '', '公開ポリシー文と一字一句の整合要確認', ''],
  ['FAQ-plan001 / HELP-plan001', '無料プラン：アンケート最大20問・名刺データ化2項目まで', '数量上限・プラン', '料金プラン仕様書/plansページ', '', '', 'plansページの速度別単価は「お試し=2項目/通常以上=10項目」。「無料プラン」という名称はplansページに無い（スタンダード=月額なし）', ''],
  ['FAQ-plan002 / HELP-plan002', '自社ドメイン送信はプレミアムプラン機能・SPF/DKIMのドメイン認証が必要', '機能・対応プラン', '料金プラン仕様書', '', '', '', ''],
  ['FAQ-plan003 / HELP-plan003', '特急＝スタンダード以上、超特急・オンデマンド＝プレミアム', '対応プラン', 'plansページ/料金仕様書', '', '', 'plansページではオンデマンド=「プレミアム限定」。特急/超特急の対応プラン条件を要確認', ''],
  ['FAQ-bil004', 'クレカ(Visa/Mastercard/JCB/American Express)標準。請求書払い(銀行振込・月末締め翌月末払い)はスタンダード以上の年間契約で対応', '支払い', '料金仕様書/運用担当', '', '', '本文に「※仮文言。対応プランの条件・支払いサイトは運用担当に要確認」と自己申告あり。HELP-bil001はJCBを記載していない', ''],
  ['FAQ-bil005', 'インボイス制度対応。請求書に適格請求書発行事業者登録番号(T＋13桁)と税率別内訳を記載', '法務・請求', '特定商取引法に基づく表示/請求書', '', '', '本文に「※登録番号および表示内容は本番公開時に確定・記載予定」と自己申告あり', ''],
  ['FAQ-func002 / HELP-use004', '回答データをCSV形式(UTF-8)でエクスポート可', 'エクスポート仕様', '実画面/仕様書', '', '', 'FAQ-func008は「UTF-8 BOM付き・Excel2016以降Windowsで直接読込可」、HELP-use004は「UTF-8。Excelで文字化けする場合はインポート」。同じCSVの説明が不一致', ''],
  ['FAQ-func003 / HELP-use002', '条件分岐機能はプレミアムプラン以上で提供', '機能・対応プラン', '料金プラン仕様書', '', '', '', ''],
  ['FAQ-func005', '回答内容は定期的に自動で下書き保存され、再開できる', '機能', '実画面/仕様書', '', '', '', ''],
  ['FAQ-func008', '回答CSVはUTF-8 BOM付き(Excel2016以降Windows版で直接読込可)。名刺データはCSVに加えプレミアムでvCard(.vcf)対応', 'エクスポート仕様', '実画面/仕様書', '', '', 'vCard対応の有無・対応プランを要確認', ''],
  ['HELP-gs004', '推奨ブラウザは最新版のChrome/Firefox/Safari/Edge', '対応環境', '動作環境仕様', '', '', 'HELP-ts001は「Chrome/Firefox推奨」、HELP-ts003は「Chrome/Firefox」。推奨ブラウザの記載範囲が項目で揺れる', ''],
  ['HELP-acc003', '二段階認証を認証アプリ(Google Authenticator/Authy等)またはSMSで設定可', '機能・認証', '実画面/仕様書', '', '', '二段階認証の実装有無を要確認', ''],
  ['HELP-acc004', 'パスワードは8文字以上・英数記号の混在を推奨', '認証ポリシー', 'パスワードポリシー仕様(AD-09等)', '', '', '実際のバリデーション値と整合確認', ''],
  ['HELP-acc005', 'グループ管理機能でメンバー招待・アンケート共有・回答データ共同確認が可能', '機能', 'グループ/招待仕様(AD-09等)', '', '', 'plansページは「グループ機能」「グループアカウント」表記。名称の整合要確認', ''],
  ['HELP-ts004', '受信許可リストに @speed-ad.com を追加。30分以上届かなければ問い合わせ', 'ドメイン・連絡先', '送信ドメイン設定', '', '', '送信元ドメイン @speed-ad.com が実在/正かを要確認（運営会社ドメインと別）', ''],
  ['HELP-ts005', 'ダウンロードが10分以上開始しなければサポートへ', '手順・目安', '運用基準', '', '', '', ''],
  ['HELP-plan004', 'アップグレードはいつでも可・即時適用・差額分のみ請求', '契約・課金', '料金/課金仕様', '', '', '', ''],
  ['HELP-plan005', '日割り計算は行わない。月途中契約でも1ヶ月分の料金が発生', '料金', '料金仕様書/利用規約', '', '', '', ''],
  ['HELP-bil001', '支払いはクレジットカード(VISA/Mastercard/American Express)と銀行振込', '支払い', '料金仕様書', '', '', 'FAQ-bil004はJCBを含む4ブランド。カードブランドの記載が不一致', ''],
  ['HELP-bil005', '途中解約でも残期間分の返金なし。次回更新日の前日までの手続きで更新停止', '契約・解約', '利用規約', '', '', 'FAQ-acc006と整合確認', ''],
  ['HELP-misc004', 'API はエンタープライズプランのお客様向けに提供', 'プラン・機能', '料金プラン仕様書', '', '', 'plansページはスタンダード/プレミアムの2プランのみ。「エンタープライズプラン」はplansページに存在しない', ''],
  ['HELP-misc005', '運営会社は株式会社 Abroad Outsourcing', '会社情報', 'フッター/特定商取引法に基づく表示', '', '', '正式社名・表記の整合要確認', ''],
  ['FAQ-plan001 / plansページ', 'お礼メール：100通まで無料・101通目以降1円/通（plansページ記載）', '料金', 'plansページ/料金仕様書', '', '', 'help/faqのお礼メール記事には100通無料/1円の料金条件の記載が無い（情報の非対称）', ''],
];
// 安定ID（CSV / 記入表HTML / decisionsバックエンドGAS で共通。並び替えに強い）
const STABLE = [
  'gen001-svc', 'gen002-responsive', 'acc006-cancel', 'acc007-privacy', 'plan001-free-limits',
  'plan002-domain', 'plan003-speed', 'bil004-payment', 'bil005-invoice', 'func002-csv',
  'func003-branch', 'func005-autosave', 'func008-export', 'gs004-browser', 'acc003-2fa',
  'acc004-password', 'acc005-group', 'ts004-domain', 'ts005-dltimeout', 'plan004-upgrade',
  'plan005-noprorate', 'bil001-payment-help', 'bil005h-refund', 'misc004-enterprise',
  'misc005-company', 'mail-pricing'
];
claims.forEach((c, i) => {
  // c = [出典, 主張, 種別, 照合先, '', '', 備考, '']
  fc.push([STABLE[i], c[0], c[1], c[2], c[3], c[6], '', '', '', '']);
});
writeCsv('02_事実チェック.csv', fc);

// レビュー記入表（standalone HTML・2タブ）をテンプレートから生成。
//   タブ1「回答内容レビュー」＝help記事1本/FAQ1問のカード（計63）
//   タブ2「項目をまたいだ矛盾」＝横断比較の主張テーブル（計26）
const htmlEsc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- タブ1: カード ---
const card = (id, type, cat, q, ans, link) =>
  '<div class="card" data-row-id="' + htmlEsc(id) + '" data-type="' + htmlEsc(type) + '">' +
    '<div class="card-head">' +
      '<span class="badge">' + htmlEsc(id) + '</span>' +
      '<span class="chip">' + htmlEsc(type) + '</span>' +
      '<span class="chip">' + htmlEsc(cat) + '</span>' +
      '<a class="open" href="' + htmlEsc(link) + '" target="_blank" rel="noopener">実画面を開く ↗</a>' +
      '<label class="done-toggle"><input type="checkbox" class="done-box"> 確認OK</label>' +
    '</div>' +
    '<div class="q">' + htmlEsc(q) + '</div>' +
    '<div class="content">' + htmlEsc(ans) + '</div>' +
    '<div class="edit">' +
      '<div class="col"><div class="lbl">修正後の内容（直す場合のみ）</div>' +
        '<button type="button" class="copy-btn">原文コピー</button>' +
        '<textarea class="fix-input" placeholder="正しければ空欄でOK"></textarea></div>' +
      '<div class="col"><div class="lbl">レビューコメント</div>' +
        '<textarea class="comment-input" placeholder="誤り・要確認・気づき"></textarea></div>' +
    '</div>' +
  '</div>';
const cards = [];
faq.categories.forEach(c => c.questions.forEach(q => {
  cards.push(card('FAQ-' + q.id, 'FAQ', c.name, q.question, collapse(q.answer), '/05_support/faq/#' + q.id));
}));
help.categories.forEach(c => c.questions.forEach(q => {
  cards.push(card('HELP-' + q.id, 'ヘルプ', c.name, q.question, collapse(q.answer), '/05_support/help-content/?article=' + q.id));
}));

// --- タブ2: 矛盾テーブル行 ---
const clashRows = claims.map((c, i) =>
  '<tr data-row-id="' + htmlEsc(STABLE[i]) + '">' +
    '<td class="id">' + htmlEsc(STABLE[i]) + '</td>' +
    '<td class="src">' + htmlEsc(c[0]) + '</td>' +
    '<td class="claim">' + htmlEsc(c[1]) + '</td>' +
    '<td class="kind">' + htmlEsc(c[2]) + '</td>' +
    '<td class="note">' + htmlEsc(c[6]) + '</td>' +
    '<td class="tcomment"><textarea class="t-comment-input" placeholder="気づき・対応"></textarea></td>' +
    '<td class="tdone"><input type="checkbox" class="done-box"></td>' +
  '</tr>');

const tpl = fs.readFileSync(path.join(OUT, '_form_template.html'), 'utf8');
const formHtml = tpl
  .replace('<!--CARDS-->', cards.join('\n'))
  .replace('<!--CLASHROWS-->', clashRows.join('\n'));
fs.writeFileSync(path.join(OUT, 'レビュー記入表.html'), formHtml, 'utf8');
console.log('wrote レビュー記入表.html', cards.length, 'cards +', clashRows.length, 'clash rows');

// =========================================================
// Tab C: 用語揺れ — バリエーションは原文ママ。出現数は実測。推奨表記は空欄。
// =========================================================
const tg = [[
  'グループ', '概念(意味)', '出現バリエーション(原文ママ)',
  'FAQ出現(目安)', 'HELP出現(目安)', 'plansページ出現(目安)', '出現箇所メモ',
  '備考(事実のみ)', '推奨表記(記入用・空欄)', '判定メモ'
]];
const groups = [
  ['G1', '回答者へ送る自動フォローメール', ['お礼メール', '御礼メール', 'サンクスメール'],
    'plansページのみ「御礼メール送信費用」。help/faqは「お礼メール」、helpの動画記事は「サンクスメール」'],
  ['G2', '回答完了後に表示する画面', ['サンクス画面', 'お礼画面', '回答完了画面'],
    'func004/use003は「お礼画面（サンクス画面）」「サンクス画面（回答完了画面）」と併記。G1のメールとは別概念'],
  ['G3', '下位プラン（無償/基本）', ['無料プラン', 'スタンダード', 'スタンダードプラン'],
    'help/faqは「無料プラン」。plansページは「スタンダード（月額なし）」。無料プラン＝スタンダードかは要確認'],
  ['G4-特急', '速度プラン：特急', ['特急', '特急作業プラン'], 'plansページは「特急」、help/faqは「特急作業プラン」'],
  ['G4-超特急', '速度プラン：超特急', ['超特急', '超特急作業プラン'], 'plansページは「超特急」、help/faqは「超特急作業プラン」'],
  ['G4-オンデ', '速度プラン：オンデマンド', ['オンデマンド', 'オンデマンドプラン'], 'plansページは「オンデマンド」、help/faqは「オンデマンドプラン」'],
  ['G5', '複数ユーザーの共同運用', ['グループ管理', 'グループ機能', 'グループアカウント'],
    'helpは「グループ管理」、plansページは「グループ機能」「グループアカウント」'],
  ['G6', '上位プラン', ['プレミアム', 'プレミアムプラン'], '「プレミアム」「プレミアムプラン」が混在'],
  ['G7', '最上位/法人向けプラン', ['エンタープライズプラン'],
    'misc004にのみ登場。plansページの2プラン構成（スタンダード/プレミアム）に存在しない'],
  ['G8', '対応カードブランド', ['Visa', 'VISA', 'Mastercard', 'JCB', 'American Express', 'Amex'],
    'FAQ-bil004はJCBを含む4ブランド、HELP-bil001はJCBなし3ブランド。VISA/Visaの表記揺れも'],
  ['G9', 'アンケート作成の起点導線', ['アンケート新規作成', 'アンケート一覧', '新しいアンケート'],
    'ボタン名/導線の呼称が記事間で揺れる'],
  ['G10', '問い合わせ導線', ['お問い合わせ', 'サポート', 'bug-report'],
    'ラベルは「お問い合わせ」だがリンク先は ../bug-report/'],
  ['G11', '名刺のテキスト化', ['名刺データ化', '名刺のデータ化'], '助詞「の」有無の揺れ'],
  ['G12', '回答CSVの文字コード説明', ['UTF-8 BOM付き', 'UTF-8'],
    'func008は「UTF-8 BOM付き・直接読込可」、use004は「UTF-8・文字化けする場合あり」。同一CSVの説明差'],
];
groups.forEach(g => {
  const [gid, concept, variants, note] = g;
  const joined = variants.join(' / ');
  const fCnt = variants.reduce((n, v) => n + countAll(rawFaq, v), 0);
  const hCnt = variants.reduce((n, v) => n + countAll(rawHelp, v), 0);
  const pCnt = variants.reduce((n, v) => n + countAll(rawPlans, v), 0);
  tg.push([gid, concept, joined, fCnt, hCnt, pCnt, '', note, '', '']);
});
writeCsv('03_用語揺れ.csv', tg);

console.log('OUT =', OUT);
