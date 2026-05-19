// overlay.js
// マスク / スポットライト切り抜き / 吹き出し / 指差しポインタ / 進行バー / スキップ確認モーダルの描画。
// innerHTML 文字列代入は禁止（仕様書 §10）。すべて DOM ファクトリで構築する。

const TARGET_PAD = 4; // スポットライト切り抜き余白（仕様書 §8.1）
const SPOTLIGHT_RADIUS = 8;
const PULSE_DURATION_MS = 200;
const PULSE_COUNT = 2;
const POSITION_TRANSITION_MS = 150;

let rootEl = null; // .tutorial-root
let maskEl = null; // .tutorial-mask（SVG 切り抜き）
let spotlightEl = null; // .tutorial-spotlight（枠）
let coachmarkEl = null; // .tutorial-coachmark
let pointerEl = null; // .tutorial-pointer
let progressBarEl = null; // .tutorial-progressbar
let skipModalEl = null; // .tutorial-skip-modal
let welcomeScreenEl = null; // .tutorial-welcome
let progressStepLabelEl = null;
let progressFillEl = null;
let coachmarkStepBadgeEl = null;

let currentTargetEl = null;
let currentStep = null;
let totalSteps = 20;
let trackedReadonlyInputs = []; // {el, originalReadonly}
let resizeHandlerBound = null;
let scrollHandlerBound = null;
let windowClickGuardBound = null;
let pulseTimerId = null;
let targetWatchObserver = null; // G9: 対象要素消失監視

let onNextCb = null;
let onPrevCb = null;
let onSkipConfirmCb = null;
let onSkipCancelCb = null;
let onCompleteCb = null;

// ---------- 公開 API ----------

export function initOverlay({ total } = {}) {
  if (typeof total === 'number') totalSteps = total;
  ensureRoot();
  buildProgressBar();
  buildMask();
  buildCoachmark();
  buildPointer();
  resizeHandlerBound = () => repositionAll();
  scrollHandlerBound = () => repositionAll();
  window.addEventListener('resize', resizeHandlerBound);
  window.addEventListener('scroll', scrollHandlerBound, true);

  // 対象外クリックを capture phase で判定。スポットライト対象とチュートリアル UI のみ通す。
  windowClickGuardBound = (ev) => {
    if (!currentTargetEl) return;
    if (rootEl && rootEl.contains(ev.target)) return; // チュートリアル UI（吹き出し等）はそのまま
    if (currentTargetEl === ev.target || currentTargetEl.contains(ev.target)) return; // 対象要素は通す
    ev.preventDefault();
    ev.stopPropagation();
    pulseAttention();
  };
  window.addEventListener('click', windowClickGuardBound, true);

  // G9: 対象要素が DOM から切り離されたら再解決を試み、駄目なら中央フォールバック。
  targetWatchObserver = new MutationObserver(() => {
    if (!currentTargetEl) return;
    if (document.contains(currentTargetEl)) return;
    // 切り離された → セレクタで再解決
    const selector = currentStep?.target;
    if (selector) {
      const reResolved = document.querySelector(selector);
      if (reResolved) {
        currentTargetEl = reResolved;
        repositionAll();
        return;
      }
    }
    // 再解決失敗 → スポットライト非表示・吹き出し中央
    currentTargetEl = null;
    repositionAll();
  });
  targetWatchObserver.observe(document.body, { childList: true, subtree: true });
}

export function destroyOverlay() {
  if (resizeHandlerBound) window.removeEventListener('resize', resizeHandlerBound);
  if (scrollHandlerBound) window.removeEventListener('scroll', scrollHandlerBound, true);
  if (windowClickGuardBound) window.removeEventListener('click', windowClickGuardBound, true);
  // G9: MutationObserver 停止
  if (targetWatchObserver) {
    targetWatchObserver.disconnect();
    targetWatchObserver = null;
  }
  clearReadonlyTracking();
  if (rootEl?.parentNode) rootEl.parentNode.removeChild(rootEl);
  rootEl = null;
  maskEl = null;
  spotlightEl = null;
  coachmarkEl = null;
  pointerEl = null;
  progressBarEl = null;
  skipModalEl = null;
  progressStepLabelEl = null;
  progressFillEl = null;
  coachmarkStepBadgeEl = null;
  currentTargetEl = null;
  currentStep = null;
}

