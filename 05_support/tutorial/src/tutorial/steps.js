// steps.js
// チュートリアル全 31 ステップ定義（旧34stepから構造圧縮：選択肢一括autofill、関連設定統合、プレビュー操作圧縮）
//
// 各ステップフィールド:
//   id, block, target, contextTarget, mode, placement, title, body
//   autoInput          : 自動入力ペイロード（mode='autofill'）
//                        kind: 'text' | 'flatpickr-range' | 'multi-option'
//   targetResolver     : 'lastInsertedQuestionField' | 'lastInsertedQuestionFieldOptionsAll'
//   fieldPath/optionIndex : targetResolver パラメタ
//   onLeaveAction      : 'closePreviewModal' | 'closeQrModal'（次stepに遷移する直前に index.js が実行）
//   waitForElement     : 対象出現待ち
//   hideBack           : 戻るボタン非表示（ページ境界）
//   completeButtonLabel: 次へボタンを完了ラベルに差し替え
//
// id 8, 30, 31 は user-action-bridge（本番ハンドラ経由 or 完了）。
// step 26（タブレット切替 user-action）+ step 27（タブレット表示確認 info, onLeaveActionでプレビュー閉じ）に分離。
// step 28（QR表示 user-action）+ step 29（QR確認 info, onLeaveActionでQR閉じ）に分離。
// オプション機能カードは step10（名刺画像添付）と step11（連絡先の入力を必須化）にトグル単位で分割。関連設定は step12〜14（名刺データ化/お礼メール/回答完了画面）。選択肢4個別は step18 に統合（multi-option一括）。評定尺度は step21〜23 に「設問文／最小ラベル／最大ラベル」の1フィールド=1ステップで分割（各ステップは該当inputのみをハイライト）。

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
    body:
      'ここは、展示会で集める来場者アンケートを管理する画面です。\n'
      + 'これからアンケート作成の流れを順番にご案内します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 2, block: 'A', target: '#surveyTable', mode: 'info', placement: 'top',
    title: 'アンケート一覧を確認',
    body:
      'ここがアンケート一覧です。作成済みのアンケートが一覧表示されます。\n'
      + '本ガイドでは「回答者」＝展示会の来場者など、アンケートに答える方を指します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
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
    body:
      'ここでアンケートの基本情報を入力します。\n'
      + '練習のため、ここでは自動で入力します。\n\n'
      + '下の『次へ』ボタンを押してください。',
  },
  {
    id: 5, block: 'B', target: '#newSurveyModal #surveyName', mode: 'autofill', placement: 'right',
    title: 'アンケート名を入力',
    body:
      '社内管理用の名前で、回答者には表示されません。\n'
      + '練習のため「初めてのアンケート」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '初めてのアンケート' },
  },
  {
    id: 6, block: 'B', target: '#newSurveyModal #displayTitle', mode: 'autofill', placement: 'right',
    title: '表示タイトルを入力',
    body:
      '回答者の画面に表示される名称です。\n'
      + '練習のため「製品Aに関する満足度調査」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '製品Aに関する満足度調査' },
  },
  {
    id: 7, block: 'B', target: '#newSurveyPeriodRange', mode: 'autofill', placement: 'right',
    title: '回答期間を設定',
    body:
      '回答を受け付ける開始日と終了日を指定します。\n'
      + '練習のため翌日から3日間を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'flatpickr-range', getRange: buildPeriodRange },
  },
  {
    id: 8, block: 'B', target: '#createSurveyFromModalBtn', contextTarget: '#newSurveyModal .modal-content-transition',
    mode: 'user-action-bridge', placement: 'top',
    title: '作成する（練習・保存されません）',
    body:
      '内容を確認したら、『作成する』ボタンを押してください。\n\n'
      + '画面が切り替わって、続けて作成画面の使い方を見てみましょう。',
  },

  // ブロック C: アンケート作成画面
  {
    id: 9, block: 'C', target: '#basicInfoBody', mode: 'info', placement: 'right', hideBack: true,
    title: '基本情報の反映を確認',
    body:
      '画面が切り替わりました。\n'
      + '前の画面で入力した情報が、ここに反映されています。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 10, block: 'C', target: '#bizcardEnabledOption', contextTarget: '#optionsCardBody', mode: 'info', placement: 'left',
    title: '名刺画像添付機能',
    body:
      '回答時に名刺を撮影するステップを追加できる機能です。\n'
      + 'ONにすると、回答者は設問の途中で名刺画像を添付できます。\n'
      + '回答とリードの紐付けを1ステップで実現できる、本サービスならではの機能です。\n\n'
      + 'ここでは変更せずに『次へ』へ進みます。',
  },
  {
    id: 11, block: 'C', target: '#requireContactInfoOption', contextTarget: '#optionsCardBody', mode: 'info', placement: 'left',
    title: '連絡先の入力を必須化',
    body:
      '回答送信時に、回答者の連絡先を必ず取得するための設定です。\n'
      + 'ONにすると、名刺画像も基本情報（氏名・メール・会社名・電話番号）も無い回答は送信できなくなります。\n'
      + '送信できないとき、回答者の画面には不足している項目が一覧で表示されます。\n\n'
      + 'ここでは変更せずに『次へ』へ進みます。',
  },
  {
    id: 12, block: 'C', target: '#openBizcardSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: '名刺データ化設定',
    body:
      '収集した名刺画像をテキスト情報に変換（データ化）する設定です。\n'
      + '展示会後の名刺入力作業をまるごと任せられます。\n\n'
      + 'このボタンから開きます。設定の使い方は専用のチュートリアルで別途ご案内します。\n'
      + 'ここでは開かずに『次へ』へ進みます。',
  },
  {
    id: 13, block: 'C', target: '#openThankYouEmailSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: 'お礼メール設定',
    body:
      '回答完了後に回答者へ自動送信するお礼メールを設定できます。\n'
      + '回答直後にフォローの第一接点を作れます。\n\n'
      + 'このボタンから開きます。設定の使い方は専用のチュートリアルで別途ご案内します。\n'
      + 'ここでは開かずに『次へ』へ進みます。',
  },
  {
    id: 14, block: 'C', target: '#openThankYouScreenSettingsBtn', contextTarget: '#relatedSettingsCardBody',
    mode: 'info', placement: 'left',
    title: '回答完了画面（サンクス画面）設定',
    body:
      '回答完了画面（サンクス画面）の見た目やメッセージをカスタマイズできます。\n'
      + 'ブランドに合わせた画面で、回答後の印象まで整えられます。\n\n'
      + 'ここでは開かずに『次へ』へ進みます。',
  },
  {
    id: 15, block: 'C', target: '#addFirstQuestionBtn', mode: 'user-action', placement: 'top',
    title: '最初の設問を追加',
    body: '『最初の設問を追加』ボタンを押してください。',
  },
  {
    id: 16, block: 'C', target: '#inlineQuestionTypeMenu button[data-question-type="single_answer"]',
    waitForElement: true, mode: 'user-action', placement: 'right',
    title: '単一選択（シングルアンサー）を選択',
    body:
      '1つだけ選べる選択肢の設問です。\n'
      + '『シングルアンサー』を押してください。',
  },
  {
    id: 17, block: 'C', target: null, targetResolver: 'lastInsertedQuestionField', fieldPath: 'questionText',
    mode: 'autofill', placement: 'right',
    title: '設問文を入力',
    body:
      '回答者に何を聞くかを書く欄です。\n'
      + '練習のため「製品Aの満足度はいかがですか？」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '製品Aの満足度はいかがですか？' },
  },
  {
    id: 18, block: 'C', target: null, targetResolver: 'lastInsertedQuestionFieldOptionsAll',
    mode: 'autofill', placement: 'right',
    title: '選択肢を4つ入力',
    body:
      '回答者が選べる選択肢を4つ自動入力します。\n'
      + '練習のため「とても満足」「満足」「やや不満」「不満」を順に入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'multi-option', values: ['とても満足', '満足', 'やや不満', '不満'] },
  },
  {
    id: 19, block: 'C', target: '#addQuestionInlineBtn', waitForElement: true,
    mode: 'user-action', placement: 'top',
    title: '2 問目を追加',
    body: '設問の下の『設問を追加』ボタンを押してください。',
  },
  {
    id: 20, block: 'C', target: '#inlineQuestionTypeMenuBottom button[data-question-type="rating_scale"]',
    waitForElement: true, mode: 'user-action', placement: 'right',
    title: '段階評価（評定尺度）を選択',
    body:
      '満足度などを段階で評価してもらう設問です。\n'
      + '『評定尺度』を押してください。',
  },
  {
    id: 21, block: 'C', target: null, targetResolver: 'lastInsertedQuestionField', fieldPath: 'questionText',
    mode: 'autofill', placement: 'right',
    title: '評定尺度の設問文を入力',
    body:
      '回答者に何を評価してもらうかを書く欄です。\n'
      + '練習のため「今回のサービス全体の満足度をお聞かせください。」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '今回のサービス全体の満足度をお聞かせください。' },
  },
  {
    id: 22, block: 'C', target: null, targetResolver: 'lastInsertedQuestionField', fieldPath: 'minLabel',
    mode: 'autofill', placement: 'right',
    title: '最小値ラベルを入力',
    body:
      '尺度の左端（最小値）に表示するラベルです。\n'
      + '練習のため「とても不満」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: 'とても不満' },
  },
  {
    id: 23, block: 'C', target: null, targetResolver: 'lastInsertedQuestionField', fieldPath: 'maxLabel',
    mode: 'autofill', placement: 'right',
    title: '最大値ラベルを入力',
    body:
      '尺度の右端（最大値）に表示するラベルです。\n'
      + '練習のため「とても満足」を自動入力しました。\n\n'
      + '下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: 'とても満足' },
  },

  // ブロック D: プレビュー〜完了
  {
    id: 24, block: 'D', target: null, targetResolver: 'actionButton', action: 'preview',
    mode: 'user-action', placement: 'left',
    title: 'プレビューを開く',
    body:
      '回答者にどのように表示されるかを確認できます。\n'
      + 'ハイライトされた『プレビュー』ボタンを押してください。',
  },
  {
    id: 25, block: 'D', target: '#surveyPreviewModalV2 .modal-content-transition', waitForElement: true,
    mode: 'info', placement: 'left',
    title: 'スマートフォン表示を確認',
    body:
      'プレビューが開きました。最初は回答者のスマートフォン画面です。\n'
      + 'プレビュー内のアンケートに回答して「送信」を押すと、回答完了画面（サンクス画面）まで確認できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 26, block: 'D', target: '#v2-preview-tablet-btn', waitForElement: true,
    mode: 'user-action', placement: 'bottom',
    title: 'タブレット表示に切り替える',
    body:
      '展示会では来場者がスマートフォンで読み取ったり、ブースのタブレットで回答したりします。\n'
      + '『タブレット』ボタンを押して、見え方を切り替えてください。',
  },
  {
    id: 27, block: 'D', target: '#surveyPreviewModalV2 .modal-content-transition', waitForElement: true,
    mode: 'info', placement: 'left',
    onLeaveAction: 'closePreviewModal',
    title: 'タブレット表示を確認',
    body:
      'タブレットでの見え方に切り替わりました。スマートフォンとの違いを確認できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 28, block: 'D', target: null, targetResolver: 'actionButton', action: 'qr',
    mode: 'user-action', placement: 'left',
    title: 'QR コードを表示',
    body:
      '回答用のQRコードを表示してみましょう。\n'
      + '『QR発行』ボタンを押してください。',
  },
  {
    id: 29, block: 'D', target: '#qrCodeModal .modal-content-transition', waitForElement: true,
    mode: 'info', placement: 'left',
    onLeaveAction: 'closeQrModal',
    title: 'QR コードを確認',
    body:
      'これが回答用QRコードです。\n'
      + '来場者にスマートフォンで読み取ってもらい、アンケートに回答してもらうために使います。\n'
      + '展示会で配布したり画面に表示することで運用できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 30, block: 'D', target: null, targetResolver: 'actionButton', action: 'save',
    mode: 'user-action-bridge', placement: 'left',
    title: 'アンケートを保存する',
    body:
      'ハイライトされた保存ボタンを押してください。\n'
      + '保存してもこの画面のまま、ダッシュボードへ自動では移動しません。\n\n'
      + '（練習のため実際には保存されません）',
  },
  {
    id: 31, block: 'D', target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    // ※「今練習したもの」を実際に公開できる、という旨は事実と異なるため記載しない。
    // 練習中の入力はチュートリアル内で完結しており、アカウント側へ引き継がれない。
    // ※「お疲れさまでした。〇〇」と一文に詰めると冷たい印象だったため、感嘆符＋改行で
    //   ねぎらいの語をしっかり伝えてから本題に移す構成にしている。
    body:
      'お疲れさまでした！\n'
      + 'アンケート作成の基本フローはこれで一通り体験いただけました。\n\n'
      + 'アカウントを作成すると、ご自身でアンケートを作成・公開して回答を集められます。\n\n'
      + '下の『完了』ボタンを押してください。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}
