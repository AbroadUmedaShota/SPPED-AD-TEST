// steps.js
// チュートリアル全 26 ステップ定義（旧34stepから構造圧縮：選択肢一括autofill、関連設定統合、プレビュー操作圧縮）
//
// 各ステップフィールド:
//   id, block, target, contextTarget, mode, placement, title, body
//   autoInput          : 自動入力ペイロード（mode='autofill'）
//                        kind: 'text' | 'flatpickr-range' | 'multi-option' | 'rating-bundle'
//   targetResolver     : 'lastInsertedQuestionField' | 'lastInsertedQuestionFieldOptionsAll' | 'lastInsertedQuestionFieldRatingAll'
//   fieldPath/optionIndex : targetResolver パラメタ
//   onLeaveAction      : 'closePreviewModal' | 'closeQrModal'（次stepに遷移する直前に index.js が実行）
//   waitForElement     : 対象出現待ち
//   hideBack           : 戻るボタン非表示（ページ境界）
//   completeButtonLabel: 次へボタンを完了ラベルに差し替え
//
// id 8, 25, 26 は user-action-bridge（本番ハンドラ経由 or 完了）。
// 旧10は新10〜13に分割（名刺画像添付/名刺データ化/お礼メール/回答完了画面）、旧17-20（選択肢4個別）は新17に統合（multi-option一括）、旧23-25（評定尺度3個別）は新20に統合（rating-bundle一括）、旧28-29は新23に統合、旧30/32は廃止しonLeaveActionで自動close（新23/24）。

const TOMORROW_OFFSET_DAYS = 1;
const PERIOD_LENGTH_DAYS = 3;

function buildPeriodRange() {
  const start = new Date();
  start.setDate(start.getDate() + TOMORROW_OFFSET_DAYS);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + PERIOD_LENGTH_DAYS);
  end.setHours(23, 59, 0, 0);
  return [start, end];
}

