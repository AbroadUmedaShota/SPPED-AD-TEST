// steps.js
// チュートリアル全 26 ステップ定義（仕様書 §4 参照）
//
// 各ステップフィールド:
//   id        : ステップ番号（1..26）
//   block     : 'A' | 'B' | 'C' | 'D'
//   target    : 対象要素 CSS セレクタ（null の場合は画面中央 or 動的解決）
//   mode      : 'info' | 'autofill' | 'user-action' | 'user-action-bridge'
//                - info               = 説明のみ（「次へ」表示）
//                - autofill           = 自動入力（システムが値を入れ、「次へ」表示）
//                - user-action        = ユーザー操作（対象クリックで進行、「次へ」非表示）
//                - user-action-bridge = ユーザー操作＋システム後続処理
//   placement : 'top' | 'bottom' | 'left' | 'right' | 'center'
//   title     : 吹き出しタイトル
//   body      : 吹き出し本文（文字列リテラル。innerHTML 注入禁止）
//   autoInput : 自動入力用ペイロード（mode='autofill' のときのみ）
//   targetResolver : 'lastInsertedQuestionField' 等、動的にターゲットを解決する場合
//   fieldPath / optionIndex : targetResolver='lastInsertedQuestionField' 時の解決パラメタ
//
// id=8, id=23, id=26 は user-action-bridge（本番ハンドラに代えてチュートリアルが続行処理を担う）。
// 旧 step 13（シングルアンサー一括）と旧 step 16（評定尺度一括）はフィールド単位に分解済み。

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
  // ------------------------------------------------------------
  // ブロック A: アンケート一覧
  // ------------------------------------------------------------
  {
    id: 1,
    block: 'A',
    target: null,
    mode: 'info',
    placement: 'center',
    title: 'ダッシュボード',
    body: 'ここがアンケートを管理する画面です。これからアンケート作成の流れを順番にご案内します。',
  },
  {
    id: 2,
    block: 'A',
    target: '#surveyTable',
    mode: 'info',
    placement: 'top',
    title: 'アンケート一覧',
    body: 'ここがアンケート一覧です。作成済みアンケートが一覧表示されます。',
  },
  {
    id: 3,
    block: 'A',
    target: '#openNewSurveyModalBtn',
    mode: 'user-action',
    placement: 'bottom',
    title: '新規作成ボタン',
    body: '右上の「アンケート新規作成」ボタンを押してください。',
  },

  // ------------------------------------------------------------
  // ブロック B: 新規作成モーダル（同ページ内）
  // ------------------------------------------------------------
  {
    id: 4,
    block: 'B',
    target: '#newSurveyModal .modal-content-transition',
    mode: 'info',
    placement: 'right',
    title: '新規作成モーダル',
    body: 'ここでアンケートの基本情報を入力します。',
    waitForElement: true,
  },
  {
    id: 5,
    block: 'B',
    target: '#newSurveyModal #surveyName',
    mode: 'autofill',
    placement: 'right',
    title: 'アンケート名（管理用）',
    body: 'ここがアンケート名（管理用）です。社内管理用の名前で、回答者には表示されません。練習のため「初めてのアンケート」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '初めてのアンケート' },
  },
  {
    id: 6,
    block: 'B',
    target: '#newSurveyModal #displayTitle',
    mode: 'autofill',
    placement: 'right',
    title: '表示タイトル（回答者表示）',
    body: 'ここが表示タイトルです。回答者の画面に表示される名称です。練習のため「製品Aに関する満足度調査」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '製品Aに関する満足度調査' },
  },
  {
    id: 7,
    block: 'B',
    target: '#newSurveyPeriodRange',
    mode: 'autofill',
    placement: 'right',
    title: '回答期間',
    body: 'ここが回答期間です。回答を受け付ける開始日と終了日を指定します。練習のため翌日から 3 日間を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'flatpickr-range', getRange: buildPeriodRange },
  },
  {
    id: 8,
    block: 'B',
    target: '#createSurveyFromModalBtn',
    mode: 'user-action-bridge',
    placement: 'top',
    title: '作成する（練習・保存されません）',
    body: '内容を確認したら「作成する」ボタンを押してください。これは練習のため、実際のアンケート一覧には追加されません。続けて作成画面の使い方を見てみましょう。',
  },

  // ------------------------------------------------------------
  // ブロック C: アンケート作成画面（surveyCreation.html?tutorial=1&step=9）
  // ------------------------------------------------------------
  {
    id: 9,
    block: 'C',
    target: '#basicInfoBody',
    mode: 'info',
    placement: 'right',
    title: '基本情報の反映確認',
    body: '前の画面で入力した情報がここに反映されています。',
  },
  {
    id: 10,
    block: 'C',
    target: '#settings-column',
    mode: 'info',
    placement: 'left',
    title: '設定カードの紹介',
    body: '名刺データ化・お礼メール・サンクス画面はここから個別に設定できます。今回はそのまま進みます。',
  },
  {
    id: 11,
    block: 'C',
    target: '#addFirstQuestionBtn',
    mode: 'user-action',
    placement: 'top',
    title: '最初の設問を追加',
    body: '「最初の設問を追加」ボタンを押してください。',
  },
  {
    id: 12,
    block: 'C',
    target: '#inlineQuestionTypeMenu button[data-question-type="single_answer"]',
    waitForElement: true,
    mode: 'user-action',
    placement: 'right',
    title: 'シングルアンサーを選択',
    body: '「シングルアンサー」を押してください。1 つだけ選べる選択肢の設問です。',
  },

  // ↓ 旧 step 13（シングルアンサー一括）を 5 サブに展開 ↓
  {
    id: 13,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'questionText',
    mode: 'autofill',
    placement: 'right',
    title: 'シングルアンサーの設問文',
    body: 'ここが設問文です。回答者に何を聞くかを書く欄です。練習のため「製品Aの満足度はいかがですか？」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '製品Aの満足度はいかがですか？' },
  },
  {
    id: 14,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'option',
    optionIndex: 0,
    mode: 'autofill',
    placement: 'right',
    title: '選択肢1',
    body: 'ここが選択肢1です。回答者が選べる選択肢の1つ目です。練習のため「とても満足」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: 'とても満足' },
  },
  {
    id: 15,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'option',
    optionIndex: 1,
    mode: 'autofill',
    placement: 'right',
    title: '選択肢2',
    body: 'ここが選択肢2です。回答者が選べる選択肢の2つ目です。練習のため「満足」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '満足' },
  },
  {
    id: 16,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'option',
    optionIndex: 2,
    mode: 'autofill',
    placement: 'right',
    title: '選択肢3',
    body: 'ここが選択肢3です。回答者が選べる選択肢の3つ目です。練習のため「やや不満」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: 'やや不満' },
  },
  {
    id: 17,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'option',
    optionIndex: 3,
    mode: 'autofill',
    placement: 'right',
    title: '選択肢4',
    body: 'ここが選択肢4です。回答者が選べる選択肢の4つ目です。練習のため「不満」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '不満' },
  },

  {
    id: 18,
    block: 'C',
    target: '#addQuestionInlineBtn',
    waitForElement: true,
    mode: 'user-action',
    placement: 'top',
    title: '2 問目を追加',
    body: '設問の下にある「設問を追加」ボタンを押してください。',
  },
  {
    id: 19,
    block: 'C',
    target: '#inlineQuestionTypeMenuBottom button[data-question-type="rating_scale"]',
    waitForElement: true,
    mode: 'user-action',
    placement: 'right',
    title: '評定尺度を選択',
    body: '「評定尺度」を押してください。満足度などを段階で評価してもらう設問です。',
  },

  // ↓ 旧 step 16（評定尺度一括）を 3 サブに展開 ↓
  {
    id: 20,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'questionText',
    mode: 'autofill',
    placement: 'right',
    title: '評定尺度の設問文',
    body: 'ここが設問文です。回答者に何を聞くかを書く欄です。練習のため「今回のサービス全体の満足度をお聞かせください。」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: '今回のサービス全体の満足度をお聞かせください。' },
  },
  {
    id: 21,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'minLabel',
    mode: 'autofill',
    placement: 'right',
    title: '最小値ラベル（左端）',
    body: 'ここが最小値ラベルです。評定尺度の左端（最低評価）に表示される文言です。練習のため「とても不満」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: 'とても不満' },
  },
  {
    id: 22,
    block: 'C',
    target: null,
    targetResolver: 'lastInsertedQuestionField',
    fieldPath: 'maxLabel',
    mode: 'autofill',
    placement: 'right',
    title: '最大値ラベル（右端）',
    body: 'ここが最大値ラベルです。評定尺度の右端（最高評価）に表示される文言です。練習のため「とても満足」を自動入力しました。確認できたら「次へ」を押してください。',
    autoInput: { kind: 'text', value: 'とても満足' },
  },

  {
    id: 23,
    block: 'C',
    target: '#createSurveyBtn',
    mode: 'user-action-bridge',
    placement: 'left',
    title: 'アンケートを作成（練習・保存されません）',
    body: '右側の「アンケートを作成」ボタンを押してください。これは練習のため、実際には保存されず、アンケート一覧にも追加されません。続けて QR コードの確認方法を見てみましょう。',
  },

  // ------------------------------------------------------------
  // ブロック D: QR コード確認 〜 完了
  // ------------------------------------------------------------
  {
    id: 24,
    block: 'D',
    target: '#openQrModalBtn',
    mode: 'user-action',
    placement: 'left',
    title: 'QR コードを表示',
    body: '「QR コード」ボタンを押して QR コードを表示してみましょう。',
  },
  {
    id: 25,
    block: 'D',
    target: '#qrCodeModal .modal-content-transition',
    mode: 'info',
    placement: 'left',
    title: 'QR コードの使い方',
    body: 'この QR コードを展示会で配布したり画面に表示することで、来場者がアンケートに回答できます。',
    waitForElement: true,
  },
  {
    id: 26,
    block: 'D',
    target: null,
    mode: 'user-action-bridge',
    placement: 'center',
    title: 'チュートリアル完了',
    body: 'お疲れさまでした。「完了」を押してダッシュボードへ戻ります。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}