export function setCallbacks({ onNext, onPrev, onSkipConfirm, onSkipCancel, onComplete } = {}) {
  if (onNext) onNextCb = onNext;
  if (onPrev) onPrevCb = onPrev;
  if (onSkipConfirm) onSkipConfirmCb = onSkipConfirm;
  if (onSkipCancel) onSkipCancelCb = onSkipCancel;
  if (onComplete) onCompleteCb = onComplete;
}

export function renderStep(step, targetEl) {
  // G4: 前ステップで表示されていた「動かないとき」ヒントをクリア
  hideStuckHint();
  currentStep = step;
  currentTargetEl = targetEl;
  updateProgress(step.id);
  if (targetEl) scrollIntoViewIfNeeded(targetEl);
  updateMaskAndSpotlight(targetEl);
  updateCoachmark(step, targetEl);
  updatePointer(step, targetEl);
  trapFocus();
}

// ---------- G4: stuck hint ----------

/**
 * 吹き出しフッターに「動かないとき」ヒントを追加。
 * 既に存在する場合はテキストのみ更新する。
 */
export function showStuckHint(text) {
  if (!coachmarkEl) return;
  const footer = coachmarkEl.querySelector('.tutorial-coachmark__footer');
  if (!footer) return;
  let hint = coachmarkEl.querySelector('.tutorial-coachmark__stuck-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'tutorial-coachmark__stuck-hint';
    // フッターの「下」に表示するため、フッター直後に挿入する
    if (footer.nextSibling) {
      coachmarkEl.insertBefore(hint, footer.nextSibling);
    } else {
      coachmarkEl.appendChild(hint);
    }
  }
  hint.textContent = text || '';
}

export function hideStuckHint() {
  if (!coachmarkEl) return;
  const hint = coachmarkEl.querySelector('.tutorial-coachmark__stuck-hint');
  if (hint?.parentNode) hint.parentNode.removeChild(hint);
}

function scrollIntoViewIfNeeded(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const topMargin = 80;  // 進行バー（48px）＋余白
  const bottomMargin = 40;
  const outside =
    rect.top < topMargin ||
    rect.bottom > vh - bottomMargin ||
    rect.left < 0 ||
    rect.right > vw;
  if (outside) {
    try {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    } catch (_e) {
      el.scrollIntoView();
    }
  }
}

export function repositionAll() {
  if (!currentStep) return;
  // 動的解決ターゲット（ステップ 13/16 等）はターゲット要素自体が消えていることがあるため、現値を継続利用する
  updateMaskAndSpotlight(currentTargetEl);
  updateCoachmark(currentStep, currentTargetEl);
  updatePointer(currentStep, currentTargetEl);
}

/**
 * 対象外要素がクリックされた / キー操作が来た時の視線誘導パルス（仕様書 §5.1）。
 * 200ms × 2 回。スポットライト枠と吹き出しを同時にパルスさせる。
 */
export function pulseAttention() {
  if (!spotlightEl || !coachmarkEl) return;
  if (pulseTimerId) {
    clearTimeout(pulseTimerId);
    pulseTimerId = null;
  }
  spotlightEl.classList.remove('is-attention-pulse');
  coachmarkEl.classList.remove('is-attention-pulse');
  // reflow を促す
  // eslint-disable-next-line no-unused-expressions
  void spotlightEl.offsetWidth;
  spotlightEl.classList.add('is-attention-pulse');
  coachmarkEl.classList.add('is-attention-pulse');
  pulseTimerId = window.setTimeout(() => {
    spotlightEl?.classList.remove('is-attention-pulse');
    coachmarkEl?.classList.remove('is-attention-pulse');
    pulseTimerId = null;
  }, PULSE_DURATION_MS * PULSE_COUNT);
}

export function setInputsReadonly(targets) {
  clearReadonlyTracking();
  targets.forEach((el) => {
    if (!el) return;
    trackedReadonlyInputs.push({ el, originalReadonly: el.hasAttribute('readonly') });
    el.setAttribute('readonly', '');
  });
}

export function clearReadonlyTracking() {
  trackedReadonlyInputs.forEach(({ el, originalReadonly }) => {
    if (!originalReadonly && el) el.removeAttribute('readonly');
  });
  trackedReadonlyInputs = [];
}

