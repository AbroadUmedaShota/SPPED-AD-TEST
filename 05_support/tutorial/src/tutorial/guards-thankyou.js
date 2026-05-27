// guards-thankyou.js
// お礼メール設定チュートリアル用グローバル API window.SpeedAD.tutorial を提供。
//
// after_event_ready 状態強制:
//   DOMContentLoaded 後の setTimeout(fn, 0) で scenarioSelector.value = 'after_event_ready' を
//   設定し change イベントを dispatch する。これにより受信者リストが表示された状態で
//   チュートリアルが起動する。
//
// ガード対象:
//   - saveThankYouEmailSettings: 「設定を保存する」本番処理をインターセプト
//   - sendThankYouEmail: 「お礼メールを送信する」本番処理をインターセプト（二重防御）

import { isCompleted as readCompletedFlag } from './state.js';
import { TUTORIAL_CONFIG } from './steps-thankyou.js';

let internalHooks = {
  goToStep: null,
};

function isActiveNow() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tutorial') === '1';
  } catch (_e) {
    return false;
  }
}

// after_event_ready 強制: DOMContentLoaded 後に setTimeout(0) で実行
document.addEventListener('DOMContentLoaded', () => {
  if (!isActiveNow()) return;
  window.setTimeout(() => {
    const selector = document.getElementById('scenarioSelector');
    if (!selector) return;
    selector.value = 'after_event_ready';
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  }, 0);
});

const api = {
  isActive() {
    return isActiveNow();
  },

  shouldBlock(action) {
    if (!isActiveNow()) return false;
    // tutorial-guard: 保存・送信アクションをブロック
    return action === 'saveThankYouEmailSettings' || action === 'sendThankYouEmail';
  },

  /**
   * 「設定を保存する」差し替え。
   * 本番保存処理を実行せずに完了ステップ（20）へ進行する。
   */
  handleSaveThankYouEmailSettings() {
    if (!isActiveNow()) return;
    if (typeof internalHooks.goToStep === 'function') {
      internalHooks.goToStep(20);
    }
  },

  /**
   * 「お礼メールを送信する」差し替え（二重防御）。
   * チュートリアル中は送信処理を実行しない。
   */
  handleSendThankYouEmail() {
    // tutorial-guard: チュートリアル中は何もしない
    if (!isActiveNow()) return;
    // noop: 送信処理をインターセプトして何も実行しない
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
