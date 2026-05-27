// steps-thankyou.js
// お礼メール設定チュートリアル ステップ定義（仕様書 §4.6・全 21 ステップ）。
//
// 各ステップフィールドは既存 steps.js と同じフォーマット（id, target, mode, placement, title, body 等）を使用。
// 完了・スキップ時はハブ（index.html）へ戻る。アカウント作成 CTA 画面は表示しない。
// 起動時は after_event_ready 状態固定（guards-thankyou.js の DOMContentLoaded 後に強制設定）。

export const TUTORIAL_STEPS = [
  // ブロック A: 画面オリエンテーション
  {
    id: 1, block: 'A', target: '#main-content', mode: 'info', placement: 'center',
    title: 'お礼メール設定の画面',
    body:
      'ここがお礼メール設定の画面です。\n'
      + '展示会などで名刺を渡してくれた方へ、後日お礼メールを一括送信するための設定を行います。\n\n'
      + 'これから設定の流れを順番にご案内します。\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 2, block: 'A', target: '#surveyNameDisplay', mode: 'info', placement: 'bottom',
    title: '対象アンケートを確認',
    body:
      '画面上部に対象アンケートの名前が表示されています。\n'
      + '設定を始める前に、対象アンケートが正しいことをご確認ください。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック B: 送信方法選択
  {
    id: 3, block: 'B', target: '.send-method-card', mode: 'info', placement: 'bottom',
    title: '送信方法の選択',
    body:
      'ここで送信方法を選択します。\n\n'
      + '『手動送信』はデータ化完了後に内容を確認してから手動で送信します。\n'
      + '『自動送信』はデータ化完了を検知次第、自動でメールを送ります。\n'
      + '『送信しない』はこのアンケートではお礼メール機能を使用しません。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 4, block: 'B', target: '.send-method-card', mode: 'user-action', placement: 'bottom',
    title: '送信方法を選択する',
    body:
      'いずれかの送信方法カードをクリックして選択してください。\n'
      + 'このチュートリアルでは『手動送信』を選んで進めます。',
  },
  {
    id: 5, block: 'B', target: '#estimateSidebar', mode: 'info', placement: 'left',
    title: '右カラムについて',
    body:
      '右カラムには料金見積もりやクーポン欄もありますが、\n'
      + 'これらは別のチュートリアルで扱います。\n'
      + '今回は気にしなくて大丈夫です。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック C: テンプレート選択
  {
    id: 6, block: 'C', target: '#emailTemplate', mode: 'info', placement: 'bottom',
    title: 'テンプレートを選択',
    body:
      'ここでメール文面のテンプレートを選択します。\n'
      + 'テンプレートを選ぶと件名と本文が自動で入力されます。\n'
      + '選んだ後で自分で編集することもできます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 7, block: 'C', target: '#emailTemplate', mode: 'user-action', placement: 'bottom',
    title: 'テンプレートを選択する',
    body:
      'ドロップダウンをクリックしてテンプレートを選択してください。\n\n'
      + 'テンプレートを選ぶと、現在の件名と本文が上書きされます。\n'
      + '編集済みの内容がある場合はご注意ください。',
  },
  {
    id: 8, block: 'C', target: '#emailSubject', mode: 'info', placement: 'bottom',
    title: '件名・本文への反映を確認',
    body:
      'テンプレートを選ぶと、件名と本文にテンプレートの内容が反映されます。\n'
      + '次のステップで件名と本文を編集できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック D: 件名・本文入力
  {
    id: 9, block: 'D', target: '#emailSubject', mode: 'info', placement: 'bottom',
    title: '件名の入力欄',
    body:
      'ここがメールの件名入力欄です。\n'
      + '受信者のメールソフトに表示される件名を設定します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 10, block: 'D', target: '#emailSubject', mode: 'autofill', placement: 'bottom',
    title: '件名を入力',
    body:
      'ここが**件名**の入力欄です。\n'
      + '練習のため件名を自動入力しました。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: 'この度はご来場いただきありがとうございました' },
  },
  {
    id: 11, block: 'D', target: '#emailBody', mode: 'info', placement: 'top',
    title: '本文の入力欄',
    body:
      'ここがメールの本文入力欄です。\n'
      + '受信者に届くメール本文を入力します。\n\n'
      + '差し込み変数を使うと、会社名・氏名などを自動で埋め込んだ\n'
      + '個別の文面を作成できます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 12, block: 'D', target: '#emailBody', mode: 'autofill', placement: 'top',
    title: '本文を入力',
    body:
      'ここが**本文**の入力欄です。\n'
      + '練習のため本文を自動入力しました。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
    autoInput: {
      kind: 'text',
      value:
        'この度は弊社ブースにお立ち寄りいただきありがとうございました。\n'
        + '今後ともよろしくお願いいたします。',
    },
  },

  // ブロック E: 差し込み変数挿入
  {
    id: 13, block: 'E', target: '#toggleVariablesBtn', mode: 'info', placement: 'bottom',
    title: '差し込み変数パネル',
    body:
      'ここが差し込み変数パネルの開閉ボタンです。\n\n'
      + '【差し込み変数とは】\n'
      + '会社名・氏名・部署名など、受信者ごとに異なる情報を本文に\n'
      + '自動で埋め込む仕組みです。\n'
      + '例えば「{{company}}」と入力すると、実際のメール送信時に\n'
      + 'その方の会社名に置き換わります。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 14, block: 'E', target: '#toggleVariablesBtn', mode: 'user-action', placement: 'bottom',
    title: '変数パネルを開く',
    body:
      '『差し込み変数を挿入』ボタンを押してパネルを開いてください。',
  },
  {
    id: 15, block: 'E', target: '#variableContainer', mode: 'info', placement: 'top',
    waitForElement: true,
    title: '変数バッジを確認する',
    body:
      'パネルに変数の一覧が表示されます。\n'
      + 'クリックするとカーソル位置に変数が挿入されます。\n\n'
      + '本文欄にカーソルを置いてから変数をクリックすると、\n'
      + 'その位置に差し込まれます。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 16, block: 'E', target: '#previewSubject', mode: 'info', placement: 'top',
    title: 'プレビューで確認',
    body:
      '件名と本文の下にリアルタイムプレビューが表示されます。\n'
      + '変数を挿入した状態でメールがどのように見えるかを確認できます。\n\n'
      + '実際の送信前に必ず文面を確認しましょう。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック F: 受信者リスト確認 & 保存
  {
    id: 17, block: 'F', target: '#recipientTableWrapper', mode: 'info', placement: 'top',
    waitForElement: true,
    title: '受信者リスト',
    body:
      'ここに送信対象者のリストが表示されます。\n'
      + '会期終了後に名刺データ化が完了すると、対象者が自動で一覧に追加されます。\n\n'
      + 'このチュートリアルでは練習用のサンプルデータが表示されています。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 18, block: 'F', target: '#main-content', mode: 'info', placement: 'center',
    title: '送信状態の通知について',
    body:
      '会期が終了し送信が可能になると、画面上部にステータスメッセージが表示されます。\n'
      + 'また、送信ボタンが自動的に有効化されます。\n\n'
      + 'このチュートリアルでは送信前の設定のみを扱うため、ステータスメッセージは表示されません。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 19, block: 'F', target: '#sendThankYouEmailBtn', mode: 'info', placement: 'top',
    title: '送信ボタンについて',
    body:
      '送信可能な状態になると『お礼メールを送信する』ボタンが有効になります。\n\n'
      + 'このチュートリアルでは送信操作は行いません。\n'
      + '送信手順は実際の設定が完了した後にお試しください。\n'
      + '送信操作の詳細は別のチュートリアルで扱います。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 20, block: 'F', target: '#saveThankYouEmailSettingsBtn', mode: 'user-action-bridge', placement: 'top',
    title: '設定を保存する（練習・保存されません）',
    body:
      '設定内容を確認したら『設定を保存する』ボタンを押してください。\n\n'
      + '練習のため実際には保存されません。\n'
      + 'これでこのチュートリアルは完了です。',
  },
  {
    id: 21, block: 'F', target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    body:
      'お疲れさまでした！\n'
      + 'お礼メール設定の基本操作はこれで完了です。\n\n'
      + '『完了』を押すとチュートリアル一覧に戻ります。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}

export const TUTORIAL_CONFIG = {
  id: 'thankyou',
  progressKey: 'speedad-tutorial-thankyou-progress',
  completedKey: 'speedad-tutorial-thankyou-completed',
  onComplete: () => window.location.assign('index.html'),
  onSkip: () => window.location.assign('index.html'),
};