export function showSkipConfirm() {
  if (skipModalEl) return;
  skipModalEl = buildSkipModal();
  rootEl.appendChild(skipModalEl);
  const confirmBtn = skipModalEl.querySelector('[data-skip-action="confirm"]');
  confirmBtn?.focus();
}

export function hideSkipConfirm() {
  if (skipModalEl?.parentNode) skipModalEl.parentNode.removeChild(skipModalEl);
  skipModalEl = null;
}

export function showWelcome({ onStart, onSkip } = {}) {
  if (welcomeScreenEl) return;
  ensureRoot();
  welcomeScreenEl = buildWelcomeScreen();
  rootEl.appendChild(welcomeScreenEl);
  // 進行バー・マスク等の通常チュートリアル UI は非表示にして welcome に集中させる
  if (progressBarEl) progressBarEl.style.display = 'none';
  if (maskEl) maskEl.style.display = 'none';
  if (coachmarkEl) coachmarkEl.style.display = 'none';
  if (spotlightEl) spotlightEl.style.display = 'none';
  if (pointerEl) pointerEl.style.display = 'none';

  const startBtn = welcomeScreenEl.querySelector('[data-welcome-action="start"]');
  const skipBtn = welcomeScreenEl.querySelector('[data-welcome-action="skip"]');
  startBtn?.addEventListener('click', () => {
    hideWelcome();
    onStart && onStart();
  });
  skipBtn?.addEventListener('click', () => {
    onSkip && onSkip();
  });
  startBtn?.focus();
}

export function hideWelcome() {
  if (welcomeScreenEl?.parentNode) welcomeScreenEl.parentNode.removeChild(welcomeScreenEl);
  welcomeScreenEl = null;
  // 通常チュートリアル UI を復活
  if (progressBarEl) progressBarEl.style.display = '';
  if (maskEl) maskEl.style.display = '';
  if (coachmarkEl) coachmarkEl.style.display = '';
  if (spotlightEl) spotlightEl.style.display = '';
  if (pointerEl) pointerEl.style.display = '';
}

// ---------- 構築 ----------

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement('div');
  rootEl.className = 'tutorial-root';
  rootEl.setAttribute('role', 'dialog');
  rootEl.setAttribute('aria-modal', 'true');
  rootEl.setAttribute('aria-label', 'SPEED AD チュートリアル');
  document.body.appendChild(rootEl);
}

function buildProgressBar() {
  progressBarEl = document.createElement('div');
  progressBarEl.className = 'tutorial-progressbar';

  const badge = document.createElement('span');
  badge.className = 'tutorial-progressbar__badge';
  badge.textContent = 'PRACTICE MODE';
  progressBarEl.appendChild(badge);

  const stepLabel = document.createElement('span');
  stepLabel.className = 'tutorial-progressbar__step';
  stepLabel.textContent = `${padStep(1)} / ${padStep(totalSteps)}`;
  progressStepLabelEl = stepLabel;
  progressBarEl.appendChild(stepLabel);

  const note = document.createElement('span');
  note.className = 'tutorial-progressbar__note';
  note.textContent = '練習モードのため、入力内容や作成したアンケートは保存されません。';
  progressBarEl.appendChild(note);

  const fillWrap = document.createElement('div');
  fillWrap.className = 'tutorial-progressbar__bar';
  const fill = document.createElement('div');
  fill.className = 'tutorial-progressbar__fill';
  fillWrap.appendChild(fill);
  progressFillEl = fill;
  progressBarEl.appendChild(fillWrap);

  rootEl.appendChild(progressBarEl);
}

