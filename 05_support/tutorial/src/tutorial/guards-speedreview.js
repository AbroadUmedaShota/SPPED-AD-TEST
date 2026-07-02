// guards-speedreview.js
// SPEEDレビュー チュートリアル用グローバル API window.SpeedAD.tutorial を提供。
//
// 差し込み方式: index-speedreview.js が capture フェーズで回答詳細モーダルの
// 「保存する」(#saveDetailBtn) の click をインターセプトして本番更新を抑止するため、
// 本 guards ファイルでは isActive / shouldBlock / グローバル API の設置のみ担当する。

import { isCompleted as readCompletedFlag } from './state.js';
import { TUTORIAL_CONFIG } from './steps-speedreview.js';

let internalHooks = {
  goToStep: null,
  advanceStep: null,
};

function isActiveNow() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tutorial') === '1';
  } catch (_e) {
    return false;
  }
}

const api = {
  isActive() {
    return isActiveNow();
  },

  shouldBlock(action) {
    if (!isActiveNow()) return false;
    // tutorial-guard: 回答編集の保存アクションをブロック
    return action === 'saveAnswer';
  },

  isCompleted() {
    return readCompletedFlag(TUTORIAL_CONFIG.completedKey);
  },

  _setInternalHooks(hooks) {
    internalHooks = { ...internalHooks, ...hooks };
  },
};

export function installGlobalApi() {
  if (typeof window === 'undefined') return api;
  window.SpeedAD = window.SpeedAD || {};
  window.SpeedAD.tutorial = api;
  return api;
}

export function getApi() {
  return api;
}

export function enableTargetForTutorial(el) {
  if (!el) return false;
  el.removeAttribute('disabled');
  el.removeAttribute('aria-disabled');
  el.classList.remove('opacity-50');
  el.classList.remove('cursor-not-allowed');
  return true;
}