export const TUTORIAL_STEPS = [
  // ブロック A: アンケート一覧
  {
    id: 1, block: 'A', target: null, mode: 'info', placement: 'center',
    title: 'アンケート作成の流れを学ぶ',
    body: 'ここは、展示会で集める来場者アンケートを管理する画面です。これからアンケート作成の流れを順番にご案内します。確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 2, block: 'A', target: '#surveyTable', mode: 'info', placement: 'top',
    title: 'アンケート一覧を確認',
    body: 'ここがアンケート一覧です。作成済みのアンケートが一覧表示されます。本ガイドでは「回答者」＝展示会の来場者など、アンケートに答える方を指します。確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 3, block: 'A', target: '#openNewSurveyModalBtn', mode: 'user-action', placement: 'bottom',
    title: '新規作成ボタンを押す',
    body: '画面右上の『アンケート新規作成』ボタンを押してください。',
  },

  // ブロック B: 新規作成モーダル
  {
    id: 4, block: 'B', target: '#newSurveyModal .modal-content-transition', mode: 'info', placement: 'right',
    waitForElement: true,
    title: '基本情報を入力する',
    body: 'ここでアンケートの基本情報を入力します。今回は練習のため、こちらで自動入力していきます。下の『次へ』ボタンを押してください。',
  },
  {
    id: 5, block: 'B', target: '#newSurveyModal #surveyName', mode: 'autofill', placement: 'right',
    title: 'アンケート名を入力',
    body: '社内管理用の名前で、回答者には表示されません。練習のため「初めてのアンケート」を自動入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '初めてのアンケート' },
  },
  {
    id: 6, block: 'B', target: '#newSurveyModal #displayTitle', mode: 'autofill', placement: 'right',
    title: '表示タイトルを入力',
    body: '回答者の画面に表示される名称です。練習のため「製品Aに関する満足度調査」を自動入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '製品Aに関する満足度調査' },
  },
  {
    id: 7, block: 'B', target: '#newSurveyPeriodRange', mode: 'autofill', placement: 'right',
    title: '回答期間を設定',
    body: '回答を受け付ける開始日と終了日を指定します。練習のため翌日から3日間を自動入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'flatpickr-range', getRange: buildPeriodRange },
  },
  {
    id: 8, block: 'B', target: '#createSurveyFromModalBtn', contextTarget: '#newSurveyModal .modal-content-transition',
    mode: 'user-action-bridge', placement: 'top',
    title: '作成する（練習・保存されません）',
    body: '内容を確認したら、『作成する』ボタンを押してください。画面が切り替わって、続けて作成画面の使い方を見てみましょう。',
  },

  // ブロック C: アンケート作成画面
  {
    id: 9, block: 'C', target: '#basicInfoBody', mode: 'info', placement: 'right', hideBack: true,
    title: '基本情報の反映を確認',
    body: '画面が切り替わりました。前の画面で入力した情報が、ここに反映されています。確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 10, block: 'C', target: '#optionsCardBody', mode: 'info', placement: 'left',
    title: '名刺画像添付機能',
    body: '回答時に名刺を撮影するステップを追加できる機能です。ONにすると、回答者は設問の途中で名刺画像を添付できます。回答とリードの紐付けを1ステップで実現できる、本サービスならではの機能です。今回はそのまま進みます。下の『次へ』ボタンを押してください。',
  },
  {
    id: 11, block: 'C', target: '#openBizcardSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: '名刺データ化設定',
    body: '収集した名刺画像をテキスト情報に変換（データ化）する際の精度や納期などを設定する画面へのリンクです。展示会後の名刺データ入力作業を丸ごと巻き取れます。今回は開かずに進みます。下の『次へ』ボタンを押してください。',
  },
  {
    id: 12, block: 'C', target: '#openThankYouEmailSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: 'お礼メール設定',
    body: '回答完了後に回答者へ自動送信されるお礼メールの内容や送信タイミングを設定できます。回答直後にフォローの第一接点を作れます。今回は開かずに進みます。下の『次へ』ボタンを押してください。',
  },
  {
    id: 13, block: 'C', target: '#openThankYouScreenSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: '回答完了画面（サンクス画面）設定',
    body: '回答完了画面（サンクス画面）の見た目やメッセージをカスタマイズできます。ブランドに合わせた画面で、回答後の印象まで整えられます。今回は開かずに進みます。下の『次へ』ボタンを押してください。',
  },
  {
    id: 14, block: 'C', target: '#addFirstQuestionBtn', mode: 'user-action', placement: 'top',
    title: '最初の設問を追加',
    body: '『最初の設問を追加』ボタンを押してください。',
  },
  {
    id: 15, block: 'C', target: '#inlineQuestionTypeMenu button[data-question-type="single_answer"]',
    waitForElement: true, mode: 'user-action', placement: 'right',
    title: '単一選択（シングルアンサー）を選択',
    body: '1つだけ選べる選択肢の設問です。『シングルアンサー』を押してください。',
  },
  {
    id: 16, block: 'C', target: null, targetResolver: 'lastInsertedQuestionField', fieldPath: 'questionText',
    mode: 'autofill', placement: 'right',
    title: '設問文を入力',
    body: '回答者に何を聞くかを書く欄です。練習のため「製品Aの満足度はいかがですか？」を自動入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '製品Aの満足度はいかがですか？' },
  },
  {
    id: 17, block: 'C', target: null, targetResolver: 'lastInsertedQuestionFieldOptionsAll',
    mode: 'autofill', placement: 'right',
    title: '選択肢を4つ入力',
    body: '回答者が選べる選択肢を4つ自動入力します。練習のため「とても満足」「満足」「やや不満」「不満」を順に入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'multi-option', values: ['とても満足', '満足', 'やや不満', '不満'] },
  },
  {
    id: 18, block: 'C', target: '#addQuestionInlineBtn', waitForElement: true,
    mode: 'user-action', placement: 'top',
    title: '2 問目を追加',
    body: '設問の下の『設問を追加』ボタンを押してください。',
  },
  {
    id: 19, block: 'C', target: '#inlineQuestionTypeMenuBottom button[data-question-type="rating_scale"]',
    waitForElement: true, mode: 'user-action', placement: 'right',
    title: '段階評価（評定尺度）を選択',
    body: '満足度などを段階で評価してもらう設問です。『評定尺度』を押してください。',
  },
  {
    id: 20, block: 'C', target: null, targetResolver: 'lastInsertedQuestionFieldRatingAll',
    mode: 'autofill', placement: 'right',
    title: '評定尺度の設問文・ラベルを入力',
    body: '評定尺度の設問文と最小・最大ラベルを自動入力します。練習のため「今回のサービス全体の満足度をお聞かせください。」「とても不満」「とても満足」を入力しました。下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'rating-bundle', text: '今回のサービス全体の満足度をお聞かせください。', minLabel: 'とても不満', maxLabel: 'とても満足' },
  },

  // ブロック D: プレビュー〜完了
  {
    id: 21, block: 'D', target: '#showPreviewBtn', mode: 'user-action', placement: 'left',
    title: 'プレビューを開く',
    body: '回答者にどのように表示されるかを確認できます。画面右側の『プレビュー』ボタンを押してください。',
  },
  {
    id: 22, block: 'D', target: '#surveyPreviewModalV2 .modal-content-transition', waitForElement: true,
    mode: 'info', placement: 'left',
    title: 'スマートフォン表示を確認',
    body: 'プレビューが開きました。最初は回答者のスマートフォン画面です。プレビュー内のアンケートに回答して「送信」を押すと、回答完了画面（サンクス画面）まで確認できます。確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 23, block: 'D', target: '#v2-preview-tablet-btn', waitForElement: true,
    mode: 'user-action', placement: 'bottom',
    onLeaveAction: 'closePreviewModal',
    title: 'タブレット表示で確認',
    body: '展示会では来場者がスマートフォンで読み取ったり、ブースのタブレットで回答したりします。『タブレット』ボタンを押して、タブレットでの見え方を確認してください。',
  },
  {
    id: 24, block: 'D', target: '#openQrModalBtn', mode: 'user-action', placement: 'left',
    onLeaveAction: 'closeQrModal',
    title: 'QR コードを表示',
    body: '回答用のQRコードを表示してみましょう。これは来場者にスマートフォンで読み取ってもらい、アンケートに回答してもらうためのQRコードです。『QR発行』ボタンを押してください。',
  },
  {
    id: 25, block: 'D', target: '#createSurveyBtn', mode: 'user-action-bridge', placement: 'left',
    title: 'アンケートを保存する',
    body: '画面右側の『アンケートを保存する』ボタンを押してください。保存してもこの画面のまま、ダッシュボードへ自動では移動しません。（練習のため実際には保存されません）',
  },
  {
    id: 26, block: 'D', target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    body: 'お疲れさまでした。これでアンケート作成の基本フローは完了です。アカウントを作成すると、今練習したものを実際に公開して回答を集められます。下の『完了』ボタンを押してください。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}