function buildMask() {
  // SVG マスクで「対象だけ穴あき」を実現
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'tutorial-mask');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'none');

  const defs = document.createElementNS(svgNs, 'defs');
  const mask = document.createElementNS(svgNs, 'mask');
  mask.setAttribute('id', 'tutorial-mask-cutout');
  const fullRect = document.createElementNS(svgNs, 'rect');
  fullRect.setAttribute('x', '0');
  fullRect.setAttribute('y', '0');
  fullRect.setAttribute('width', '100%');
  fullRect.setAttribute('height', '100%');
  fullRect.setAttribute('fill', 'white');
  mask.appendChild(fullRect);
  const cutout = document.createElementNS(svgNs, 'rect');
  cutout.setAttribute('id', 'tutorial-mask-cutout-rect');
  cutout.setAttribute('x', '0');
  cutout.setAttribute('y', '0');
  cutout.setAttribute('width', '0');
  cutout.setAttribute('height', '0');
  cutout.setAttribute('rx', String(SPOTLIGHT_RADIUS));
  cutout.setAttribute('ry', String(SPOTLIGHT_RADIUS));
  cutout.setAttribute('fill', 'black');
  mask.appendChild(cutout);
  defs.appendChild(mask);
  svg.appendChild(defs);

  const blackOut = document.createElementNS(svgNs, 'rect');
  blackOut.setAttribute('x', '0');
  blackOut.setAttribute('y', '0');
  blackOut.setAttribute('width', '100%');
  blackOut.setAttribute('height', '100%');
  blackOut.setAttribute('fill', 'rgba(0, 0, 0, 0.55)');
  blackOut.setAttribute('mask', 'url(#tutorial-mask-cutout)');
  svg.appendChild(blackOut);

  maskEl = svg;
  rootEl.appendChild(svg);

  spotlightEl = document.createElement('div');
  spotlightEl.className = 'tutorial-spotlight';
  rootEl.appendChild(spotlightEl);
}

function buildCoachmark() {
  coachmarkEl = document.createElement('div');
  coachmarkEl.className = 'tutorial-coachmark';
  coachmarkEl.setAttribute('role', 'dialog');

  const headerEl = document.createElement('div');
  headerEl.className = 'tutorial-coachmark__header';

  const stepBadgeEl = document.createElement('span');
  stepBadgeEl.className = 'tutorial-coachmark__step-badge';
  stepBadgeEl.textContent = `${padStep(1)} / ${padStep(totalSteps)}`;
  coachmarkStepBadgeEl = stepBadgeEl;
  headerEl.appendChild(stepBadgeEl);

  const titleEl = document.createElement('h2');
  titleEl.className = 'tutorial-coachmark__title';
  headerEl.appendChild(titleEl);

  coachmarkEl.appendChild(headerEl);

  const bodyEl = document.createElement('p');
  bodyEl.className = 'tutorial-coachmark__body';
  coachmarkEl.appendChild(bodyEl);

  const footer = document.createElement('div');
  footer.className = 'tutorial-coachmark__footer';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tutorial-coachmark__skip';
  skipBtn.textContent = 'スキップ';
  skipBtn.addEventListener('click', () => onSkipConfirmCb && onSkipConfirmCb());
  footer.appendChild(skipBtn);

  const spacer = document.createElement('span');
  spacer.className = 'tutorial-coachmark__spacer';
  footer.appendChild(spacer);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'tutorial-coachmark__prev';
  prevBtn.textContent = '戻る';
  prevBtn.addEventListener('click', () => onPrevCb && onPrevCb());
  footer.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tutorial-coachmark__next';
  nextBtn.textContent = '次へ';
  nextBtn.addEventListener('click', () => {
    if (currentStep?.mode === 'user-action-bridge' && currentStep.completeButtonLabel) {
      onCompleteCb && onCompleteCb();
    } else {
      onNextCb && onNextCb();
    }
  });
  footer.appendChild(nextBtn);

  const hint = document.createElement('span');
  hint.className = 'tutorial-coachmark__hint';
  hint.textContent = 'クリックして次へ';
  footer.appendChild(hint);

  coachmarkEl.appendChild(footer);

  // ノッチ（旧 class は後方互換のため残置、新規 connector class を併記）
  const notch = document.createElement('div');
  notch.className = 'tutorial-coachmark__notch tutorial-coachmark__connector';
  coachmarkEl.appendChild(notch);

  rootEl.appendChild(coachmarkEl);
}

function buildPointer() {
  pointerEl = document.createElement('div');
  pointerEl.className = 'tutorial-pointer';

  for (let i = 0; i < 3; i += 1) {
    const ring = document.createElement('div');
    ring.className = 'tutorial-pointer__ring';
    pointerEl.appendChild(ring);
  }

  const dot = document.createElement('div');
  dot.className = 'tutorial-pointer__dot';
  pointerEl.appendChild(dot);

  rootEl.appendChild(pointerEl);
}

