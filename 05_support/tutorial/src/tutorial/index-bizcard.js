// index-bizcard.js
// 名刺データ化設定チュートリアルの起動制御。
//
// - ?tutorial=1 検出 / 共通 HTML 注入の await / 各モジュール初期化
// - グローバル API window.SpeedAD.tutorial 設置（guards-bizcard.js 経由）
// - #saveBizcardSettingsBtn のクリックを capture フェーズでインターセプトし、
//   本番保存処理を実行せずにチュートリアル進行へ切り替える

import { TUTORIAL_STEPS, TOTAL_STEPS, getStepById, TUTORIAL_CONFIG } from './steps-bizcard.js';
import {
  initOverlay,
  destroyOverlay,
  setCallbacks,
  renderStep,
  setInputsReadonly,
  clearReadonlyTracking,
  showSkipConfirm,
  hideSkipConfirm,
  repositionAll,
  showStuckHint,
  hideStuckHint,
} from './overlay.js';
import {
  readProgress,
  writeProgress,
  clearProgress,
  markCompleted,
  clearReturn,
} from './state.js';
import { installGlobalApi, enableTargetForTutorial } from './guards-bizcard.js';
import { waitForCommonHtml, waitForSelector } from './tutorial-core.js';

const COMMON_HTML_TARGETS = [
  { placeholderId: 'header-placeholder', filePath: 'common/header.html' },
  { placeholderId: 'sidebar-placeholder', filePath: 'common/sidebar.html' },
  { placeholderId: 'footer-placeholder', filePath: 'common/footer.html' },
];

let currentStepIndex = 0;
let bootstrapped = false;
let activeUserActionCleanup = null;
let stuckHintTimerId = null;
let escapeTargetEl = null;

// ---------- 起動 ----------

document.addEventListener('DOMContentLoaded', async () => {
  const api = installGlobalApi();
  api._setInternalHooks({
    goToStep: (stepId) => goToStep(stepId),
    advanceStep: () => advanceStep(),
  });

  if (!api.isActive()) return;

  // #saveBizcardSettingsBtn を capture フェーズでインターセプトして本番保存を抑止
  document.addEventListener('click', (ev) => {
    if (!api.isActive()) return;
    const btn = ev.target.closest('#saveBizcardSettingsBtn');
    if (!btn) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    api.handleSaveBizcardSettings();
  }, true /* capture */);

  await waitForCommonHtml(COMMON_HTML_TARGETS);

  initOverlay({ total: TOTAL_STEPS });
  setCallbacks({
    onNext: handleNext,
    onPrev: handlePrev,
    onSkipConfirm: handleSkipConfirm,
    onSkipCancel: handleSkipCancel,
    onComplete: handleComplete,
  });

  const startStep = resolveStartStep();
  bootstrapped = true;

  goToStep(startStep);
});

// ---------- 開始ステップ解決 ----------

function resolveStartStep() {
  const params = new URLSearchParams(window.location.search);
  const urlStep = parseInt(params.get('step') || '', 10);
  const progress = readProgress(TUTORIAL_CONFIG.progressKey);
  if (!Number.isNaN(urlStep) && urlStep >= 1 && urlStep <= TOTAL_STEPS) {
    return urlStep;
  }
  if (progress && progress.step >= 1 && progress.step <= TOTAL_STEPS) {
    return progress.step;
  }
  return 1;
}

// ---------- ステップ遷移 ----------

function goToStep(stepId) {
  if (!bootstrapped) return;
  const step = getStepById(stepId);
  if (!step) return;

  cleanupActiveStep();

  currentStepIndex = TUTORIAL_STEPS.findIndex((s) => s.id === stepId);
  writeProgress(stepId, TUTORIAL_CONFIG.progressKey);

  resolveTargetAndRender(step);
}

