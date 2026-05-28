// steps-bizcard.js
// 名刺データ化設定チュートリアル ステップ定義（仕様書 §4.5・全 19 ステップ）。
//
// 各ステップフィールドは既存 steps.js と同じフォーマット（id, target, mode, placement, title, body 等）を使用。
// 完了・スキップ時はハブ（index.html）へ戻る。ただし復帰コンテキスト（RETURN_KEY）がある場合は
// 作成チュートリアルの指定ステップへ戻る。アカウント作成 CTA 画面は表示しない。

import { readReturn, clearReturn } from './state.js';

export const TUTORIAL_STEPS = [
  // ブロック A: 画面オリエンテーション
  {
    id: 1, block: 'A', target: null, mode: 'info', placement: 'center',
    title: '名刺データ化設定の画面',
    body:
      'ここが名刺データ化設定の画面です。\n'
      + '展示会などで集めた名刺をデジタルデータに変換する設定を行います。\n\n'
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

  // ブロック B: データ化 ON/OFF
  {
    id: 3, block: 'B', target: '#skipBizcardToggleContainer', mode: 'info', placement: 'bottom',
    title: 'データ化 ON/OFF の設定',
    body:
      'ここで名刺データ化の ON / OFF を設定します。\n'
      + 'ON にすると、集めた名刺を SPEED AD がデジタルデータに変換します。\n'
      + 'OFF にすると、名刺画像は収集されますがデータ化は行われません。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 4, block: 'B', target: '#skipBizcardToggle', mode: 'user-action', placement: 'right',
    title: 'トグルを ON にする',
    body:
      'チェックボックスをオンにして、データ化を ON にしてください。\n'
      + 'このチュートリアルでは ON のまま進みます。',
  },
  {
    id: 5, block: 'B', target: '#bizcardSettingsFields', mode: 'info', placement: 'top',
    title: '社内管理用メモ（任意）について',
    body:
      'この画面の下の方には『社内管理用メモ（任意）』欄もあります。\n'
      + 'この名刺データ化依頼について、社内の備忘や引き継ぎ用に自由にメモを残せる欄です。\n'
      + '入力しても回答者には表示されません。必要なときだけ開いて使ってください。\n\n'
      + '今回は入力せず進みます。下の『次へ』ボタンを押してください。',
  },

  // ブロック C: プラン選択
  {
    id: 6, block: 'C', target: '#dataConversionPlanSelection', mode: 'info', placement: 'top',
    title: 'データ化プランを選択',
    body:
      'ここでデータ化プランを選択します。\n'
      + 'プランは「納期の速さ」と「1枚あたりの単価」で分かれます。\n\n'
      + '【データ化プランとは】\n'
      + 'お試し（無料・2項目）／通常（＠50円）／特急（＠100円）／超特急（＠150円）／オンデマンド（＠200円）の5つです。\n'
      + '通常以上はいずれも標準10項目をデータ化でき、選ぶプランで納期（6営業日〜当日）と料金が変わります。\n'
      + '迷ったら「通常」（おすすめ）が標準的です。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 7, block: 'C', target: '#dataConversionPlanSelection', mode: 'user-action', placement: 'top',
    title: 'プランカードを選択する',
    body:
      'いずれかのプランカードをクリックして選択してください。\n'
      + '迷う場合は「通常」を選ぶと、標準10項目を＠50円・6営業日でデータ化できます。',
  },
  {
    id: 8, block: 'C', target: '#estimatedAmount', mode: 'info', placement: 'left',
    title: '料金見積もりを確認',
    body:
      'プランを選ぶと、右カラムの料金見積もりに自動で金額が反映されます。\n'
      + 'これは見込み金額（税抜）です。\n'
      + '実際の請求は処理完了後の実数で確定します。\n\n'
      + '練習中は課金されません。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック D: 見込み枚数入力
  {
    id: 9, block: 'D', target: '#bizcardRequest', mode: 'info', placement: 'top',
    title: '見込み枚数の入力欄',
    body:
      'ここで会期中に収集する名刺の見込み枚数を入力します。\n'
      + '見込み枚数をもとに料金の見積もりが計算されます。\n'
      + '実際の枚数と異なっても問題ありません。\n'
      + '後から変更できます（会期開始前まで）。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 10, block: 'D', target: '#bizcardRequest', mode: 'autofill', placement: 'top',
    title: '見込み枚数を入力',
    body:
      'ここが**見込み枚数**の入力欄です。\n'
      + '練習のため『100』を自動入力しました。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
    autoInput: { kind: 'text', value: '100' },
  },
  {
    id: 11, block: 'D', target: '#bizcardRequestIncBtn', mode: 'user-action', placement: 'left',
    title: '＋ボタンで枚数を増やす',
    body:
      '『＋』ボタンを押してみてください。\n'
      + '枚数を 1 枚ずつ増やせます。\n'
      + '±10、±100 のボタンも同様に使えます。',
  },
  {
    id: 12, block: 'D', target: '#minChargeNotice', mode: 'info', placement: 'top',
    title: '最低請求バッジについて',
    body:
      '枚数によっては最低請求ラインの案内が表示されることがあります。\n'
      + '実際の枚数が見込み枚数を下回る場合も、最低保証枚数分の請求が発生します。\n'
      + '詳しくは右カラムの注意事項をご確認ください。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック E: プレミアムオプション
  {
    id: 13, block: 'E', target: '#premiumOptionsContainer', mode: 'info', placement: 'top',
    title: 'プレミアムオプション',
    body:
      'ここで追加のデータ化オプションを選べます。\n\n'
      + '【プレミアムオプションとは】\n'
      + '標準プランに加えて、名刺の追加情報をデータ化する有料オプションです。\n'
      + '「多言語対応」（中国語など複数言語の翻訳入力）や、\n'
      + '「電話番号2つ目」「住所2つめ」「手書きメモ」などの追加項目を選べます。\n'
      + '必要な項目がある場合のみ選択してください。不要ならそのままで構いません。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 14, block: 'E', target: '#premiumOptionsContainer', mode: 'user-action', placement: 'top',
    title: 'オプションの選択を試す',
    body:
      '気になるオプションがあればクリックして選択してみてください。\n'
      + '選んでも選ばなくても設定の練習は続けられます。',
  },
  {
    id: 15, block: 'E', target: '#estimatedCompletionDate', mode: 'info', placement: 'left',
    title: '完了予定日を確認',
    body:
      '右カラムに完了予定日が表示されます。\n'
      + '名刺データ化がおおよそいつ頃完了するかの目安です。\n\n'
      + 'クーポンや詳細内訳など他の項目は別のチュートリアルで扱いますので、\n'
      + '今は気にしなくて大丈夫です。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },

  // ブロック F: 右カラム確認 & 保存
  {
    id: 16, block: 'F', target: '.estimate-block-survey-total', mode: 'info', placement: 'left',
    title: 'アンケート全体料金ブロック',
    body:
      '右カラムの『アンケート全体料金』には、\n'
      + '名刺データ化とお礼メール合計の請求見込みが表示されます。\n\n'
      + 'クーポン欄や詳細内訳は別のチュートリアルで扱います。\n'
      + 'ここでは全体金額の表示場所を覚えておいてください。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 17, block: 'F', target: '#couponSectionWrapper', mode: 'info', placement: 'left',
    title: 'クーポン・詳細内訳について',
    body:
      '右カラムには割引クーポン欄や詳細内訳もありますが、\n'
      + 'これらは別のチュートリアルで扱います。\n'
      + '今回は気にしなくて大丈夫です。\n\n'
      + '確認できたら、下の『次へ』ボタンを押してください。',
  },
  {
    id: 18, block: 'F', target: '#saveBizcardSettingsBtn', mode: 'user-action-bridge', placement: 'top',
    title: '設定を保存する（練習・保存されません）',
    body:
      '設定内容を確認したら『設定を保存して依頼を確定』ボタンを押してください。\n\n'
      + '練習のため実際には保存されません。\n'
      + 'これでこのチュートリアルは完了です。',
  },
  {
    id: 19, block: 'F', target: null, mode: 'user-action-bridge', placement: 'center',
    title: 'チュートリアル完了',
    body:
      'お疲れさまでした！\n'
      + '名刺データ化設定の基本操作はこれで完了です。\n\n'
      + '『完了』を押してください。',
    completeButtonLabel: '完了',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}

export const TUTORIAL_CONFIG = {
  id: 'bizcard',
  progressKey: 'speedad-tutorial-bizcard-progress',
  completedKey: 'speedad-tutorial-bizcard-completed',
  // 完了時: 復帰コンテキスト（チェーン元）があれば作成チュートリアルの該当ステップへ戻り、
  // 無ければ従来どおりハブ（index.html）へ。スキップ(終了)経路は index-bizcard.js の
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