function buildSkipModal() {
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-skip-modal';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.className = 'tutorial-skip-modal__panel';

  const title = document.createElement('h2');
  title.className = 'tutorial-skip-modal__title';
  title.textContent = 'チュートリアルを終了しますか？';
  panel.appendChild(title);

  const body = document.createElement('p');
  body.className = 'tutorial-skip-modal__body';
  body.textContent = '終了するとアンケート一覧画面に移動します。';
  panel.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'tutorial-skip-modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'tutorial-skip-modal__cancel';
  cancelBtn.textContent = '続ける';
  cancelBtn.setAttribute('data-skip-action', 'cancel');
  cancelBtn.addEventListener('click', () => onSkipCancelCb && onSkipCancelCb());
  footer.appendChild(cancelBtn);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'tutorial-skip-modal__confirm';
  confirmBtn.textContent = '終了する';
  confirmBtn.setAttribute('data-skip-action', 'confirm');
  confirmBtn.addEventListener('click', () => onSkipConfirmCb && onSkipConfirmCb('confirmed'));
  footer.appendChild(confirmBtn);

  panel.appendChild(footer);
  overlay.appendChild(panel);

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      onSkipCancelCb && onSkipCancelCb();
    }
  });

  // Escape は「続ける」と同等
  overlay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      onSkipCancelCb && onSkipCancelCb();
    }
  });

  return overlay;
}

function buildWelcomeScreen() {
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-welcome';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tutorial-welcome-title');

  const panel = document.createElement('div');
  panel.className = 'tutorial-welcome__panel';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'tutorial-welcome__eyebrow';
  eyebrow.textContent = 'SPEED AD';
  panel.appendChild(eyebrow);

  const title = document.createElement('h1');
  title.className = 'tutorial-welcome__title';
  title.id = 'tutorial-welcome-title';
  title.textContent = 'ようこそ';
  panel.appendChild(title);

  const body = document.createElement('p');
  body.className = 'tutorial-welcome__body';
  body.textContent = 'アンケート作成から QR 発行までの基本フローを、5 分ほどで体験しましょう。';
  panel.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'tutorial-welcome__actions';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tutorial-welcome__skip';
  skipBtn.dataset.welcomeAction = 'skip';
  skipBtn.textContent = 'あとで';
  actions.appendChild(skipBtn);

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'tutorial-welcome__start';
  startBtn.dataset.welcomeAction = 'start';
  startBtn.textContent = '始める';
  actions.appendChild(startBtn);

  panel.appendChild(actions);
  overlay.appendChild(panel);

  return overlay;
}

// ---------- 更新 ----------

function padStep(n) {
  return String(n).padStart(2, '0');
}

function updateProgress(stepId) {
  if (progressStepLabelEl) {
    progressStepLabelEl.textContent = `${padStep(stepId)} / ${padStep(totalSteps)}`;
  }
  if (coachmarkStepBadgeEl) {
    coachmarkStepBadgeEl.textContent = `${padStep(stepId)} / ${padStep(totalSteps)}`;
  }
  if (progressFillEl) {
    const pct = Math.min(100, Math.max(0, (stepId / totalSteps) * 100));
    progressFillEl.style.width = `${pct}%`;
  }
}

function updateMaskAndSpotlight(targetEl) {
  const cutout = maskEl?.querySelector('#tutorial-mask-cutout-rect');
  if (!cutout || !spotlightEl) return;

  if (!targetEl) {
    cutout.setAttribute('width', '0');
    cutout.setAttribute('height', '0');
    spotlightEl.style.opacity = '0';
    spotlightEl.style.width = '0px';
    spotlightEl.style.height = '0px';
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const x = Math.max(0, rect.left - TARGET_PAD);
  const y = Math.max(0, rect.top - TARGET_PAD);
  const w = rect.width + TARGET_PAD * 2;
  const h = rect.height + TARGET_PAD * 2;

  cutout.setAttribute('x', String(x));
  cutout.setAttribute('y', String(y));
  cutout.setAttribute('width', String(w));
  cutout.setAttribute('height', String(h));

  spotlightEl.style.transition = `all ${POSITION_TRANSITION_MS}ms ease-out`;
  spotlightEl.style.opacity = '1';
  spotlightEl.style.left = `${x}px`;
  spotlightEl.style.top = `${y}px`;
  spotlightEl.style.width = `${w}px`;
  spotlightEl.style.height = `${h}px`;
  spotlightEl.style.borderRadius = `${SPOTLIGHT_RADIUS}px`;
}

function updateCoachmark(step, targetEl) {
  if (!coachmarkEl) return;
  const titleEl = coachmarkEl.querySelector('.tutorial-coachmark__title');
  const bodyEl = coachmarkEl.querySelector('.tutorial-coachmark__body');
  const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
  const prevBtn = coachmarkEl.querySelector('.tutorial-coachmark__prev');
  const hint = coachmarkEl.querySelector('.tutorial-coachmark__hint');

  // textContent のみ使用（仕様書 §10）
  if (titleEl) titleEl.textContent = step.title || '';
  if (bodyEl) bodyEl.textContent = step.body || '';

  // 「次へ」ボタンの表示制御
  const isUserAction = step.mode === 'user-action' || (step.mode === 'user-action-bridge' && !step.completeButtonLabel);
  if (nextBtn) {
    if (isUserAction) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = step.completeButtonLabel || '次へ';
    }
  }
  if (hint) {
    hint.style.display = isUserAction ? '' : 'none';
  }

  // 「戻る」は先頭以外で表示
  if (prevBtn) {
    prevBtn.style.display = step.id > 1 ? '' : 'none';
  }

  // 位置決め
  positionCoachmark(step, targetEl);
}

