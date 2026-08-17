/*
 * SPEED AD LP 共通データ（正本）
 *
 * lp/ 配下の各LPに載せる料金・プラン・対応言語の唯一の出典。
 * 値を変えたらここを直し、`node lp/check-pricing.mjs` で全LPの追従漏れを検出する。
 * 新規LPを作るときは、この値を手打ちせずここから引く。
 *
 * 出典: アーカイブ/design_handoff_speed_ad_lp/README.md（speed-ad LP の確定値）
 *       対応言語は 2026-08-13 のユーザー確定（日本語・英語・中国語）
 */

export const SPEED_PLANS = [
  { name: 'お試し',       unit: '0円／枚',   items: '2項目',  lead: '6営業日', note: null },
  { name: '通常',         unit: '50円／枚',  items: '10項目', lead: '6営業日', note: null },
  { name: '特急',         unit: '100円／枚', items: '10項目', lead: '3営業日', note: null },
  { name: '超特急',       unit: '150円／枚', items: '10項目', lead: '1営業日', note: null },
  { name: 'オンデマンド', unit: '200円／枚', items: '10項目', lead: '当日',    note: 'プレミアム限定' },
];

export const BASE_PLANS = {
  standard: {
    label: 'スタンダード',
    monthly: '0',
    monthlyUnit: '円',
    tax: '（税別）',
    features: ['データ保存期間 30日間', '回答機能（日本語）'],
  },
  premium: {
    label: 'プレミアム',
    monthly: '10,000',
    monthlyUnit: '円',
    tax: '（税別）',
    features: ['データ保存期間 最長1年', '多言語切り替え', '日本語以外の名刺のデータ化', 'オンデマンドで利用可能'],
  },
};

export const INITIAL_COST = { label: '初期費用・システム導入費用', amount: '0', unit: '円' };

export const THANKS_MAIL = {
  label: 'お礼メール送信料金',
  freeUpTo: { label: '100通まで', amount: '0', unit: '円' },
  paid: { label: '101通目以降', amount: '1', unit: '円／通', tax: '（税別）' },
  note: 'お礼メール送信は100通まで無料、101通目以降は1通1円（税別）です。',
};

/* 名刺データ化の精算の言い回し（3枚で表記を揃えるためここに固定） */
export const SETTLEMENT_NOTE = '名刺データ化の料金は、速度プランの単価 × 実際の枚数の実費精算です。';

/*
 * 最低請求条件。見込み枚数の半数分は、実際の枚数が下回っても請求対象になる。
 * これを書かずに「実費精算」だけを載せると、実枚数が見込みを大きく下回ったときに
 * 請求額が説明と合わなくなる。目立たせる必要はないが、料金を語るLPには必ず添える。
 * 出典: docs/リライト版仕様書/user/06_bizcard_settings_requirements.md:174（ceil(枚数 × 0.5) × 単価）
 *       docs/リライト版仕様書/user/31_tutorial_requirements.md:329（利用者向けの言い回し）
 */
export const MIN_BILLING_NOTE = '実際の枚数が見込み枚数を下回った場合も、見込み枚数の半数分は請求対象になります。';

/*
 * プレミアムの申し込み・解約条件。製品側のプレミアム紹介ページが公開している条件と同じ。
 * 出典: docs/リライト版仕様書/user/18_premium_plan_requirements.md:65,68（初月無料バッジ・いつでも解約可能）
 *       docs/リライト版仕様書/user/19_premium_registration_spa.md:157,261（新規は申込日に開始・初月無料・翌月1日課金）
 *       docs/リライト版仕様書/user/20_premium_cancel_requirements.md:25,40（自動更新の停止・契約期間終了日まで利用可）
 */
export const PREMIUM_TERMS = {
  /* 表形式で書くLPもあるので、検査は文全体ではなくこのキー語で行う */
  keys: ['初月無料', 'いつでも解約'],
  note: '新規のお申し込みは初月無料で、翌月1日から課金が始まります。いつでも解約でき、解約後も契約期間の終了日まで利用できます。',
};

/* 対応言語。回答画面の切り替えと、外国語名刺のデータ化の対象言語 */
export const LANGUAGES = {
  list: ['日本語', '英語', '中国語'],
  inline: '日本語・英語・中国語',
  /* 回答画面のUI表記（来場者が実際に目にする文字列） */
  ui: ['日本語', 'English', '中文（簡体）'],
  note: '多言語切り替えと日本語以外の名刺のデータ化はプレミアムプランの機能です。',
};

export const COMPANY = {
  name: '株式会社アブロードアウトソーシング',
  location: '東京都千代田区',
  copyright: '© Abroad Outsourcing Co., Ltd.',
  certifications: ['プライバシーマーク認定事業者', 'ISO/IEC 27001:2013', 'ISO 9001:2015'],
};

/* 各LPで必ず存在してほしい法定リンク（フッター） */
export const LEGAL_LINKS = ['利用規約', '特定商取引法に基づく表記', 'プライバシーポリシー'];
