// steps-speedreview.js
// SPEEDレビュー チュートリアル ステップ定義（全 18 ステップ）。
//
// 各ステップフィールドは既存 steps.js / steps-bizcard.js と同じフォーマット（id, target, mode,
// placement, title, body 等）を使用。ハブ（index.html）から直接起動する:
//   speed-review.html?surveyId=sv_0001_25022&tutorial=1&step=1
// 完了・スキップ時はハブ（index.html）へ戻る。アカウント作成 CTA 画面は表示しない。
//
// 方針: 静的な説明の羅列を避け、価値の高い操作（設問切替でグラフが変わる／名刺を開く）は
// 実際に操作して見せる。並び替え・ページングなどの些末なナビは省く。
//
// 注: progress バーのブロック名（overlay.js の BLOCK_LABELS）はアンケート作成チュートリアル用に
// 固定されているため、本チュートリアルでは block を設定しない（ラベルは空・進捗ゲージは step.id で進む）。

export const TUTORIAL_STEPS = [
  // ── A. オリエンテーション ──
  {
    id: 1, target: null, mode: 'info', placement: 'center',
    title: 'SPEEDレビューへようこそ',
    body:
      'ここは SPEEDレビューの画面です。\n'
      + '展示会で集めた回答と名刺を、その場で確認・集計・編集できます。\n\n'
      + 'これから画面の見方を順番にご案内します。\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 2, target: '#review-survey-name', mode: 'info', placement: 'bottom',
    title: '対象アンケートの確認',
    body:
      'いまどのアンケートの結果を見ているかが、ここに表示されます。\n'
      + '別のアンケートの結果は、アンケート一覧から開き直します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ── B. サマリー & 設問切替→グラフ変化のデモ ──
  {
    id: 3, target: '#kpi-total-answers', mode: 'info', placement: 'bottom',
    title: '回答総数',
    body:
      'これまでに集まった回答の件数です。\n'
      + 'リアルタイムで増えていくため、会期中の集まり具合をひと目で確認できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 4, target: '#kpi-current-question-card', mode: 'info', placement: 'bottom',
    title: 'いま集計している設問',
    body:
      'このカードが、いま集計対象になっている設問です。\n'
      + '下のグラフや集計データは、この設問の回答をまとめたものです。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 5, target: '#attributeChart', mode: 'info', placement: 'top',
    title: '回答内容の内訳',
    body:
      'いまの設問（単一選択）の回答内訳を円グラフで表示しています。\n'
      + 'どの選択肢が多いかがひと目でわかります。\n\n'
      + 'この次に、設問を切り替えるとグラフがどう変わるか見てみましょう。\n'
      + '下の『次へ』ボタンを押してください。',
  },
  {
    id: 6, target: '#question-change-link', mode: 'user-action', placement: 'top',
    title: '設問を切り替えてみる',
    body:
      'この「設問を変更」を押すと、集計する設問を選べます。\n'
      + '押して、設問の一覧を開いてみましょう。',
  },
  {
    id: 7, target: '#modal-question-list button:nth-child(6)', mode: 'user-action', placement: 'right',
    title: '別の設問を選ぶ',
    body:
      'ハイライトした「複数選択」の設問（きっかけ）を選んでみましょう。\n'
      + '選ぶと、集計対象がその設問に切り替わります。',
  },
  {
    id: 8, target: '#attributeChart', mode: 'info', placement: 'top',
    title: 'グラフが切り替わりました',
    body:
      '円グラフから棒グラフに切り替わりました。\n'
      + '単一選択は円グラフ、複数選択は棒グラフ、というように設問の種類に合わせて見やすい形で表示されます。\n'
      + '時間帯別回答数や集計データも、選んだ設問に連動します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 9, target: '#timeSeriesChart', mode: 'info', placement: 'top',
    title: '時間帯別回答数',
    body:
      '回答が集まった時間帯の分布です。\n'
      + '右上の『自動 / 固定』で表示する時間の範囲を切り替えられます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ── C. 回答一覧 & 名刺 & 詳細 ──
  {
    id: 10, target: '#reviewTable', mode: 'info', placement: 'top',
    title: '回答一覧',
    body:
      'ここには 1 件ずつの回答が並びます。\n'
      + '回答ID・回答日時・氏名・会社名・設問回答の列で構成されています。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 11, target: '#reviewTableBody tr .toggle-inline-btn', mode: 'user-action', placement: 'right',
    title: '名刺を開いてみる',
    body:
      '各行の左端のこのボタンを押すと、その場で行が開いて名刺を確認できます。\n'
      + '押して開いてみましょう。',
  },
  {
    id: 12, target: '.inline-detail-row', mode: 'info', placement: 'top',
    title: '名刺が開きました',
    body:
      'このように、一覧を離れずに名刺（表・裏の画像と読み取り内容）を確認できます。\n'
      + '画像は拡大・回転もできます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 13, target: '#reviewTableBody tr', mode: 'user-action', placement: 'top',
    title: '回答の詳細を開く',
    body:
      'さらに詳しく見るときは、行の空いている部分をクリックします。\n'
      + 'ボタン以外の場所を押してみましょう。',
  },
  {
    id: 14, target: '#reviewDetailModal', mode: 'info', placement: 'left',
    title: '回答の詳細',
    body:
      '詳細では、名刺の情報とアンケートの回答内容をまとめて確認できます。\n'
      + '右下の「編集する」で回答を直すこともできます（この練習では保存されません）。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 15, target: '#closeDetailModalBtn', mode: 'user-action', placement: 'bottom',
    title: '詳細を閉じる',
    body:
      '右上の × ボタンで詳細を閉じられます。\n'
      + '押して一覧に戻りましょう。',
  },

  // ── D. 絞り込み（右サイドバー） ──
  {
    id: 16, target: '#right-sidebar', mode: 'info', placement: 'left',
    onEnterAction: 'openRightSidebar',
    title: '絞り込みパネル',
    body:
      '右側のパネルで、表示する回答を絞り込めます。\n'
      + '普段は右端に収納されていて、端の取っ手ボタンで開閉できます。\n'
      + '「簡易検索」と「詳細検索」を切り替えて使います。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 17, target: '#simple-search-content', mode: 'info', placement: 'left',
    onEnterAction: 'openRightSidebar',
    title: '表示対象日とステータスで絞り込む',
    body:
      '「表示対象日」で期間（会期全体／特定の日）を、\n'
      + '「ステータス」で名刺データ化の状況（完了／進行中）を絞り込めます。\n'
      + '下の「フィルターをリセット」で、いつでも全件表示に戻せます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ── E. 完了 ──
  {
    id: 18, target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    body:
      'お疲れさまでした！\n'
      + 'SPEEDレビューの基本的な見方はこれで完了です。\n\n'
      + '集めた回答をここで確認・集計・編集していきましょう。\n'
      + '『完了』を押してください。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}

export const TUTORIAL_CONFIG = {
  id: 'speedreview',
  progressKey: 'speedad-tutorial-speedreview-progress',
  completedKey: 'speedad-tutorial-speedreview-completed',
  // ハブから直接起動するチュートリアルのため、完了・スキップ時はハブ（index.html）へ戻す。
  onComplete: () => {
    window.location.assign('index.html');
  },
};
