// guards.js
// グローバル API window.SpeedAD.tutorial を提供（仕様書 §5.4）。
//
// 本番モジュール（main.js / surveyCreation-v2.js 等）から呼ばれる:
//   - isActive()                   : ?tutorial=1 が URL に付いているか
//   - shouldBlock(action)          : チュートリアル中に本番ハンドラを止めるべきか
//   - handleCreateSurveyFromModal  : 「作成する」差し替え（surveyCreation.html?tutorial=1&step=9 へ）
//   - handleAttemptSave            : 「アンケートを作成」差し替え（QR ボタン有効化 → ステップ 18）
//   - isCompleted()                : 完了フラグ
//
// 内部処理（チュートリアル進行の続行）は index.js から注入される _internal フック経由で行う。

import { isCompleted as readCompletedFlag } from './state.js';

const QR_BTN_SELECTOR = '#openQrModalBtn';

let internalHooks = {
  /**
   * ステップ番号を指定して進める（同一ページ内）。
   * @param {number} stepId
   */
  goToStep: null,
  /**
   * ?tutorial=1 を維持して別 URL へ遷移する。
   * @param {string} url
   * @param {number} stepId
   */
  redirectWithTutorial: null,
};

function isActiveNow() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tutorial') === '1';
  } catch (_e) {
    return false;
  }
}

function enableQrButton() {
  const btn = document.querySelector(QR_BTN_SELECTOR);
  if (!btn) return false;
  btn.removeAttribute('disabled');
  btn.removeAttribute('aria-disabled');
  btn.classList.remove('opacity-50');
  btn.classList.remove('cursor-not-allowed');
  return true;
}

const api = {
  isActive() {
    return isActiveNow();
  },

  shouldBlock(action) {
    if (!isActiveNow()) return false;
    return action === 'createSurveyFromModal' || action === 'attemptSave';
  },

  /**
   * 「作成する」ボタンを押したときの差し替え。
   * 本番リダイレクトを行わず、チュートリアル付き URL で作成画面に遷移する。
   * formData は将来の入力引き継ぎ用に受け取るが、本仕様では参照しない（モック）。
   */
  handleCreateSurveyFromModal(_formData) {
    if (!isActiveNow()) return;
    if (typeof internalHooks.redirectWithTutorial === 'function') {
      internalHooks.redirectWithTutorial('surveyCreation.html', 9);
    } else {
      // フォールバック: index.js 未初期化でもURL遷移は成立させる
      const target = `surveyCreation.html?tutorial=1&step=9`;
      window.location.assign(target);
    }
  },

  /**
   * 「アンケートを作成」差し替え。本番ハンドラは showToast のみのためガード差し込みではなく、
   * チュートリアル側で QR ボタン有効化＋ステップ 18 進行を実行する。
   */
  handleAttemptSave() {
    if (!isActiveNow()) return;
    enableQrButton();
    if (typeof internalHooks.goToStep === 'function') {
      internalHooks.goToStep(18);
    }
  },

  isCompleted() {
    return readCompletedFlag();
  },

  /**
   * index.js から内部フック注入。外部からは呼ばない。
   */
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
