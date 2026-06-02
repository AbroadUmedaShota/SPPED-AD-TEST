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

// after_event_ready 強制: DOMContentLoaded 後に setTimeout(0) で実行
document.addEventListener('DOMContentLoaded', () => {
  if (!isActiveNow()) return;
  // 本体の非同期初期化がシナリオ値を既定（会期前）へ戻すため、setTimeout(0) 1回の dispatch では
  // 取りこぼされる。受信者リストが表示されるまでシナリオ適用をリトライする。
  let attempts = 0;
  const applyReady = () => {
    attempts += 1;

    // 差し込み変数パネルを開いた状態にする（ステップが閉じた状態に当たらないように）。
    const varWrapper = document.getElementById('variableContainerWrapper');
    if (varWrapper) varWrapper.classList.remove('hidden');
    const varIcon = document.getElementById('variablesToggleIcon');
    if (varIcon) varIcon.style.transform = 'rotate(180deg)';

    const selector = document.getElementById('scenarioSelector');
    const wrapper = document.getElementById('recipientTableWrapper');
    const ready = wrapper && !wrapper.classList.contains('hidden');

    if (selector && !ready) {
      // dispatch を妨げないよう、表示できるまでは無効化しない
      selector.disabled = false;
      selector.value = 'after_event_ready';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (ready) {
      // 表示できたらシナリオセレクタを無効化（誤操作防止）
      if (selector) {
        selector.disabled = true;
        selector.setAttribute('aria-disabled', 'true');
        selector.title = 'チュートリアル中はシナリオを変更できません';
      }
      return;
    }

    if (attempts < 20) {
      window.setTimeout(applyReady, 200);
    } else if (selector) {
      selector.disabled = true;
      selector.setAttribute('aria-disabled', 'true');
    }
  };
  window.setTimeout(applyReady, 0);
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
   * 本番保存処理を実行せず、保存ステップ（user-action-bridge）から次の完了ステップへ進行する。
   * ステップ番号のハードコードを避け、現在ステップから相対的に前進させる。
   */
  handleSaveThankYouEmailSettings() {
    if (!isActiveNow()) return;
    if (typeof internalHooks.advanceStep === 'function') {
      internalHooks.advanceStep();
    } else if (typeof internalHooks.goToStep === 'function') {
      internalHooks.goToStep(14);
    }
  },

  /**
   * 送信確認ダイアログの「送信を実行」差し替え。
   * 本番送信を実行せず、現在の送信実行ステップから次の完了ステップへ進行する。
   */
  handleSendThankYouEmail() {
    if (!isActiveNow()) return;
    if (typeof internalHooks.advanceStep === 'function') {
      internalHooks.advanceStep();
    } else if (typeof internalHooks.goToStep === 'function') {
      internalHooks.goToStep(15);
    }
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
