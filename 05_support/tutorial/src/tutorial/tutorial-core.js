// tutorial-core.js
// 名刺データ化・お礼メール等の新規チュートリアルエントリポイントで共有する共通ユーティリティ。
//
// 3 関数のみ提供する:
//   waitForCommonHtml(commonHtmlTargets)  - 共通 HTML 注入の完了を待機
//   waitForSelector(selector, timeoutMs) - 指定セレクタの出現を待機
//   waitUntil(predicate, timeoutMs)      - 任意の述語が真になるまで待機
//
// 既存の index.js はこのモジュールを import しない（凍結方針による）。
// index-bizcard.js / index-thankyou.js からのみ利用する。

import { loadCommonHtml } from '../utils.js';

/**
 * 共通 HTML（ヘッダー / サイドバー / フッター）の非同期注入完了を待機する。
 * main.js が先にロードしている場合は既存コンテンツをそのまま使い、空なら loadCommonHtml を呼ぶ。
 *
 * @param {Array<{placeholderId: string, filePath: string}>} commonHtmlTargets
 * @returns {Promise<void>}
 */
export async function waitForCommonHtml(commonHtmlTargets) {
  const tasks = commonHtmlTargets.map(async ({ placeholderId, filePath }) => {
    const el = document.getElementById(placeholderId);
    if (!el) return;
    if (el.children.length > 0) return; // main.js が先に注入済み
    try {
      await loadCommonHtml(placeholderId, filePath);
    } catch (_e) {
      /* noop: 共通 HTML が無いページでも続行 */
    }
  });
  await Promise.all(tasks);

  // main.js 側のロードが先に走っているが完了を待ちたい時、簡易ポーリングで補強
  await waitUntil(() => {
    return commonHtmlTargets.every(({ placeholderId }) => {
      const el = document.getElementById(placeholderId);
      return !el || el.children.length > 0;
    });
  }, 1500);
}

/**
 * 指定セレクタを持つ要素が DOM に出現するまで待機する。
 * タイムアウト時は null を解決する。
 *
 * @param {string} selector
 * @param {number} timeoutMs
 * @returns {Promise<Element|null>}
 */
export function waitForSelector(selector, timeoutMs) {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) {
      resolve(found);
      return;
    }
    const start = Date.now();
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        observer.disconnect();
        resolve(null);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs + 100);
  });
}

/**
 * 述語関数が true を返すか、タイムアウトするまで 50ms 間隔でポーリングする。
 *
 * @param {() => boolean} predicate
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export function waitUntil(predicate, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (predicate() || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}
