// index.js
// チュートリアル起動制御。
//   - ?tutorial=1 検出 / 共通HTML注入の await / 各モジュール初期化
//   - グローバル API window.SpeedAD.tutorial 設置
//   - 初回ログイン強制リダイレクト判定（モック段階では完了フラグ未設定なら起動を許容）

import { TUTORIAL_STEPS, TOTAL_STEPS, getStepById } from './steps.js';
import {
  initOverlay,
  destroyOverlay,
  setCallbacks,
  renderStep,
  pulseAttention,
  setInputsReadonly,
  clearReadonlyTracking,
  showSkipConfirm,
  hideSkipConfirm,
  showWelcome,
  hideWelcome,
  repositionAll,
  showStuckHint,
  hideStuckHint,
} from './overlay.js';
import {
  readProgress,
  writeProgress,
  clearProgress,
  markCompleted,
  isCompleted,
} from './state.js';
import { installGlobalApi } from './guards.js';
import { loadCommonHtml } from '../utils.js';

const COMMON_HTML_TARGETS = [
  { placeholderId: 'header-placeholder', filePath: 'common/header.html' },
  { placeholderId: 'sidebar-placeholder', filePath: 'common/sidebar.html' },
  { placeholderId: 'footer-placeholder', filePath: 'common/footer.html' },
];

let currentStepIndex = 0; // 0-based
let bootstrapped = false;
let lastInsertedQuestionEl = null;
let questionObserver = null;
let activeUserActionCleanup = null;
let stuckHintTimerId = null; // G4: 6 秒後にヒント表示用

// ---------- 起動 ----------

document.addEventListener('DOMContentLoaded', async () => {
  // グローバル API は ?tutorial=1 でなくても置く（本番ハンドラからの呼び出し可能性のため）
  const api = installGlobalApi();
  api._setInternalHooks({
    goToStep: (stepId) => goToStep(stepId),
    redirectWithTutorial: (url, stepId) => redirectWithTutorial(url, stepId),
  });

  if (!api.isActive()) {
    // 強制リダイレクト判定（モック段階）。
    // 完了フラグ未設定 かつ ダッシュボードトップにいる場合のみ?tutorial=1を付ける挙動は
    // 親モジュール（login 等）が担当する想定。
    // ここでは何もしない。
    return;
  }

  await waitForCommonHtml();

  initOverlay({ total: TOTAL_STEPS });
  setCallbacks({
    onNext: handleNext,
    onPrev: handlePrev,
    onSkipConfirm: handleSkipConfirm,
    onSkipCancel: handleSkipCancel,
    onComplete: handleComplete,
  });

  installInterceptors();
  installNewQuestionObserver();

  const startStep = resolveStartStep();
  bootstrapped = true;

  // 初回ログイン直後（進行状態なし & 開始ステップ=1）はようこそ画面を挟む。
  // 中断再開・URL での step 指定時はスキップして直接該当ステップへ。
  const progress = readProgress();
  const isFreshStart = !progress && startStep === 1;
  if (isFreshStart) {
    showWelcome({
      onStart: () => goToStep(1),
      onSkip: () => showSkipConfirm(),
    });
  } else {
    goToStep(startStep);
  }
});

// ---------- 共通HTML await ----------

async function waitForCommonHtml() {
  // 既に main.js が並行 load している可能性があるが、loadCommonHtml は idempotent ではない。
  // 既存プレースホルダの中身が空ならロードし、入っていればそのまま使う。
  const tasks = COMMON_HTML_TARGETS.map(async ({ placeholderId, filePath }) => {
    const el = document.getElementById(placeholderId);
    if (!el) return;
    if (el.children.length > 0) return; // main.js が先に注入済み
    try {
      await loadCommonHtml(placeholderId, filePath);
    } catch (_e) {
      /* noop: 共通HTMLが無いページでも続行 */
    }
  });
  await Promise.all(tasks);

  // main.js 側のロードが先に走っているが完了を待ちたい時、簡易ポーリングで補強
  await waitUntil(() => {
    return COMMON_HTML_TARGETS.every(({ placeholderId }) => {
      const el = document.getElementById(placeholderId);
      return !el || el.children.length > 0;
    });
  }, 1500);
}