function resolveTargetAndRender(step) {
  let contextEl = null;
  if (step.contextTarget) {
    try {
      contextEl = document.querySelector(step.contextTarget);
    } catch (_e) {
      contextEl = null;
    }
  }

  const finalize = (targetEl) => {
    const isUserAction = step.mode === 'user-action' || step.mode === 'user-action-bridge';
    if (targetEl && isUserAction) {
      if (targetEl.disabled === true || targetEl.getAttribute('aria-disabled') === 'true') {
        enableTargetForTutorial(targetEl);
      }
    }
    renderStep(step, targetEl, contextEl);
    if (!targetEl && isUserAction && !step.completeButtonLabel) {
      showStuckHint('この操作はスキップできます。『次へ』で先に進めます');
      return;
    }
    applyStepBehavior(step, targetEl);
  };

  if (!step.target) {
    finalize(null);
    return;
  }

  let el = document.querySelector(step.target);
  if (el) {
    finalize(el);
    return;
  }

  if (step.waitForElement !== false) {
    waitForSelector(step.target, 4000).then((found) => finalize(found));
  } else {
    finalize(null);
  }
}

// ---------- ステップ別ふるまい ----------

function applyStepBehavior(step, targetEl) {
  if (step.mode === 'autofill' && step.autoInput) {
    runAutoInput(step, targetEl);
  } else {
    clearReadonlyTracking();
  }

  if (step.mode === 'user-action' || step.mode === 'user-action-bridge') {
    bindUserActionListener(step, targetEl);
  }
}

function runAutoInput(step, targetEl) {
  const ai = step.autoInput;
  if (!ai) return;

  if (ai.kind === 'text' && targetEl) {
    setInputValue(targetEl, ai.value);
    setInputsReadonly([targetEl]);
  }
}

function setInputValue(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function bindUserActionListener(step, targetEl) {
  if (!targetEl) return;

  escapeTargetEl = targetEl;

  if (stuckHintTimerId) {
    window.clearTimeout(stuckHintTimerId);
    stuckHintTimerId = null;
  }
  stuckHintTimerId = window.setTimeout(() => {
    showStuckHint('うまく押せない場合は『次へ』で続けられます');
    stuckHintTimerId = null;
  }, 8000);

  const handler = () => {
    if (stuckHintTimerId) {
      window.clearTimeout(stuckHintTimerId);
      stuckHintTimerId = null;
    }
    escapeTargetEl = null;
    if (step.mode === 'user-action') {
      advanceStep();
    }
  };
  targetEl.addEventListener('click', handler, { once: true });
  activeUserActionCleanup = () => targetEl.removeEventListener('click', handler);
}

function cleanupActiveStep() {
  if (typeof activeUserActionCleanup === 'function') {
    activeUserActionCleanup();
    activeUserActionCleanup = null;
  }
  if (stuckHintTimerId) {
    window.clearTimeout(stuckHintTimerId);
    stuckHintTimerId = null;
  }
  escapeTargetEl = null;
  hideStuckHint();
  clearReadonlyTracking();
}

// ---------- 進行コールバック ----------

function handleNext() {
  if (escapeTargetEl) {
    const el = escapeTargetEl;
    escapeTargetEl = null;
    if (document.body.contains(el)) {
      try {
        el.click();
        return;
      } catch (_e) {
        /* fall through */
      }
    }
  }
  advanceStep();
}

function handlePrev() {
  const prev = TUTORIAL_STEPS[currentStepIndex - 1];
  if (!prev) return;
  goToStep(prev.id);
}

function handleSkipConfirm(stage) {
  if (stage === 'confirmed') {
    hideSkipConfirm();
    // スキップ(終了)は復帰せずハブへ退出する。return を消すことで onComplete がハブへ向かう。
    clearReturn();
    finishAndExit({ markComplete: true });
  } else {
    showSkipConfirm();
  }
}

function handleSkipCancel() {
  hideSkipConfirm();
}

function handleComplete() {
  finishAndExit({ markComplete: true });
}

function advanceStep() {
  const next = TUTORIAL_STEPS[currentStepIndex + 1];
  if (!next) {
    finishAndExit({ markComplete: true });
    return;
  }
  goToStep(next.id);
}

function finishAndExit({ markComplete }) {
  if (markComplete) {
    markCompleted(TUTORIAL_CONFIG.progressKey, TUTORIAL_CONFIG.completedKey);
  } else {
    clearProgress(TUTORIAL_CONFIG.progressKey);
  }
  destroyOverlay();
  TUTORIAL_CONFIG.onComplete();
}
