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
  showAccountCtaScreen,
} from './overlay.js';
import {
  readProgress,
  writeProgress,
  clearProgress,
  markCompleted,
  isCompleted,
  setEntryType,
  getEntryType,
  clearEntryType,
} from './state.js';
import { installGlobalApi, enableTargetForTutorial } from './guards.js';
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
let stuckHintTimerId = null; // G4: 4 秒後にヒント表示用
let escapeTargetEl = null; // #18: 緊急脱出時に代行クリックする対象要素

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

  installNewQuestionObserver();

  const startStep = resolveStartStep();
  bootstrapped = true;

  // 初回ログイン直後（進行状態なし & 開始ステップ=1）はようこそ画面を挟む。
  // 中断再開・URL での step 指定時はスキップして直接該当ステップへ。
  const progress = readProgress();
  const isFreshStart = !progress && startStep === 1;
  // フレッシュ起動時のみエントリ種別を確定する。中断再開・ページ跨ぎでは
  // 再設定しないため index.html→surveyCreation.html の遷移でも保持される。
  if (isFreshStart) {
    const isTrial = new URLSearchParams(window.location.search).get('trial') === '1';
    setEntryType(isTrial ? 'trial' : 'standard');
  }
  if (isFreshStart) {
    showWelcome({
      onStart: () => goToStep(1),
      // welcome 画面自体が確認の役割を果たすため、確認モーダルを挟まず直接離脱する
      onSkip: () => finishAndExit({ markComplete: true }),
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

  if (stepId === 9) {
    applyBasicInfoHandoff();
  }

  resolveTargetAndRender(step);
}

const HANDOFF_STORAGE_KEY = 'speedad-tutorial-handoff';

function applyBasicInfoHandoff() {
  let formData = null;
  if (typeof window.localStorage !== 'undefined') {
    const raw = window.localStorage.getItem(HANDOFF_STORAGE_KEY);
    if (raw) {
      try {
        formData = JSON.parse(raw);
      } catch (_e) {
        formData = null;
      }
      window.localStorage.removeItem(HANDOFF_STORAGE_KEY);
    }
  }

  const nameInput = document.getElementById('surveyName_ja');
  const titleInput = document.getElementById('displayTitle_ja');
  const periodInput = document.getElementById('periodRange');

  // handoff も無く、フィールドが既に埋まっている（リロード or ユーザー編集後）の場合は上書きしない
  if (!formData) {
    const filled = (el) => el && typeof el.value === 'string' && el.value.trim() !== '';
    if (filled(nameInput) && filled(titleInput) && filled(periodInput)) return;
  }

  let surveyName, displayTitle, periodStart, periodEnd;
  if (formData && formData.surveyName && formData.displayTitle && formData.periodStart && formData.periodEnd) {
    surveyName = formData.surveyName;
    displayTitle = formData.displayTitle;
    periodStart = new Date(formData.periodStart);
    periodEnd = new Date(formData.periodEnd);
  } else {
    surveyName = '初めてのアンケート';
    displayTitle = '製品Aに関する満足度調査';
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 3);
    end.setHours(23, 59, 0, 0);
    periodStart = start;
    periodEnd = end;
  }

  if (nameInput) setInputValue(nameInput, surveyName);
  if (titleInput) setInputValue(titleInput, displayTitle);

  if (periodInput) {
    let fp = periodInput._flatpickr;
    if (!fp) {
      let node = periodInput.parentElement;
      while (node && !fp) {
        if (node._flatpickr) { fp = node._flatpickr; break; }
        node = node.parentElement;
      }
    }
    if (fp && typeof fp.setDate === 'function') {
      fp.setDate([periodStart, periodEnd], true);
    } else {
      const fmt = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      setInputValue(periodInput, `${fmt(periodStart)} 〜 ${fmt(periodEnd)}`);
    }
  }
}

function resolveTargetAndRender(step) {
  // ターゲットが waitForElement 指定なら出現を待つ
  const finalize = (targetEl) => {
    const isUserAction = step.mode === 'user-action' || step.mode === 'user-action-bridge';
    // チュートリアル中の user-action 系ステップで対象が disabled の場合は強制 enable
    if (targetEl && isUserAction) {
      if (targetEl.disabled === true || targetEl.getAttribute('aria-disabled') === 'true') {
        enableTargetForTutorial(targetEl);
      }
    }
    renderStep(step, targetEl);
    // 救済: user-action 系で対象要素が取得できなかった場合、クリックリスナーも
    // ヒントタイマーも張られず進行手段が無くなるため、即座にヒントを出して「次へ」を開放する。
    // ただし完了ボタン付きステップ（最終ステップ）は「完了」ボタンが前進手段なので対象外。
    if (!targetEl && isUserAction && !step.completeButtonLabel) {
      showStuckHint('この操作はスキップできます。『次へ』で先に進めます');
      return;
    }
    applyStepBehavior(step, targetEl);
  };

  // 動的解決
  if (step.targetResolver === 'lastInsertedQuestionField') {
    let card = lastInsertedQuestionEl;
    if (!card) {
      // フォールバック: DOM 上の最新 .question-card
      const items = document.querySelectorAll('.question-card');
      card = items.length > 0 ? items[items.length - 1] : null;
    }
    if (!card) {
      finalize(null);
      return;
    }
    let el = null;
    if (step.fieldPath === 'questionText') {
      el = card.querySelector('[data-lang-wrapper] input.input-field');
    } else if (step.fieldPath === 'option') {
      const qid = card.dataset.questionId;
      const list = qid ? card.querySelector(`#options-list-${qid}`) : null;
      if (list) {
        // optionIndex までの row が存在しなければ「選択肢を追加」ボタンを click して補充
        let currentCount = list.querySelectorAll('[data-option-index]').length;
        if (currentCount <= step.optionIndex) {
          const buttons = card.querySelectorAll('button');
          let addBtn = null;
          buttons.forEach((b) => {
            if (!addBtn && b.textContent && b.textContent.includes('選択肢を追加')) {
              addBtn = b;
            }
          });
          if (addBtn) {
            let safety = 0;
            while (currentCount <= step.optionIndex && safety < 10) {
              addBtn.click();
              currentCount = list.querySelectorAll('[data-option-index]').length;
              safety += 1;
            }
          }
        }
        const row = list.querySelector(`[data-option-index="${step.optionIndex}"]`);
        el = row?.querySelector('[data-lang-wrapper] input') || null;
      }
    } else if (step.fieldPath === 'minLabel') {
      const grids = card.querySelectorAll('.grid > div');
      el = grids[0]?.querySelector('[data-lang-wrapper] input') || null;
    } else if (step.fieldPath === 'maxLabel') {
      const grids = card.querySelectorAll('.grid > div');
      el = grids[1]?.querySelector('[data-lang-wrapper] input') || null;
    }
    finalize(el);
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
}

function setInputValue(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function bindUserActionListener(step, targetEl) {
  if (!targetEl) {
    return;
  }
  // G4: クリック検出の救済 — 4 秒間クリックが無ければ吹き出しフッターにヒントを表示。
  if (stuckHintTimerId) {
    window.clearTimeout(stuckHintTimerId);
    stuckHintTimerId = null;
  }
  stuckHintTimerId = window.setTimeout(() => {
    showStuckHint('ボタンが反応しないときは『次へ』で先に進めます');
    stuckHintTimerId = null;
    // #18: ヒント表示後の「次へ」緊急脱出で本来のクリックを代行できるよう対象を保持
    escapeTargetEl = targetEl;
  }, 4000);

  // M-4: クリック前の .question-card 件数を控えておき、増加を検出してから記録する
  const cardCountBeforeClick = document.querySelectorAll('.question-card').length;

  const handler = (ev) => {
    // クリックが入ったらヒントタイマー・緊急脱出対象は破棄
    if (stuckHintTimerId) {
      window.clearTimeout(stuckHintTimerId);
      stuckHintTimerId = null;
    }
    escapeTargetEl = null;
    // user-action-bridge は本番ハンドラが guards 経由で進行を引き継ぐ
    // user-action はそのまま次ステップへ
    if (step.mode === 'user-action') {
      // 対象クリックは本来の動作（モーダルを開く、メニューを開く等）をそのまま走らせ、
      // 設問カードの増加を検出してからステップ前進する
      captureLastInsertedQuestionIfNeeded(step, cardCountBeforeClick, () => {
        advanceStep();
      });
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

function captureLastInsertedQuestionIfNeeded(step, baselineCount, done) {
  // ステップ 12 / 19 のクリック直後に最新 .question-card を記録しておく
  // （新ステップ列でシングルアンサー選択=12, 評定尺度選択=19）
  if (step.id !== 12 && step.id !== 19) {
    done();
    return;
  }
  // M-4: renderAllQuestions が innerHTML 全消去→再生成するため固定待ちでは古いカードを掴む。
  // .question-card 件数が baseline を超えるまでポーリング（最大 1 秒・50ms 間隔）して検出後に記録。
  const start = Date.now();
  const poll = () => {
    const items = document.querySelectorAll('.question-card');
    if (items.length > baselineCount) {
      lastInsertedQuestionEl = items[items.length - 1];
      done();
      return;
    }
    if (Date.now() - start > 1000) {
      // タイムアウト: 増加を検出できなくても末尾カードを安全側で記録して前進
      if (items.length > 0) {
        lastInsertedQuestionEl = items[items.length - 1];
      }
      done();
      return;
    }
    window.setTimeout(poll, 50);
  };
  poll();
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
  escapeTargetEl = null;
  hideStuckHint();
  clearReadonlyTracking();
}

// ---------- 進行コールバック ----------

function handleNext() {
  // #18: 緊急脱出（stuck hint 経由の前進）時、対象要素が存在すれば本来のクリックを
  // 代行してから前進する。対象が無ければ前進のみ。
  if (escapeTargetEl) {
    const el = escapeTargetEl;
    escapeTargetEl = null;
    if (document.body.contains(el)) {
      try {
        el.click();
      } catch (_e) {
        /* noop: クリック失敗時も前進は継続 */
      }
    }
  }
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
  const isTrial = getEntryType() === 'trial';
  if (markComplete) markCompleted();
  else clearProgress();
  clearEntryType();
  detachNewQuestionObserver();
  destroyOverlay();
  // お試しユーザーは実ダッシュボードへ遷移せず、アカウント作成 CTA 画面へ誘導する。
  // showAccountCtaScreen は内部で ensureRoot するため destroyOverlay 後に呼ぶ。
  if (isTrial) {
    showAccountCtaScreen({
      onCreateAccount: () => window.location.assign('../../index.html?intent=signup'),
      onClose: () => window.location.assign('../../index.html'),
    });
    return;
  }
  // `05_support/tutorial/` 配下で動作するため、退出先は実ダッシュボードへ固定する
  window.location.assign('../../02_dashboard/index.html');
}

// ---------- ページ遷移 ----------

function redirectWithTutorial(url, stepId) {
  writeProgress(stepId);
  const sep = url.includes('?') ? '&' : '?';
  window.location.assign(`${url}${sep}tutorial=1&step=${stepId}`);
}

// ---------- 設問カード出現の監視 ----------

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
        if (node.classList?.contains('question-card')) {
          lastInsertedQuestionEl = node;
        }
        const nested = node.querySelector?.('.question-card');
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
