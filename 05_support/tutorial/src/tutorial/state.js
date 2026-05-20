// state.js
// チュートリアル進行状態 / 完了フラグの localStorage 読み書き（仕様書 §6）。
//
// 進行状態  : speedad-tutorial-progress  { step: number, updatedAt: ISO8601 }
// 完了フラグ: speedad-tutorial-completed boolean 相当（'1' / null）

const PROGRESS_KEY = 'speedad-tutorial-progress';
const COMPLETED_KEY = 'speedad-tutorial-completed';

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

export function readProgress() {
  const raw = safeGetItem(PROGRESS_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.step !== 'number') return null;
    return data;
  } catch (_e) {
    return null;
  }
}

export function writeProgress(step) {
  const payload = {
    step,
    updatedAt: new Date().toISOString(),
  };
  safeSetItem(PROGRESS_KEY, JSON.stringify(payload));
}

export function clearProgress() {
  safeRemoveItem(PROGRESS_KEY);
}

export function markCompleted() {
  safeSetItem(COMPLETED_KEY, '1');
  clearProgress();
}

export function isCompleted() {
  return safeGetItem(COMPLETED_KEY) === '1';
}

export function resetAll() {
  safeRemoveItem(PROGRESS_KEY);
  safeRemoveItem(COMPLETED_KEY);
}