function waitUntil(predicate, timeoutMs) {
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

// ---------- 開始ステップ解決 ----------

function resolveStartStep() {
  const params = new URLSearchParams(window.location.search);
  const urlStep = parseInt(params.get('step') || '', 10);
  const progress = readProgress();
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
  if (!bootstrapped) {
    // bootstrap 完了前の goToStep 呼び出し（guards 経由）。次の DOMContentLoaded 復帰で URL の step を参照する。
    return;
  }
  const step = getStepById(stepId);
  if (!step) return;

  cleanupActiveStep();

  currentStepIndex = TUTORIAL_STEPS.findIndex((s) => s.id === stepId);
  writeProgress(stepId);

  resolveTargetAndRender(step);
}

function resolveTargetAndRender(step) {
  // ターゲットが waitForElement 指定なら出現を待つ
  const finalize = (targetEl) => {
    renderStep(step, targetEl);
    applyStepBehavior(step, targetEl);
  };

  // 動的解決
  if (step.targetResolver === 'lastInsertedQuestion') {
    if (lastInsertedQuestionEl) {
      finalize(lastInsertedQuestionEl);
    } else {
      // 直前ステップで挿入されたはずだが取得できなかった場合のフォールバック
      const items = document.querySelectorAll('.question-item');
      finalize(items.length > 0 ? items[items.length - 1] : null);
    }
    return;
  }

  if (!step.target) {
    finalize(null);
    return;
  }

  let el = document.querySelector(step.target);
  if (el) {
    finalize(el);
    return;
  }

  // G1: 対象要素の到達性 — `target` を持つステップは原則すべて 4 秒待機する。
  // `waitForElement: false` が明示されたときのみ即時失敗にフォールバック。
  if (step.waitForElement !== false) {
    waitForSelector(step.target, 4000).then((found) => finalize(found));
  } else {
    finalize(null);
  }
}

function waitForSelector(selector, timeoutMs) {
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

// ---------- ステップ別ふるまい ----------

function applyStepBehavior(step, targetEl) {
  // 自動入力
  if (step.mode === 'autofill' && step.autoInput) {
    runAutoInput(step, targetEl);
  } else {
    clearReadonlyTracking();
  }

  // ユーザー操作系のリスナー
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
    return;
  }

  if (ai.kind === 'flatpickr-range' && targetEl) {
    const [start, end] = ai.getRange();
    // wrap:true で初期化された flatpickr は親 wrapper に _flatpickr が紐付くため、
    // 対象 input から祖先方向に _flatpickr を探索する
    let fp = targetEl._flatpickr;
    if (!fp) {
      let node = targetEl.parentElement;
      while (node && !fp) {
        if (node._flatpickr) { fp = node._flatpickr; break; }
        node = node.parentElement;
      }
    }
    if (fp && typeof fp.setDate === 'function') {
      fp.setDate([start, end], true);
    } else {
      // flatpickr 未初期化のフォールバック
      const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      setInputValue(targetEl, `${fmt(start)} 〜 ${fmt(end)}`);
    }
    setInputsReadonly([targetEl]);
    return;
  }

  if (ai.kind === 'question-single' && targetEl) {
    const inputs = fillQuestionTextAndOptions(targetEl, ai.questionText, ai.options);
    setInputsReadonly(inputs);
    return;
  }

  if (ai.kind === 'question-rating' && targetEl) {
    const inputs = fillRatingQuestion(targetEl, ai);
    setInputsReadonly(inputs);
    return;
  }
}

function setInputValue(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * 多言語入力構造（仕様書 §4.3 冒頭）に従い、設問文と選択肢を埋める。
 * @returns {HTMLInputElement[]} readonly 化対象
 */
function fillQuestionTextAndOptions(questionItemEl, questionText, options) {
  const filled = [];
  // 設問文: .multi-lang-input-group[data-field-key="questionText"] .question-text-input
  const qGroup = questionItemEl.querySelector('.multi-lang-input-group[data-field-key="questionText"]');
  const qInputs = qGroup ? qGroup.querySelectorAll('.question-text-input') : [];
  qInputs.forEach((inp) => {
    setInputValue(inp, questionText);
    filled.push(inp);
  });

  // 選択肢: .options-container 配下 .multi-lang-input-group 内 input
  const optsContainer = questionItemEl.querySelector('.options-container');
  if (optsContainer && Array.isArray(options)) {
    const groups = optsContainer.querySelectorAll('.multi-lang-input-group');
    options.forEach((val, idx) => {
      const group = groups[idx];
      if (!group) return;
      const inputs = group.querySelectorAll('input');
      inputs.forEach((inp) => {
        setInputValue(inp, val);
        filled.push(inp);
      });
    });
  }
  return filled;
}

function fillRatingQuestion(questionItemEl, ai) {
  const filled = [];
  // 設問文
  const qGroup = questionItemEl.querySelector('.multi-lang-input-group[data-field-key="questionText"]');
  const qInputs = qGroup ? qGroup.querySelectorAll('.question-text-input') : [];
  qInputs.forEach((inp) => {
    setInputValue(inp, ai.questionText);
    filled.push(inp);
  });
  // ポイント数（select or input いずれにも対応）
  const pointsField = questionItemEl.querySelector('[data-field-key="ratingPoints"], select[name*="points"], input[name*="points"]');
  if (pointsField) {
    setInputValue(pointsField, String(ai.points));
    filled.push(pointsField);
  }
  // 最小ラベル / 最大ラベル
  const minGroup = questionItemEl.querySelector('.multi-lang-input-group[data-field-key="minLabel"]');
  const maxGroup = questionItemEl.querySelector('.multi-lang-input-group[data-field-key="maxLabel"]');
  if (minGroup) {
    minGroup.querySelectorAll('input').forEach((inp) => {
      setInputValue(inp, ai.minLabel);
      filled.push(inp);
    });
  }
  if (maxGroup) {
    maxGroup.querySelectorAll('input').forEach((inp) => {
      setInputValue(inp, ai.maxLabel);
      filled.push(inp);
    });
  }
  return filled;
}

function bindUserActionListener(step, targetEl) {
  if (!targetEl) {
    return;
  }
  // G4: クリック検出の救済 — 6 秒間クリックが無ければ吹き出しフッターにヒントを表示。
  if (stuckHintTimerId) {
    window.clearTimeout(stuckHintTimerId);
    stuckHintTimerId = null;
  }
  stuckHintTimerId = window.setTimeout(() => {
    showStuckHint('ボタンが反応しないときは『スキップ』で進めます');
    stuckHintTimerId = null;
  }, 6000);

  const handler = (ev) => {
    // クリックが入ったらヒントタイマーは破棄
    if (stuckHintTimerId) {
      window.clearTimeout(stuckHintTimerId);
      stuckHintTimerId = null;
    }
    // user-action-bridge は本番ハンドラが guards 経由で進行を引き継ぐ
    // user-action はそのまま次ステップへ
    if (step.mode === 'user-action') {
      // 対象クリックは本来の動作（モーダルを開く、メニューを開く等）をそのまま走らせ、
      // ステップ前進はマイクロタスク後に行う
      window.setTimeout(() => {
        captureLastInsertedQuestionIfNeeded(step);
        advanceStep();
      }, 50);
    }
  };
  targetEl.addEventListener('click', handler, { once: true });
  activeUserActionCleanup = () => targetEl.removeEventListener('click', handler);

  // 対象外クリック（マスク）のパルスは overlay 側で処理されるが、
  // 念のためグローバルキーボードに対しても同様の誘導を行う
  const keyHandler = (ev) => {
    if (ev.key === 'Tab') {
      // フォーカスは coachmark に閉じる
    }
  };
  document.addEventListener('keydown', keyHandler);
  const prevCleanup = activeUserActionCleanup;
  activeUserActionCleanup = () => {
    prevCleanup && prevCleanup();
    document.removeEventListener('keydown', keyHandler);
  };
}

function captureLastInsertedQuestionIfNeeded(step) {
  // ステップ 12 / 15 のクリック直後に最新 .question-item を記録しておく
  if (step.id === 12 || step.id === 15) {
    const items = document.querySelectorAll('.question-item');
    if (items.length > 0) {
      lastInsertedQuestionEl = items[items.length - 1];
    }
  }
}

function cleanupActiveStep() {
  if (typeof activeUserActionCleanup === 'function') {
    activeUserActionCleanup();
    activeUserActionCleanup = null;
  }
  // G4: ヒントタイマー破棄 + 既出ヒントのクリア
  if (stuckHintTimerId) {
    window.clearTimeout(stuckHintTimerId);
    stuckHintTimerId = null;
  }
  hideStuckHint();
  clearReadonlyTracking();
}

// ---------- 進行コールバック ----------

function handleNext() {
  advanceStep();
}

function handlePrev() {
  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  if (!currentStep) return;
  const prev = TUTORIAL_STEPS[currentStepIndex - 1];
  if (!prev) return;
  goToStep(prev.id);
}

function handleSkipConfirm(stage) {
  if (stage === 'confirmed') {
    // 「終了する」確定
    hideSkipConfirm();
    finishAndExit({ markComplete: true });
  } else {
    // 「スキップ」初回押下
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
  if (markComplete) markCompleted();
  else clearProgress();
  destroyOverlay();
  detachNewQuestionObserver();
  // ?tutorial=1 を外して dashboard へ
  const base = window.location.pathname.split('/').slice(0, -1).join('/');
  window.location.assign(`${base}/index.html`);
}

// ---------- ページ遷移 ----------

function redirectWithTutorial(url, stepId) {
  writeProgress(stepId);
  const sep = url.includes('?') ? '&' : '?';
  window.location.assign(`${url}${sep}tutorial=1&step=${stepId}`);
}

// ---------- 本番ハンドラへの簡易インターセプト ----------

function installInterceptors() {
  // ステップ 11 / 14 のような「クリックで menu が出る」ステップで、出現後に
  // 自動でステップを進めはしないが、menu 出現を検知して targetResolver で参照可能にする等の保守作業はここに集約する。
  // 現状は何もしない（guards.js が本番ハンドラ側からの呼び出しを受ける）。
}

function installNewQuestionObserver() {
  // 実画面の設問リストコンテナ ID は `questionListContainer`。見つからなければ body にフォールバック
  const list = document.getElementById('questionListContainer')
    || document.getElementById('questionsList')
    || document.body;
  if (!list) return;
  questionObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.classList?.contains('question-item')) {
          lastInsertedQuestionEl = node;
        }
        const nested = node.querySelector?.('.question-item');
        if (nested) lastInsertedQuestionEl = nested;
      });
    }
  });
  questionObserver.observe(list, { childList: true, subtree: true });
}

function detachNewQuestionObserver() {
  if (questionObserver) {
    questionObserver.disconnect();
    questionObserver = null;
  }
}

// ---------- 公開（テスト用に最小） ----------

export const __testables__ = {
  goToStep,
  resolveStartStep,
};