function positionCoachmark(step, targetEl) {
  if (!coachmarkEl) return;
  const placement = step.placement || 'bottom';
  const notch = coachmarkEl.querySelector('.tutorial-coachmark__notch');
  if (notch) notch.dataset.placement = placement;

  // center placement または target なしの場合は画面中央
  if (placement === 'center' || !targetEl) {
    coachmarkEl.style.transition = `all ${POSITION_TRANSITION_MS}ms ease-out`;
    coachmarkEl.style.left = '50%';
    coachmarkEl.style.top = '50%';
    coachmarkEl.style.transform = 'translate(-50%, -50%)';
    if (notch) notch.style.display = 'none';
    return;
  }
  if (notch) notch.style.display = '';

  const rect = targetEl.getBoundingClientRect();
  const cmRect = coachmarkEl.getBoundingClientRect();
  const coachmarkW = cmRect.width || 320;
  const coachmarkH = cmRect.height || 160;
  const gap = 16;
  let left = 0;
  let top = 0;

  switch (placement) {
    case 'top':
      left = rect.left + rect.width / 2 - coachmarkW / 2;
      top = rect.top - coachmarkH - gap;
      break;
    case 'left':
      left = rect.left - coachmarkW - gap;
      top = rect.top + rect.height / 2 - coachmarkH / 2;
      break;
    case 'right':
      left = rect.right + gap;
      top = rect.top + rect.height / 2 - coachmarkH / 2;
      break;
    case 'bottom':
    default:
      left = rect.left + rect.width / 2 - coachmarkW / 2;
      top = rect.bottom + gap;
      break;
  }

  // G8: 吹き出しの画面内クランプ
  //   - top: 進行バー 48px + 余白 8px = 56px を下端、画面高 - 高さ - 8px を上端
  //   - left: 8px を左端、画面幅 - 幅 - 8px を右端
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  top = Math.max(56, Math.min(top, vh - coachmarkH - 8));
  left = Math.max(8, Math.min(left, vw - coachmarkW - 8));

  coachmarkEl.style.transition = `all ${POSITION_TRANSITION_MS}ms ease-out`;
  coachmarkEl.style.transform = 'none';
  coachmarkEl.style.left = `${left}px`;
  coachmarkEl.style.top = `${top}px`;
}

function updatePointer(step, targetEl) {
  if (!pointerEl) return;
  const isUserAction = step.mode === 'user-action' || step.mode === 'user-action-bridge';
  if (!isUserAction || !targetEl) {
    pointerEl.style.opacity = '0';
    pointerEl.style.pointerEvents = 'none';
    return;
  }
  const rect = targetEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  pointerEl.style.transition = `opacity ${POSITION_TRANSITION_MS}ms ease-out`;
  pointerEl.style.opacity = '1';
  pointerEl.style.left = `${cx - 24}px`;
  pointerEl.style.top = `${cy - 24}px`;
  pointerEl.style.pointerEvents = 'none';
}

function trapFocus() {
  if (!coachmarkEl) return;
  const focusable = coachmarkEl.querySelector('button:not([style*="display: none"])');
  // 直近の自動フォーカスは「次へ」または「スキップ」
  if (focusable) {
    try { focusable.focus({ preventScroll: true }); } catch (_e) { /* noop */ }
  }
}
