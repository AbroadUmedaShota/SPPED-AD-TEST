// guards-bizcard.js
// 名刺データ化設定チュートリアル用グローバル API window.SpeedAD.tutorial を提供。
//
// bizcardSettings.js の saveBizcardSettings ハンドラを §5.4 ガードでインターセプトし、
// 本番保存処理を実行せずに完了ステップへ進行する。
//
// 差し込み方式: index-bizcard.js が capture フェーズで #saveBizcardSettingsBtn の click を
// インターセプトするため、本 guards ファイルでは isActive / shouldBlock / グローバル API の
// 設置のみ担当する。

import { isCompleted as readCompletedFlag } from './state.js';
import { TUTORIAL_CONFIG } from './steps-bizcard.js';

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
    // tutorial-guard: 保存アクションをブロック
    return action === 'saveBizcardSettings';
  },

  /**
   * 「設定を保存して依頼を確定」差し替え。
   * 本番保存処理を実行せず、保存ステップ（user-action-bridge）から次の完了ステップへ進行する。
   * ステップ番号のハードコードを避け、現在ステップから相対的に前進させる。
   */
  handleSaveBizcardSettings() {
    if (!isActiveNow()) return;
    if (typeof internalHooks.advanceStep === 'function') {
      internalHooks.advanceStep();
    } else if (typeof internalHooks.goToStep === 'function') {
      internalHooks.goToStep(18);
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
