/*
 * lp/ 配下の全LPが pricing-data.js の正本値に追従しているか検査する。
 *
 *   node lp/check-pricing.mjs
 *
 * 判定は3段階。
 *   NG   … 正本と食い違う／使ってはいけない旧表記が残っている（終了コード1）
 *   warn … 揃えた方がよいが、LPの訴求軸によっては無くてよいもの（落とさない）
 *   skip … そのLPが扱っていない項目
 *
 * 速度プラン表は「単価を4つ以上そのまま載せているLP」だけを対象にする。
 * 注記内の省略形（「特急100円」など）しか持たないLPを誤検出しないため。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEED_PLANS, BASE_PLANS, THANKS_MAIL, SETTLEMENT_NOTE, MIN_BILLING_NOTE, PREMIUM_TERMS, LANGUAGES, COMPANY, LEGAL_LINKS } from './pricing-data.js';

const LP_DIR = dirname(fileURLToPath(import.meta.url));

/* 使ってはいけない旧表記 */
const FORBIDDEN = [
  ['実数精算', '「実費精算」に統一済み'],
  ['実際の件数', '名刺は枚数で数える（「実際の枚数」に統一済み）'],
  ['中国語などの', '対応言語は日英中の3言語。「など」は範囲を広く見せる'],
  ['日英表記', '対応言語は日本語・英語・中国語'],
  ['© 2025', 'コピーライトは年号なしで統一'],
  ['&copy; 2025', 'コピーライトは年号なしで統一'],
  /* 最低請求条件（見込み枚数の半数分）と食い違う言い方 */
  ['使った分だけ', '見込み枚数の半数分は下回っても請求対象。「使った分だけ」は成り立たない'],
  ['使わなかった分', '同上。未使用分が必ず消えるわけではない'],
  ['無駄が出ません', '同上。最低請求条件があるため断言できない'],
  /* 解約条件（自動更新の停止）と食い違う言い方 */
  ['即時解約', '解約は自動更新の停止。契約期間の終了日までは利用できる'],
  ['日割り', '日割り精算の規定は仕様書に無い'],
];

/* 生HTML／バンドル文字列の揺れを吸収してから突き合わせる */
function normalize(raw) {
  return raw
    .replace(/&copy;/gi, '©')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\\u002F/gi, '/');
}

function lpPages() {
  return readdirSync(LP_DIR)
    .filter(name => {
      const p = join(LP_DIR, name);
      return statSync(p).isDirectory() && readdirSync(p).includes('index.html');
    })
    .map(name => ({ key: name, file: join(LP_DIR, name, 'index.html') }));
}

function checksFor(text) {
  const has = s => text.includes(s);
  const out = [];
  const push = (item, status, detail) => out.push({ item, status, detail: detail || '' });

  /* --- 速度プラン表 --- */
  const unitHits = SPEED_PLANS.filter(p => has(p.unit)).length;
  const hasSpeedTable = unitHits >= 4;
  for (const p of SPEED_PLANS) {
    if (!hasSpeedTable) { push(`速度プラン ${p.name}`, 'skip'); continue; }
    const missing = [['単価', p.unit], ['項目数', p.items], ['納期', p.lead]]
      .filter(([, v]) => !has(v)).map(([k]) => k);
    push(`速度プラン ${p.name}`, missing.length ? 'NG' : 'ok', missing.join('/') + ' が無い');
  }
  if (hasSpeedTable) {
    const od = SPEED_PLANS.find(p => p.note);
    push('オンデマンドのプレミアム限定表示', has(od.note) ? 'ok' : 'warn', `「${od.note}」の明示が無い`);
  }

  /* --- 基本プラン --- */
  push('プレミアム月額', has(BASE_PLANS.premium.monthly) ? 'ok' : 'skip');

  /* --- お礼メール --- */
  if (has(THANKS_MAIL.label)) {
    push('お礼メール注記', has(THANKS_MAIL.note) ? 'ok' : 'NG', '注記文が正本と不一致');
  } else {
    push('お礼メール料金', 'skip');
  }

  /* --- 精算の言い回し --- */
  if (/精算/.test(text)) {
    push('精算の言い回し', has('実費精算') ? 'ok' : 'NG', '「実費精算」でない');
    /* 実費精算だけを載せると最低請求条件が伝わらない */
    push('最低請求の注記', has(MIN_BILLING_NOTE) ? 'ok' : 'NG', '見込み枚数の半数分が請求対象になる旨が無い');
  } else {
    push('精算の言い回し', 'skip');
    push('最低請求の注記', 'skip');
  }

  /* --- プレミアムの申込・解約条件 --- */
  if (has(BASE_PLANS.premium.monthly)) {
    const [trialKey, cancelKey] = PREMIUM_TERMS.keys;
    push('初月無料の明示', has(trialKey) ? 'ok' : 'warn', '月額を載せているが初月無料に触れていない');
    push('解約条件の明示', has(cancelKey) ? 'ok' : 'warn', '月額を載せているが解約条件に触れていない');
  } else {
    push('初月無料の明示', 'skip');
    push('解約条件の明示', 'skip');
  }

  /* --- 対応言語 --- */
  const mlHits = (text.match(/多言語/g) || []).length;
  if (mlHits === 0) {
    push('対応言語の明示', 'skip');
  } else if (has(LANGUAGES.inline)) {
    push('対応言語の明示', 'ok');
  } else {
    /* 多言語が主題のLPは必須、触れているだけのLPは推奨どまり */
    push('対応言語の明示', mlHits >= 3 ? 'NG' : 'warn', `本文に「${LANGUAGES.inline}」が無い`);
  }

  /* --- 会社・法務 --- */
  push('コピーライト', has(COMPANY.copyright) ? 'ok' : 'NG', '正本と不一致');
  const missingLegal = LEGAL_LINKS.filter(l => !has(l));
  push('法定リンク', missingLegal.length ? 'NG' : 'ok', missingLegal.join('/') + ' が無い');

  /* --- 旧表記 --- */
  for (const [word, why] of FORBIDDEN) {
    if (has(word)) push(`旧表記「${word}」が残存`, 'NG', why);
  }
  return out;
}

let ngTotal = 0, warnTotal = 0;
for (const { key, file } of lpPages()) {
  const results = checksFor(normalize(readFileSync(file, 'utf8')));
  const ng = results.filter(r => r.status === 'NG');
  const warn = results.filter(r => r.status === 'warn');
  const ok = results.filter(r => r.status === 'ok').length;
  const skip = results.filter(r => r.status === 'skip').length;
  console.log(`\n[${key}]  ok=${ok}  skip=${skip}  warn=${warn.length}  NG=${ng.length}`);
  for (const r of ng) console.log(`   NG    ${r.item}  — ${r.detail}`);
  for (const r of warn) console.log(`   warn  ${r.item}  — ${r.detail}`);
  ngTotal += ng.length;
  warnTotal += warn.length;
}

console.log(
  ngTotal
    ? `\n追従漏れ ${ngTotal} 件（warn ${warnTotal} 件）。pricing-data.js に合わせてください。`
    : `\n全LPが正本に追従しています（warn ${warnTotal} 件）。`
);
process.exit(ngTotal ? 1 : 0);
