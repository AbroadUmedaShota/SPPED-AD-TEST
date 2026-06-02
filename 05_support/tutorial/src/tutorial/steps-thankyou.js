// steps-thankyou.js
// お礼メール設定チュートリアル ステップ定義（仕様書 §4.6・全 15 ステップ）。
//
// 各ステップフィールドは既存 steps.js と同じフォーマット（id, target, mode, placement, title, body 等）を使用。
// 完了・スキップ時はハブ（index.html）へ戻る。ただし復帰コンテキスト（RETURN_KEY）がある場合は
// 作成チュートリアルの指定ステップへ戻る。アカウント作成 CTA 画面は表示しない。
// 起動時は after_event_ready 状態固定（guards-thankyou.js の DOMContentLoaded 後に強制設定）。

import { readReturn, clearReturn } from './state.js';

export const TUTORIAL_STEPS = [
  // ブロック A: 画面オリエンテーション
  {
    id: 1, block: 'A', target: null, mode: 'info', placement: 'center',
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
      + '『送信しない』はこのアンケートではお礼メール機能を使用しません。\n'
      + '『自動送信』は今後の対応予定です。\n\n'
      + 'このチュートリアルでは『手動送信』で進めます。確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 4, block: 'B', target: '.send-method-card', mode: 'user-action', placement: 'bottom',
    title: '送信方法を選択する',
    body:
      'いずれかの送信方法カードを選んでください。\n'
      + 'このチュートリアルでは『手動送信』を選んで進めます。',
  },

  // ブロック C: テンプレート選択
  {
    id: 5, block: 'C', target: '#emailTemplate', mode: 'user-action', placement: 'bottom',
    title: 'テンプレートを選ぶ',
    body:
      'メール文面のテンプレートを選びます。ドロップダウンからテンプレートを選んでください。\n'
      + 'テンプレートを選ぶと件名と本文が自動で入力されます（編集済みの内容は上書きされます）。\n'
      + '選んだ後で自分で編集することもできます。',
  },

  // ブロック D: 件名・本文入力
  {
    id: 6, block: 'D', target: '#emailSubject', mode: 'autofill', placement: 'bottom',
    title: '件名を入力',
    body:
      'ここがメールの件名入力欄です。受信者のメールソフトに表示される件名を設定します。\n'
      + '練習のため『この度はご来場いただきありがとうございました』を自動入力しました。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: 'この度はご来場いただきありがとうございました' },
  },
  {
    id: 7, block: 'D', target: '#emailBody', mode: 'autofill', placement: 'top',
    title: '本文を入力',
    body:
      'ここがメールの本文入力欄です。受信者に届く本文を入力します。\n'
      + '差し込み変数を使うと、会社名・氏名などを自動で埋め込んだ個別の文面を作成できます。\n'
      + '練習のため本文を自動入力しました。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
    autoInput: {
      kind: 'text',
      value:
        'この度は弊社ブースにお立ち寄りいただきありがとうございました。\n'
        + '今後ともよろしくお願いいたします。',
    },
  },

  // ブロック E: 差し込み変数・プレビュー
  {
    id: 8, block: 'E', target: '#variableContainer', mode: 'info', placement: 'top',
    waitForElement: true,
    title: '差し込み変数',
    body:
      '【差し込み変数とは】\n'
      + '会社名・氏名・部署名など、受信者ごとに異なる情報を本文に自動で埋め込む仕組みです。\n'
      + 'ここに変数の一覧が表示されています。本文にカーソルを置いてバッジをクリックすると、その位置に挿入されます。\n'
      + '例えば「{{会社名}}」を入れておくと、送信時に各受信者の会社名へ置き換わります。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 9, block: 'E', target: '#previewCard', mode: 'info', placement: 'top',
    title: 'プレビューで確認',
    body:
      '件名と本文の下にリアルタイムプレビューが表示されます。\n'
      + '変数を挿入した状態でメールがどのように見えるかを確認できます。\n\n'
      + '実際の送信前に必ず文面を確認しましょう。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック F: 受信者リスト確認 & 保存
  {
    id: 10, block: 'F', target: '#recipientTableWrapper', mode: 'info', placement: 'top',
    waitForElement: true,
    title: '受信者リスト',
    body:
      'ここに送信対象者のリストが表示されます。\n'
      + '会期終了後に名刺データ化が完了すると、対象者が自動で一覧に追加されます。\n\n'
      + 'このチュートリアルでは練習用のサンプルデータが表示されています。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 11, block: 'F', target: '#estimatedAmount', mode: 'info', placement: 'left',
    title: '料金見積もりを確認',
    body:
      '右カラムの『お礼メールの小計（税込）』に料金が表示されます。\n'
      + 'お礼メールは100通まで無料、101通目以降は1通あたり¥1（税込）で、送信対象者数に応じて自動計算されます。\n'
      + 'クーポンや詳細内訳は別のチュートリアルで説明します。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 12, block: 'F', target: '#saveThankYouEmailSettingsBtn', mode: 'user-action-bridge', placement: 'top',
    title: '設定を保存する（練習・保存されません）',
    body:
      '設定内容を確認したら『設定を保存する』ボタンを押してください。\n\n'
      + '練習のため実際には保存されません。\n'
      + '続けて、お礼メールの送信操作も体験します。',
  },
  {
    id: 13, block: 'F', target: '#sendThankYouEmailBtn', mode: 'user-action', placement: 'top',
    title: 'お礼メールを送信する',
    body:
      '『お礼メールを送信する』ボタンを押してください。\n'
      + '送信対象者数と金額を確認するダイアログが開きます。\n'
      + '（送信できるのは名刺データ化の完了から7日間です。練習のため、実際には送信されません。）',
  },
  {
    id: 14, block: 'F', target: '#sendConfirmExecuteBtn', mode: 'user-action-bridge', placement: 'right',
    waitForElement: true,
    title: '送信を実行する（練習・送信されません）',
    body:
      '確認ダイアログで送信対象者数と金額を確認し、『送信する』ボタンを押してください。\n'
      + '練習のため、実際にはお礼メールは送信されません。\n'
      + 'これでこのチュートリアルは完了です。',
  },
  {
    id: 15, block: 'F', target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    body:
      'お疲れさまでした！\n'
      + 'お礼メール設定の基本操作はこれで完了です。\n\n'
      + '『完了』を押してください。',
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
  // 完了時: 復帰コンテキスト（チェーン元）があれば作成チュートリアルの該当ステップへ戻り、
  // 無ければ従来どおりハブ（index.html）へ。スキップ(終了)経路は index-thankyou.js の
  // handleSkipConfirm が先に clearReturn() するため、ここを通っても return 無し＝ハブへ向かう。
  onComplete: () => {
    const ret = readReturn();
    if (ret) {
      clearReturn();
      const sep = ret.url.includes('?') ? '&' : '?';
      window.location.assign(`${ret.url}${sep}tutorial=1&step=${ret.step}`);
    } else {
      window.location.assign('index.html');
    }
  },
};
