// state.js
// チュートリアル進行状態 / 完了フラグの localStorage 読み書き（仕様書 §6）。
//
// 進行状態  : speedad-tutorial-progress  { step: number, updatedAt: ISO8601 }
// 完了フラグ: speedad-tutorial-completed boolean 相当（'1' / null）
//
// 引数化により名刺データ化・お礼メール等の別チュートリアルでも同じ関数を使い回せる。
// デフォルト引数でアンケート作成チュートリアル用キーが補われるため、既存呼び出しはそのまま動く。

const DEFAULT_PROGRESS_KEY = 'speedad-tutorial-progress';
const DEFAULT_COMPLETED_KEY = 'speedad-tutorial-completed';
const RETURN_KEY = 'speedad-tutorial-return';

function safeGetItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_e) {
    /* noop */
  }
}

function safeRemoveItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_e) {
    /* noop */
  }
}

export function readProgress(progressKey = DEFAULT_PROGRESS_KEY) {
  const raw = safeGetItem(progressKey);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.step !== 'number') return null;
    return data;
  } catch (_e) {
    return null;
  }
}

export function writeProgress(step, progressKey = DEFAULT_PROGRESS_KEY) {
  const payload = {
    step,
    updatedAt: new Date().toISOString(),
  };
  safeSetItem(progressKey, JSON.stringify(payload));
}

export function clearProgress(progressKey = DEFAULT_PROGRESS_KEY) {
  safeRemoveItem(progressKey);
}

export function markCompleted(
  progressKey = DEFAULT_PROGRESS_KEY,
  completedKey = DEFAULT_COMPLETED_KEY
) {
  safeSetItem(completedKey, '1');
  clearProgress(progressKey);
}

export function isCompleted(completedKey = DEFAULT_COMPLETED_KEY) {
  return safeGetItem(completedKey) === '1';
}

// 復帰コンテキスト: サブチュートリアル完了後にどのURLのどのステップへ戻るかを保存する。
// { url: string, step: number } の形式で保存。

export function writeReturn(ctx) {
  safeSetItem(RETURN_KEY, JSON.stringify(ctx));
}

export function readReturn() {
  const d = safeGetItem(RETURN_KEY);
  if (!d) return null;
  try {
    const parsed = JSON.parse(d);
    if (parsed && typeof parsed.step === 'number' && typeof parsed.url === 'string') {
      return parsed;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

export function clearReturn() {
  safeRemoveItem(RETURN_KEY);
}

export function resetAll() {
  // アンケート作成チュートリアル
  safeRemoveItem(DEFAULT_PROGRESS_KEY);
  safeRemoveItem(DEFAULT_COMPLETED_KEY);
  // 名刺データ化チュートリアル
  safeRemoveItem('speedad-tutorial-bizcard-progress');
  safeRemoveItem('speedad-tutorial-bizcard-completed');
  // お礼メールチュートリアル
  safeRemoveItem('speedad-tutorial-thankyou-progress');
  safeRemoveItem('speedad-tutorial-thankyou-completed');
  // SPEEDレビューチュートリアル
  safeRemoveItem('speedad-tutorial-speedreview-progress');
  safeRemoveItem('speedad-tutorial-speedreview-completed');
  // 旧バージョンで保存されたエントリ種別キーの掃除（現在は未使用）
  safeRemoveItem('speedad-tutorial-entry');
  // 復帰コンテキスト
  safeRemoveItem(RETURN_KEY);
}
