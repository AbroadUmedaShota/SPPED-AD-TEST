// overlay.js
// マスク / スポットライト切り抜き / 吹き出し / 指差しポインタ / 進行バー / スキップ確認モーダルの描画。
// innerHTML 文字列代入は禁止（仕様書 §10）。すべて DOM ファクトリで構築する。

const TARGET_PAD = 4; // スポットライト切り抜き余白（仕様書 §8.1）
const SPOTLIGHT_RADIUS = 8;
const PULSE_DURATION_MS = 200;
const PULSE_COUNT = 2;
// 体感速度の調整: 旧 240ms は「もっさり」感が強かったため、位置補間を 120ms に短縮。
// step 切替フェードも同様に 500ms → 180ms に圧縮（COACHMARK_FADE_MS）。
const POSITION_TRANSITION_MS = 120;
const COACHMARK_FADE_MS = 180;
const MOBILE_BREAKPOINT = 768; // #6: この幅以下では right/left placement を不可とする
const COACHMARK_FALLBACK_W = 400; // #8: CSS 実幅に合わせたフォールバック
const COACHMARK_FALLBACK_H = 200; // #9: CSS 実高に寄せたフォールバック
// コネクタ長。スポットライトの視覚エッジ
// （TARGET_PAD 4 + border 3 + box-shadow 0 0 0 2px の硬いアウトライン = 9px）を
// 必ず外側で止まるように設計する。gap - CONNECTOR_REACH = 26 - 10 = 16px のクリアランス。
// 旧 14 では gap 22 と合わせて先端 +8px となり 9px の硬エッジに 1px 食い込んでいた。
const CONNECTOR_REACH = 10;

let rootEl = null; // .tutorial-root
let maskEl = null; // .tutorial-mask（SVG 切り抜き）
let cutoutRectEl = null; // SVG 切り抜き rect（#10: transition 統一のため保持）
let contextCutoutRectEl = null; // contextTarget 用 弱ハイライト rect（target より先に挿入）
let spotlightEl = null; // .tutorial-spotlight（枠）
let contextSpotlightEl = null; // .tutorial-spotlight--context（外側 弱ハイライト枠）
let coachmarkEl = null; // .tutorial-coachmark
let pointerEl = null; // .tutorial-pointer
let progressBarEl = null; // .tutorial-progressbar
let skipModalEl = null; // .tutorial-skip-modal
let welcomeScreenEl = null; // .tutorial-welcome
let progressStepLabelEl = null;
let progressFillEl = null;
let srLiveEl = null; // #12: aria-live SR 専用領域

let currentTargetEl = null;
let currentContextEl = null;
let currentStep = null;
let totalSteps = 20;
let trackedReadonlyInputs = []; // {el, originalReadonly}
let resizeHandlerBound = null;
let scrollHandlerBound = null;
let scrollRafId = null; // #21: scroll スロットル用 rAF id
let windowClickGuardBound = null;
let coachmarkKeydownBound = null; // #3/#4: コーチマーク内キーボード処理
let animationSettleHandlerBound = null; // 対象の transition/animation 完了追従
let pulseTimerId = null;
let targetWatchObserver = null; // G9: 対象要素消失監視
let targetResizeObserver = null; // 対象要素のサイズ変化（モーダル展開等）追従
let inertedSiblings = []; // #3: inert を付与した body 直下要素

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
  // #21: scroll は capture + 全要素再計算が重いため requestAnimationFrame でスロットルする。
  scrollHandlerBound = () => {
    if (scrollRafId != null) return;
    scrollRafId = window.requestAnimationFrame(() => {
      scrollRafId = null;
      repositionAll();
    });
  };
  window.addEventListener('resize', resizeHandlerBound);
  window.addEventListener('scroll', scrollHandlerBound, true);

  // #3/#4: コーチマーク表示中のキーボード処理。
  //   - Tab/Shift+Tab はコーチマーク内でフォーカスを循環（フォーカストラップ）
  //   - ESC は離脱導線として skip 確認モーダルを開く
  //   - Space / Enter は「次へ」を発火（フォーカス位置によらず進行できる）
  coachmarkKeydownBound = (ev) => {
    // skip モーダル表示中は当該モーダルの keydown に委ねる（ESC=続ける挙動を維持）
    if (skipModalEl || welcomeScreenEl) return;
    if (!coachmarkEl || coachmarkEl.style.display === 'none') return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      showSkipConfirm();
      return;
    }
    if (ev.key === 'Tab') {
      handleCoachmarkTab(ev);
      return;
    }
    if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
      // フォーム要素（autofill 対象の入力欄等）に直接フォーカスがある場合は本来の入力動作を優先。
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) {
          return;
        }
        // コーチマーク内のボタン（戻る・スキップ等）にフォーカスが当たっている場合は、
        // ブラウザ標準のキー＝そのボタンの click を尊重して干渉しない。
        if (tag === 'BUTTON' && coachmarkEl.contains(active)) {
          return;
        }
      }
      const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
      if (nextBtn && nextBtn.style.display !== 'none' && !nextBtn.disabled) {
        ev.preventDefault();
        nextBtn.click();
      }
    }
  };
  document.addEventListener('keydown', coachmarkKeydownBound, true);

  // 対象外クリックを capture phase で判定。スポットライト対象とチュートリアル UI のみ通す。
  windowClickGuardBound = (ev) => {
    if (!currentTargetEl) return;
    // プログラム的なクリック（チュートリアル自身が行う「選択肢を追加」ボタンの
    // click() 等）はガード対象外。ユーザーの実クリック（isTrusted=true）だけを誘導する。
    if (!ev.isTrusted) return;
    if (rootEl && rootEl.contains(ev.target)) return; // チュートリアル UI（吹き出し等）はそのまま
    // 対象要素のクリックを通すのは user-action 系ステップのみ。
    // info / autofill ステップは「次へ」で進む想定。対象がモーダル等のコンテナのとき、
    // 内部のボタン（「作成する」等）を押して工程を飛ばすのを防ぐ。
    // contextTarget は user-action 対象ではないため判定には含めない（クリックは弾く）。
    const isUserActionStep = currentStep
      && (currentStep.mode === 'user-action' || currentStep.mode === 'user-action-bridge');
    if (isUserActionStep && (currentTargetEl === ev.target || currentTargetEl.contains(ev.target))) {
      return; // 対象要素は通す
    }
    ev.preventDefault();
    ev.stopPropagation();
    pulseAttention();
  };
  window.addEventListener('click', windowClickGuardBound, true);

  // 対象要素の CSS トランジション/アニメーション完了時に再配置する。
  // ResizeObserver は transform を検知しないため、モーダルの scale 展開アニメ等は
  // こちらで完了を捉えてスポットライト枠・吹き出しを最終位置へ補正する。
  animationSettleHandlerBound = (ev) => {
    if (!currentTargetEl) return;
    const t = ev.target;
    if (
      t === currentTargetEl
      || (currentTargetEl.contains && currentTargetEl.contains(t))
      || (t && t.contains && t.contains(currentTargetEl))
    ) {
      repositionAll();
    }
  };
  document.addEventListener('transitionend', animationSettleHandlerBound, true);
  document.addEventListener('animationend', animationSettleHandlerBound, true);

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
    // #5: 再解決失敗 → スポットライト非表示・吹き出し中央。
    // 暗幕だけ残って手がかりが消えるのを防ぐため、本文にメッセージを出し「次へ」を開放する。
    currentTargetEl = null;
    repositionAll();
    showStuckHint('対象が見つかりません。「次へ」で進めます。');
  });
  targetWatchObserver.observe(document.body, { childList: true, subtree: true });

  // 対象要素のサイズ変化（モーダルの展開アニメーション、遅延レイアウト等）に追従して
  // 再配置する。描画時にレイアウト未確定でも、確定後の resize でスポットライト枠・
  // 吹き出しが正しい位置へ補正される。
  if (typeof ResizeObserver !== 'undefined') {
    targetResizeObserver = new ResizeObserver(() => repositionAll());
  }
}

export function destroyOverlay() {
  if (resizeHandlerBound) window.removeEventListener('resize', resizeHandlerBound);
  if (scrollHandlerBound) window.removeEventListener('scroll', scrollHandlerBound, true);
  if (windowClickGuardBound) window.removeEventListener('click', windowClickGuardBound, true);
  if (coachmarkKeydownBound) document.removeEventListener('keydown', coachmarkKeydownBound, true);
  if (animationSettleHandlerBound) {
    document.removeEventListener('transitionend', animationSettleHandlerBound, true);
    document.removeEventListener('animationend', animationSettleHandlerBound, true);
    animationSettleHandlerBound = null;
  }
  if (scrollRafId != null) {
    window.cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
  // G9: MutationObserver 停止
  if (targetWatchObserver) {
    targetWatchObserver.disconnect();
    targetWatchObserver = null;
  }
  if (targetResizeObserver) {
    targetResizeObserver.disconnect();
    targetResizeObserver = null;
  }
  // #3: 背後ページの inert を確実に解除
  releaseBackgroundInert();
  clearReadonlyTracking();
  if (rootEl?.parentNode) rootEl.parentNode.removeChild(rootEl);
  rootEl = null;
  maskEl = null;
  cutoutRectEl = null;
  contextCutoutRectEl = null;
  spotlightEl = null;
  contextSpotlightEl = null;
  coachmarkEl = null;
  pointerEl = null;
  progressBarEl = null;
  skipModalEl = null;
  welcomeScreenEl = null;
  progressStepLabelEl = null;
  progressFillEl = null;
  srLiveEl = null;
  resizeHandlerBound = null;
  scrollHandlerBound = null;
  windowClickGuardBound = null;
  coachmarkKeydownBound = null;
  currentTargetEl = null;
  currentContextEl = null;
  currentStep = null;
}

export function setCallbacks({ onNext, onPrev, onSkipConfirm, onSkipCancel, onComplete } = {}) {
  if (onNext) onNextCb = onNext;
  if (onPrev) onPrevCb = onPrev;
  if (onSkipConfirm) onSkipConfirmCb = onSkipConfirm;
  if (onSkipCancel) onSkipCancelCb = onSkipCancel;
  if (onComplete) onCompleteCb = onComplete;
}

export function renderStep(step, targetEl, contextEl = null) {
  // G4: 前ステップで表示されていた「動かないとき」ヒントをクリア
  hideStuckHint();

  // ステップ遷移時は「フェードアウト → 内容差替 → フェードイン」の3段階で
  // 切替を演出する（瞬間置換による"パッ"感の解消）。
  // 同一ステップの再render（repositionAll 等）は即時適用してフェードを挟まない。
  // CSSクラス方式は keyframe `tutorial-coachmark-in` との競合で transition 発火が
  // 不確実だったため、inline style で確実に opacity を制御する方式に統一。
  const isStepChange = !currentStep || currentStep.id !== step.id;

  const applyUpdate = () => {
    currentStep = step;
    currentTargetEl = targetEl;
    currentContextEl = contextEl || null;
    if (targetResizeObserver) {
      targetResizeObserver.disconnect();
      if (targetEl) targetResizeObserver.observe(targetEl);
      if (contextEl) targetResizeObserver.observe(contextEl);
    }
    updateProgress(step);
    if (targetEl) scrollIntoViewIfNeeded(targetEl);
    updateMaskAndSpotlight(targetEl, currentContextEl);
    updateCoachmark(step, targetEl);
    updatePointer(step, targetEl);
    announceStep(step);
    trapFocus();
    if (isStepChange && coachmarkEl) {
      // フェードイン: inline opacity と transform を「終端値」に戻す。
      // base CSS の transition: opacity 200ms, transform 200ms で滑らかに補間。
      coachmarkEl.style.opacity = '1';
      coachmarkEl.style.transform = '';  // positionCoachmark が後で設定する値に委ねる
    }
  };

  if (isStepChange && coachmarkEl && coachmarkEl.style.display !== 'none') {
    // フェードアウト: COACHMARK_FADE_MS（180ms）と合わせる。
    // 旧 500ms はもっさり感が強かったため短縮。scale/translate も控えめに（0.92 / 12px）。
    coachmarkEl.style.pointerEvents = 'none';
    coachmarkEl.style.opacity = '0';
    coachmarkEl.style.transform = 'scale(0.92) translateY(12px)';
    window.setTimeout(() => {
      if (coachmarkEl) coachmarkEl.style.pointerEvents = '';
      applyUpdate();
    }, COACHMARK_FADE_MS);
  } else {
    applyUpdate();
  }
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

  // 詰まり時の緊急脱出: user-action ステップで非表示中の「次へ」を一時開放する。
  // スキップ確定（=完了扱い）以外の前進手段を提供する。
  const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
  if (nextBtn && nextBtn.style.display === 'none') {
    nextBtn.style.display = '';
    nextBtn.dataset.tutorialStuckRevealed = '1';
  }
}

export function hideStuckHint() {
  if (!coachmarkEl) return;
  const hint = coachmarkEl.querySelector('.tutorial-coachmark__stuck-hint');
  if (hint?.parentNode) hint.parentNode.removeChild(hint);
  const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
  if (nextBtn?.dataset?.tutorialStuckRevealed === '1') {
    nextBtn.style.display = 'none';
    delete nextBtn.dataset.tutorialStuckRevealed;
  }
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
  updateMaskAndSpotlight(currentTargetEl, currentContextEl);
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
  // #19: 離脱を後押ししないよう、初期フォーカスは「続ける」(cancel) に置く。
  const cancelBtn = skipModalEl.querySelector('[data-skip-action="cancel"]');
  try { cancelBtn?.focus(); } catch (_e) { /* noop */ }
}

export function hideSkipConfirm() {
  if (skipModalEl?.parentNode) skipModalEl.parentNode.removeChild(skipModalEl);
  skipModalEl = null;
  // skip モーダルを閉じたらコーチマークへフォーカスを戻し、トラップを継続させる。
  if (coachmarkEl && coachmarkEl.style.display !== 'none') {
    trapFocus();
  }
}

export function showWelcome({ onStart, onSkip, ...welcomeText } = {}) {
  if (welcomeScreenEl) return;
  ensureRoot();
  welcomeScreenEl = buildWelcomeScreen(welcomeText);
  rootEl.appendChild(welcomeScreenEl);
  // #27: welcome 自身が dialog/aria-modal を持つ間、rootEl の dialog ロールは外して
  // モーダルの二重ネストを解消する（#11 と整合）。
  rootEl.removeAttribute('role');
  rootEl.removeAttribute('aria-modal');
  rootEl.removeAttribute('aria-label');
  // #3: welcome 表示中も背後ページを inert 化する
  applyBackgroundInert();
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
  // #3: welcome フェーズで付与した背後ページの inert を解除する。
  // コーチマーク表示フェーズでは user-action 対象をクリックさせるため inert を残さない。
  releaseBackgroundInert();
  // #27: welcome 終了後、rootEl の dialog ロールを復元（コーチマーク表示フェーズ）
  rootEl?.setAttribute('role', 'dialog');
  rootEl?.setAttribute('aria-modal', 'true');
  rootEl?.setAttribute('aria-label', 'SPEED AD チュートリアル');
  // 通常チュートリアル UI を復活
  if (progressBarEl) progressBarEl.style.display = '';
  if (maskEl) maskEl.style.display = '';
  if (coachmarkEl) coachmarkEl.style.display = '';
  if (spotlightEl) spotlightEl.style.display = '';
  if (pointerEl) pointerEl.style.display = '';
}

/**
 * チュートリアル完了/スキップ後、全ユーザー共通で表示する終端の全画面 CTA 画面。
 * index.js が finishAndExit 内で destroyOverlay() を呼んだ後に
 * 呼び出すため、rootEl は破棄済み。自前で ensureRoot() してルートを用意する。
 * 終端画面のため 1 回表示のみで冪等化・hide 関数は持たない。
 *
 * variant: 'complete' = チュートリアル完遂/スキップ確定経由。「チュートリアル完了」eyebrow。
 *          'welcome-skip' = welcome 画面の「サービス概要を見る」経由（未着手離脱）。
 *                           完了表現を避け、サービス紹介寄りの文言に切り替える。
 */
export function showAccountCtaScreen({ onCreateAccount, onClose, variant = 'complete' } = {}) {
  ensureRoot();
  const ctaScreenEl = buildAccountCtaScreen(variant);
  rootEl.appendChild(ctaScreenEl);
  // CTA 画面自身が dialog/aria-modal を持つため、rootEl の dialog ロールは外して
  // モーダルの二重ネストを解消する（welcome と同じ作法）。
  rootEl.removeAttribute('role');
  rootEl.removeAttribute('aria-modal');
  rootEl.removeAttribute('aria-label');
  // 背後ページを inert 化して操作不能にする。
  applyBackgroundInert();

  const createBtn = ctaScreenEl.querySelector('.tutorial-account-cta__create');
  const closeBtn = ctaScreenEl.querySelector('.tutorial-account-cta__close');
  createBtn?.addEventListener('click', () => {
    onCreateAccount && onCreateAccount();
  });
  closeBtn?.addEventListener('click', () => {
    onClose && onClose();
  });
  createBtn?.focus();
}

// ---------- 構築 ----------

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement('div');
  rootEl.className = 'tutorial-root';
  rootEl.setAttribute('role', 'dialog');
  rootEl.setAttribute('aria-modal', 'true');
  rootEl.setAttribute('aria-label', 'SPEED AD チュートリアル');
  // #11: コーチマークのタイトル/本文を dialog のラベル・説明として参照する。
  rootEl.setAttribute('aria-labelledby', 'tutorial-coachmark-title');
  rootEl.setAttribute('aria-describedby', 'tutorial-coachmark-body');
  document.body.appendChild(rootEl);

  // #12: ステップ遷移を読み上げる SR 専用領域。CSS（tutorial-sr-only）は別担当が定義。
  srLiveEl = document.createElement('div');
  srLiveEl.className = 'tutorial-sr-only';
  srLiveEl.setAttribute('aria-live', 'polite');
  srLiveEl.setAttribute('aria-atomic', 'true');
  rootEl.appendChild(srLiveEl);
}

function buildProgressBar() {
  progressBarEl = document.createElement('div');
  progressBarEl.className = 'tutorial-progressbar';

  const badge = document.createElement('span');
  badge.className = 'tutorial-progressbar__badge';
  badge.textContent = '練習モード';
  progressBarEl.appendChild(badge);

  const stepLabel = document.createElement('span');
  stepLabel.className = 'tutorial-progressbar__step';
  // 初期表示は最初のブロック名（renderStep が呼ばれたら updateProgress で上書き）。
  stepLabel.textContent = `Step 1/${TOTAL_BLOCKS} ・ ${BLOCK_LABELS.A.label}`;
  progressStepLabelEl = stepLabel;
  progressBarEl.appendChild(stepLabel);

  const note = document.createElement('span');
  note.className = 'tutorial-progressbar__note';
  // 体験用案内: ①入力非保存 ②開発中の旨 ③Space/Enter でも進めるショートカット を併記。
  note.textContent =
    'これは体験用ツアーです。入力内容は保存されません。'
    + '画面は開発中のため、リリース版とは一部異なる場合があります。'
    + 'Space / Enter でも次へ進めます。';
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

  // contextTarget 用の弱ハイライト矩形（半透明グレー）。target cutout より「先に」
  // 追加することで、target と重なった領域は target の fill="black"（完全穴）に
  // 後勝ちで上書きされる。
  const contextCutout = document.createElementNS(svgNs, 'rect');
  contextCutout.setAttribute('id', 'tutorial-mask-context-rect');
  contextCutout.setAttribute('x', '0');
  contextCutout.setAttribute('y', '0');
  contextCutout.setAttribute('width', '0');
  contextCutout.setAttribute('height', '0');
  contextCutout.setAttribute('rx', String(SPOTLIGHT_RADIUS));
  contextCutout.setAttribute('ry', String(SPOTLIGHT_RADIUS));
  contextCutout.setAttribute('fill', 'rgba(255,255,255,0.55)');
  contextCutout.style.transition =
    `x ${POSITION_TRANSITION_MS}ms ease-out, y ${POSITION_TRANSITION_MS}ms ease-out, ` +
    `width ${POSITION_TRANSITION_MS}ms ease-out, height ${POSITION_TRANSITION_MS}ms ease-out`;
  contextCutoutRectEl = contextCutout;
  mask.appendChild(contextCutout);

  const cutout = document.createElementNS(svgNs, 'rect');
  cutout.setAttribute('id', 'tutorial-mask-cutout-rect');
  cutout.setAttribute('x', '0');
  cutout.setAttribute('y', '0');
  cutout.setAttribute('width', '0');
  cutout.setAttribute('height', '0');
  cutout.setAttribute('rx', String(SPOTLIGHT_RADIUS));
  cutout.setAttribute('ry', String(SPOTLIGHT_RADIUS));
  cutout.setAttribute('fill', 'black');
  // #10: spotlightEl(枠) は CSS transition で 150ms 補間されるため、
  // SVG cutout rect の x/y/width/height にも同じ transition を付けてジャンプを揃える。
  cutout.style.transition =
    `x ${POSITION_TRANSITION_MS}ms ease-out, y ${POSITION_TRANSITION_MS}ms ease-out, ` +
    `width ${POSITION_TRANSITION_MS}ms ease-out, height ${POSITION_TRANSITION_MS}ms ease-out`;
  cutoutRectEl = cutout;
  mask.appendChild(cutout);
  defs.appendChild(mask);
  svg.appendChild(defs);

  const blackOut = document.createElementNS(svgNs, 'rect');
  blackOut.setAttribute('x', '0');
  blackOut.setAttribute('y', '0');
  blackOut.setAttribute('width', '100%');
  blackOut.setAttribute('height', '100%');
  blackOut.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
  blackOut.setAttribute('mask', 'url(#tutorial-mask-cutout)');
  svg.appendChild(blackOut);

  maskEl = svg;
  rootEl.appendChild(svg);

  spotlightEl = document.createElement('div');
  spotlightEl.className = 'tutorial-spotlight';
  rootEl.appendChild(spotlightEl);

  // contextTarget 用の弱ハイライト枠（control: 内側より控えめ）。
  // 内側スポットライト（spotlightEl）と同等以下の z-index で配置する。
  contextSpotlightEl = document.createElement('div');
  contextSpotlightEl.className = 'tutorial-spotlight--context';
  contextSpotlightEl.style.display = 'none';
  rootEl.appendChild(contextSpotlightEl);
}

function buildCoachmark() {
  coachmarkEl = document.createElement('div');
  coachmarkEl.className = 'tutorial-coachmark';
  // #11: role="dialog" は rootEl が保持するため、コーチマーク側からは外して二重ネストを解消。
  // タイトル/本文へ id を付与し、rootEl が aria-labelledby/describedby で参照する。
  coachmarkEl.setAttribute('tabindex', '-1'); // #7: 安全な初期フォーカス先

  // コーチマーク内の click が document までバブルしないようにする（バブル段階で停止）。
  //
  // 背景: app 側コードに document 級の "外側クリックでメニューを閉じる" リスナーが
  // 複数ある（例: surveyCreation-v2.js の #inlineQuestionTypeMenuBottom / FAB メニュー）。
  // step 18 の「次へ」を押すと handleNext が対象要素を代行クリックしてメニューを開くが、
  // 元の nextBtn click が document までバブルした時点で
  //   ev.target = nextBtn → btn にも menu にも contains されない → "外側クリック" 判定
  // となってメニューが即座に閉じられ、step 19 のターゲット（メニュー内のボタン）が
  // display:none 下で getBoundingClientRect = (0,0,0,0) を返してコーチマークが
  // 画面左上に飛ぶ事象を引き起こす。
  //
  // coachmarkEl のバブル段階で propagation を止めることで、コーチマーク発のクリックが
  // app の document リスナーに到達しなくなり、メニューが閉じない。
  // 注: 進行制御 (windowClickGuardBound) は window の capture 段階で先行するため影響しない。
  // 注: コーチマーク内部のボタン (next/prev/skip/close) 自身のハンドラはターゲット段階で
  //     既に実行されてから coachmarkEl にバブルしてくるため、ここで停止しても動作する。
  coachmarkEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });

  const headerEl = document.createElement('div');
  headerEl.className = 'tutorial-coachmark__header';

  // #13: コーチマーク内 step-badge は廃止（進行バーへ一本化）。

  const titleEl = document.createElement('h2');
  titleEl.className = 'tutorial-coachmark__title';
  titleEl.id = 'tutorial-coachmark-title';
  headerEl.appendChild(titleEl);

  coachmarkEl.appendChild(headerEl);

  // 右上クローズボタン。スキップ動線が左下で気づかれにくいため独立して配置する。
  // 挙動は左下スキップと同等（onSkipConfirmCb 経由でスキップ確認モーダルを開く想定）。
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tutorial-coachmark__close';
  closeBtn.setAttribute('aria-label', 'チュートリアルを終了');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => onSkipConfirmCb && onSkipConfirmCb());
  coachmarkEl.appendChild(closeBtn);

  const bodyEl = document.createElement('p');
  bodyEl.className = 'tutorial-coachmark__body';
  bodyEl.id = 'tutorial-coachmark-body';
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
  // SR 利用者に本体ボタンとの役割差を伝える（視覚は塗り/枠線で区別するが色・形は読み上げられない）
  prevBtn.setAttribute('aria-label', 'チュートリアル: 戻る');
  prevBtn.addEventListener('click', () => onPrevCb && onPrevCb());
  footer.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tutorial-coachmark__next';
  nextBtn.textContent = '次へ';
  nextBtn.setAttribute('aria-label', 'チュートリアル: 次へ');
  nextBtn.addEventListener('click', () => {
    if (currentStep?.mode === 'user-action-bridge' && currentStep.completeButtonLabel) {
      onCompleteCb && onCompleteCb();
    } else {
      onNextCb && onNextCb();
    }
  });
  footer.appendChild(nextBtn);

  // 旧 .tutorial-coachmark__hint（「ハイライトされた箇所をクリックしてください」）は廃止。
  //   - body の指示文と内容が重複していた
  //   - 「次へ」常時表示化により、クリックは唯一の進行手段ではなくなった
  //   - スポットライト + ポインタ + body 指示文 + 常時の「次へ」で十分伝わる

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
  body.textContent = '終了すると、アカウント作成のご案内に進みます。途中まででもアカウント作成は可能です。';
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
  confirmBtn.textContent = '終了して登録に進む';
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

function buildWelcomeScreen(opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-welcome';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tutorial-welcome-title');

  const panel = document.createElement('div');
  panel.className = 'tutorial-welcome__panel';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'tutorial-welcome__eyebrow';
  eyebrow.textContent = opts.eyebrow || '展示会・イベント出展のご担当者さま向け';
  panel.appendChild(eyebrow);

  const title = document.createElement('h1');
  title.className = 'tutorial-welcome__title';
  title.id = 'tutorial-welcome-title';
  title.textContent = opts.title || 'ようこそ';
  panel.appendChild(title);

  // body は 2 行構成。1 行目はサービス説明、2 行目は体験予告。
  const bodyLead = document.createElement('p');
  bodyLead.className = 'tutorial-welcome__body tutorial-welcome__body--lead';
  bodyLead.textContent = opts.lead
    || 'SPEED ADは、展示会アンケートと名刺データ化をQR1枚で完結できるサービスです。'
    + 'QRを配るだけで、アンケート回答と名刺データ化が同時に完了します。';
  panel.appendChild(bodyLead);

  const bodyInvite = document.createElement('p');
  bodyInvite.className = 'tutorial-welcome__body tutorial-welcome__body--invite';
  bodyInvite.textContent = opts.invite || 'アンケート作成からQR発行までの基本フローを、数分で体験しましょう。';
  panel.appendChild(bodyInvite);

  // 開発中バージョンの注意書き。リリース版との差分を着手前に明示する。
  const devNotice = document.createElement('p');
  devNotice.className = 'tutorial-welcome__notice';
  devNotice.textContent =
    '※ チュートリアル内で表示している画面は現在開発中のバージョンです。'
    + '実際のリリース版とは一部の画面・項目が異なる場合があります。';
  panel.appendChild(devNotice);

  const actions = document.createElement('div');
  actions.className = 'tutorial-welcome__actions';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tutorial-welcome__skip';
  skipBtn.dataset.welcomeAction = 'skip';
  skipBtn.textContent = opts.skipLabel || 'サービス概要を見る';
  actions.appendChild(skipBtn);

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'tutorial-welcome__start';
  startBtn.dataset.welcomeAction = 'start';
  startBtn.textContent = '始める';
  actions.appendChild(startBtn);

  panel.appendChild(actions);

  // キーボードショートカットの案内。進行バーの note にも記載しているが、
  // 着手前にも気付けるよう welcome 画面でも明示する（actions の直下に控えめに）。
  const kbdHint = document.createElement('p');
  kbdHint.className = 'tutorial-welcome__kbd-hint';
  // DOM ファクトリ縛りのため kbd タグも createElement で組み立てる。
  kbdHint.appendChild(document.createTextNode('チュートリアル中は '));
  const kbdSpace = document.createElement('kbd');
  kbdSpace.className = 'tutorial-kbd';
  kbdSpace.textContent = 'Space';
  kbdHint.appendChild(kbdSpace);
  kbdHint.appendChild(document.createTextNode(' / '));
  const kbdEnter = document.createElement('kbd');
  kbdEnter.className = 'tutorial-kbd';
  kbdEnter.textContent = 'Enter';
  kbdHint.appendChild(kbdEnter);
  kbdHint.appendChild(document.createTextNode(' キーでも『次へ』に進めます。'));
  panel.appendChild(kbdHint);

  overlay.appendChild(panel);

  return overlay;
}

function buildAccountCtaScreen(variant = 'complete') {
  const isWelcomeSkip = variant === 'welcome-skip';
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-account-cta';
  if (isWelcomeSkip) overlay.classList.add('tutorial-account-cta--welcome-skip');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tutorial-account-cta-title');

  const panel = document.createElement('div');
  panel.className = 'tutorial-account-cta__panel';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'tutorial-account-cta__eyebrow';
  eyebrow.textContent = isWelcomeSkip ? 'SPEED ADでできること' : 'チュートリアル完了';
  panel.appendChild(eyebrow);

  const title = document.createElement('h1');
  title.className = 'tutorial-account-cta__title';
  title.id = 'tutorial-account-cta-title';
  title.textContent = 'アカウントを作成して、はじめましょう';
  panel.appendChild(title);

  const body = document.createElement('p');
  body.className = 'tutorial-account-cta__body';
  // ※ チュートリアル内の練習データはアカウントへ引き継がれない（誤解を避けるため
  // 「練習したもの」を実際に公開できる、といった表現は使わない）。
  // ※ コーチマーク body と同様に改行で意味のまとまりを切る。CSS の pre-line は
  //   .tutorial-account-cta__body にも別途付与する（下記 CSS 変更を参照）。
  body.textContent = isWelcomeSkip
    ? 'SPEED ADは、展示会アンケートと名刺データ化をQR1枚で完結できるサービスです。\n'
      + 'アカウントを作成すると、すぐに本番でご利用いただけます。'
    : 'ここまでがアンケート作成の基本フローです。\n'
      + 'アカウントを作成すると、ご自身でアンケートを作成・公開して回答を集められます。';
  panel.appendChild(body);

  // 機能の箇条書き。チェックマークは ::before で付与する。
  // complete: 「体験した機能」、welcome-skip: 「ご利用いただける機能」のニュアンス。
  const features = document.createElement('ul');
  features.className = 'tutorial-account-cta__features';
  const featureItems = [
    'QRコード発行',
    '名刺データ化',
    'お礼メールの自動送信',
    '回答完了画面（サンクス画面）のカスタマイズ',
    '回答結果の集計',
  ];
  featureItems.forEach((label) => {
    const li = document.createElement('li');
    li.textContent = label;
    features.appendChild(li);
  });
  panel.appendChild(features);

  const actions = document.createElement('div');
  actions.className = 'tutorial-account-cta__actions';

  // 「アカウントを作成」を先（左/上）に並べ、推奨アクションを目立たせる。
  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'tutorial-account-cta__create';
  createBtn.textContent = 'アカウントを作成';
  actions.appendChild(createBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tutorial-account-cta__close';
  closeBtn.textContent = 'あとで登録する';
  actions.appendChild(closeBtn);

  panel.appendChild(actions);

  // 不安解消note: actions の下に小さく表示する。
  const note = document.createElement('p');
  note.className = 'tutorial-account-cta__note';
  note.textContent = '登録は1分・クレジットカード不要・無料プランから始められます。';
  panel.appendChild(note);

  overlay.appendChild(panel);

  return overlay;
}

// ---------- 更新 ----------

function padStep(n) {
  return String(n).padStart(2, '0');
}

// ブロック表記マッピング。steps.js の step.block (A/B/C/D) を「Step N/4 ・ ラベル」表示に変換。
// 26という分母の数字を見せず、「あと何ブロックで終わる」感を直感的に伝える。
const BLOCK_LABELS = {
  A: { idx: 1, label: 'アンケート一覧' },
  B: { idx: 2, label: '基本情報の入力' },
  C: { idx: 3, label: '設問を組み立て' },
  D: { idx: 4, label: '配布準備と完了' },
};
const TOTAL_BLOCKS = 4;

function updateProgress(step) {
  // #13: 進捗表示は進行バーへ一本化。step.block に応じてブロック表記。
  if (progressStepLabelEl) {
    const meta = BLOCK_LABELS[step?.block] || { idx: 0, label: '' };
    progressStepLabelEl.textContent = meta.idx
      ? `Step ${meta.idx}/${TOTAL_BLOCKS} ・ ${meta.label}`
      : '';
  }
  if (progressFillEl) {
    // ゲージは細かいstep単位で滑らかに進める（全26step基準）。
    const pct = Math.min(100, Math.max(0, ((step?.id || 0) / totalSteps) * 100));
    progressFillEl.style.width = `${pct}%`;
  }
}

function updateMaskAndSpotlight(targetEl, contextEl = null) {
  const cutout = cutoutRectEl || maskEl?.querySelector('#tutorial-mask-cutout-rect');
  const contextCutout = contextCutoutRectEl || maskEl?.querySelector('#tutorial-mask-context-rect');
  if (!cutout || !spotlightEl) return;

  // contextEl の反映（targetEl の有無とは独立）。
  if (contextCutout) {
    if (contextEl) {
      const cRect = contextEl.getBoundingClientRect();
      const cx = Math.max(0, cRect.left - TARGET_PAD);
      const cy = Math.max(0, cRect.top - TARGET_PAD);
      const cw = cRect.width + TARGET_PAD * 2;
      const ch = cRect.height + TARGET_PAD * 2;
      contextCutout.setAttribute('x', String(cx));
      contextCutout.setAttribute('y', String(cy));
      contextCutout.setAttribute('width', String(cw));
      contextCutout.setAttribute('height', String(ch));
      if (contextSpotlightEl) {
        contextSpotlightEl.style.display = '';
        contextSpotlightEl.style.transition = `all ${POSITION_TRANSITION_MS}ms ease-out`;
        contextSpotlightEl.style.opacity = '1';
        contextSpotlightEl.style.left = `${cx}px`;
        contextSpotlightEl.style.top = `${cy}px`;
        contextSpotlightEl.style.width = `${cw}px`;
        contextSpotlightEl.style.height = `${ch}px`;
        contextSpotlightEl.style.borderRadius = `${SPOTLIGHT_RADIUS}px`;
      }
    } else {
      contextCutout.setAttribute('width', '0');
      contextCutout.setAttribute('height', '0');
      if (contextSpotlightEl) {
        contextSpotlightEl.style.opacity = '0';
        contextSpotlightEl.style.width = '0px';
        contextSpotlightEl.style.height = '0px';
        contextSpotlightEl.style.display = 'none';
      }
    }
  }

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

  // user-action 系ステップではスポットライト枠自体にリップル風アニメーションを付与し、
  // 「クリックしてください」の誘導をターゲットの中央に被せる青ドットなしで成立させる。
  const isUserAction = currentStep
    && (currentStep.mode === 'user-action' || currentStep.mode === 'user-action-bridge');
  spotlightEl.classList.toggle('tutorial-spotlight--clickable', !!isUserAction);
}

function updateCoachmark(step, targetEl) {
  if (!coachmarkEl) return;
  const titleEl = coachmarkEl.querySelector('.tutorial-coachmark__title');
  const bodyEl = coachmarkEl.querySelector('.tutorial-coachmark__body');
  const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
  const prevBtn = coachmarkEl.querySelector('.tutorial-coachmark__prev');

  // textContent のみ使用（仕様書 §10）
  if (titleEl) titleEl.textContent = step.title || '';
  if (bodyEl) bodyEl.textContent = step.body || '';
  // 注: title/body 個別のフェードは renderStep のコーチマーク全体フェードに統合（forced reflow削減）

  // 「次へ」ボタンは常に表示し、user-action 系でも「次へ次へ」で進めるようにする。
  // user-action / user-action-bridge では index.js の handleNext が代行クリックを行うことで
  // 本来のアクション（モーダルを開く・ページ遷移など）を発火させつつ進行を継続する。
  if (nextBtn) {
    nextBtn.style.display = '';
    const nextLabel = step.completeButtonLabel || '次へ';
    nextBtn.textContent = nextLabel;
    // 可視ラベルと同期（completeButtonLabel 時も SR にチュートリアル文脈を保つ）
    nextBtn.setAttribute('aria-label', `チュートリアル: ${nextLabel}`);
    // info / autofill では「次へ」が押すべき主導線なので注目グローを付ける。
    // user-action 系は画面内ボタンをスポットライトで示すため、ここは静かにして二重強調を避ける。
    const nextIsPrimary = step.mode === 'info' || step.mode === 'autofill';
    nextBtn.classList.toggle('tutorial-coachmark__next--primary', nextIsPrimary);
  }

  // 「戻る」は先頭以外で表示。M-2: ページ境界ステップ（step.hideBack）では非表示。
  if (prevBtn) {
    const showPrev = step.id > 1 && step.hideBack !== true;
    prevBtn.style.display = showPrev ? '' : 'none';
  }

  // 位置決め。#9: 本文セット直後は高さが未確定なため、
  // レイアウト確定後（次フレーム）に再度位置を計算してずれを補正する。
  positionCoachmark(step, targetEl);
  window.requestAnimationFrame(() => {
    if (currentStep === step) positionCoachmark(step, targetEl);
  });
}

// 指定 placement での吹き出し左上座標を計算する（クランプ前の素の値）。
function computeRawPosition(placement, rect, coachmarkW, coachmarkH, gap) {
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
  return { left, top };
}

// ターゲットがモーダル/ダイアログ内にある場合、吹き出しを重ねたくない「パネル本体」
// （ダイアログ内でターゲットを含む、全画面でない最外ノード = 実際のカード）を返す。
// モーダル外のターゲットでは null を返し、従来どおりターゲット基準で配置する。
function findDialogPanel(targetEl) {
  if (!targetEl || typeof targetEl.closest !== 'function') return null;
  const dialog = targetEl.closest('[role="dialog"], [aria-modal="true"]');
  if (!dialog) return null;
  let panel = null;
  let node = targetEl;
  while (node && node !== dialog) {
    const r = node.getBoundingClientRect();
    const nearFull = r.width >= window.innerWidth - 8 && r.height >= window.innerHeight - 8;
    if (r.width > 0 && r.height > 0 && !nearFull) panel = node;
    node = node.parentElement;
  }
  return panel;
}

// 2 つの矩形（left/top/width/height）が重なるか判定する。
function rectsOverlap(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function positionCoachmark(step, targetEl) {
  if (!coachmarkEl) return;
  const notch = coachmarkEl.querySelector('.tutorial-coachmark__notch');

  // center placement または target なしの場合は画面中央
  let placement = step.placement || 'bottom';
  if (placement === 'center' || !targetEl) {
    if (notch) {
      notch.dataset.placement = 'center';
      notch.style.display = 'none';
      notch.style.left = '';
      notch.style.top = '';
      notch.style.transform = '';
    }
    coachmarkEl.style.transition =
      `opacity ${COACHMARK_FADE_MS}ms ease-out, transform ${COACHMARK_FADE_MS}ms ease-out, ` +
      `left ${POSITION_TRANSITION_MS}ms ease-out, top ${POSITION_TRANSITION_MS}ms ease-out`;
    coachmarkEl.style.left = '50%';
    coachmarkEl.style.top = '50%';
    coachmarkEl.style.transform = 'translate(-50%, -50%)';
    return;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = targetEl.getBoundingClientRect();
  // ターゲットがモーダル/ダイアログ内なら、吹き出しがダイアログ本体に重ならないよう
  // 配置基準をパネル矩形にする（スポットライトは従来どおりターゲットに当たる）。
  const panelEl = findDialogPanel(targetEl);
  const baseRect = panelEl ? panelEl.getBoundingClientRect() : rect;
  const cmRect = coachmarkEl.getBoundingClientRect();
  // #8/#9: フォールバックを CSS 実寸（幅 400 / 高さ 200+）に合わせる。
  const coachmarkW = cmRect.width || COACHMARK_FALLBACK_W;
  const coachmarkH = cmRect.height || COACHMARK_FALLBACK_H;
  // ターゲットとコーチマーク間のクリアランス。
  // CONNECTOR_REACH(10) + スポットライト視覚エッジ(9: pad 4 + border 3 + outline 2) = 19
  // を上回るよう 26px とし、先端をスポットライト境界の外側で +7px 浮かせて被りを根絶する。
  const gap = 26;

  // #6: モバイル幅では right/left を不可とし bottom/top に倒す。
  // 対象が画面下寄り（下側に吹き出しが収まらない）なら top、それ以外は bottom。
  if (vw <= MOBILE_BREAKPOINT && (placement === 'right' || placement === 'left')) {
    const fitsBelow = rect.bottom + gap + coachmarkH <= vh - 8;
    placement = fitsBelow ? 'bottom' : 'top';
  }

  // #1: 候補 placement を順に試し、ターゲットと重ならず画面内に収まる配置を選ぶ。
  //   旧仕様は対面のみフォールバックしていたが、step 11-13 のように
  //   ターゲットが右側パネルかつ「左右いずれもコーチマーク幅 (400px) が入らない」
  //   状況では押し込みクランプで画面端に貼り付き、コネクタが対象を指さなくなっていた。
  //   そこで直交方向 (top/bottom ↔ left/right) もフォールバックに含めて、
  //   どこかで自然に収まる位置を見つけられるようにする。
  const fallbackOrder = {
    left:   ['left', 'right', 'bottom', 'top'],
    right:  ['right', 'left', 'bottom', 'top'],
    top:    ['top', 'bottom', 'right', 'left'],
    bottom: ['bottom', 'top', 'right', 'left'],
  };
  const candidates = (fallbackOrder[placement] || [placement]).slice();

  const targetBox = {
    left: baseRect.left,
    top: baseRect.top,
    width: baseRect.width,
    height: baseRect.height,
  };

  let chosen = null;
  let firstPos = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const cand = candidates[i];
    const pos = computeRawPosition(cand, baseRect, coachmarkW, coachmarkH, gap);
    if (i === 0) firstPos = { placement: cand, ...pos };
    const onScreen =
      pos.left >= 8 &&
      pos.left + coachmarkW <= vw - 8 &&
      pos.top >= 56 &&
      pos.top + coachmarkH <= vh - 8;
    const box = { left: pos.left, top: pos.top, width: coachmarkW, height: coachmarkH };
    if (onScreen && !rectsOverlap(box, targetBox)) {
      chosen = { placement: cand, ...pos };
      break;
    }
  }
  // どの候補も収まらない場合は最初の候補を使う（クランプで可能な限り見せる）。
  if (!chosen) chosen = firstPos;

  placement = chosen.placement;
  let { left, top } = chosen;

  if (notch) {
    notch.dataset.placement = placement;
    notch.style.display = '';
  }

  // G8/#25: 吹き出しの画面内クランプ。
  //   - top: 進行バー 48px + 余白 8px = 56px を下端。
  //     bottom placement はコネクタが上へ伸びるため、その分（CONNECTOR_REACH）下げて
  //     コネクタが進行バーへ食い込まないようにする。
  //   - left: 8px を左端、画面幅 - 幅 - 8px を右端。
  const topFloor = placement === 'bottom' ? 56 + CONNECTOR_REACH : 56;
  const clampedTop = Math.max(topFloor, Math.min(top, vh - coachmarkH - 8));
  const clampedLeft = Math.max(8, Math.min(left, vw - coachmarkW - 8));
  top = clampedTop;
  left = clampedLeft;

  coachmarkEl.style.transition =
    `opacity ${COACHMARK_FADE_MS}ms ease-out, transform ${COACHMARK_FADE_MS}ms ease-out, ` +
    `left ${POSITION_TRANSITION_MS}ms ease-out, top ${POSITION_TRANSITION_MS}ms ease-out`;
  coachmarkEl.style.transform = 'none';
  coachmarkEl.style.left = `${left}px`;
  coachmarkEl.style.top = `${top}px`;

  // #2: クランプで吹き出しがずれてもコネクタがターゲット中心を指すよう、JS で動的補正。
  adjustConnector(notch, placement, rect, left, top, coachmarkW, coachmarkH);
}

/**
 * #2: コネクタ（ノッチ）位置の動的補正。
 * CSS は left:50% 等の固定配置だが、クランプで吹き出しがずれるとターゲットを指さなくなる。
 * top/bottom placement は水平方向、left/right placement は垂直方向のオフセットを
 * 吹き出し座標基準に再計算し、ターゲット中心へ向ける。
 */
function adjustConnector(notch, placement, targetRect, cmLeft, cmTop, cmW, cmH) {
  if (!notch) return;
  const targetCx = targetRect.left + targetRect.width / 2;
  const targetCy = targetRect.top + targetRect.height / 2;
  const edgePad = 12; // コネクタが吹き出し角からはみ出さないための余白

  if (placement === 'top' || placement === 'bottom') {
    // 吹き出し内 X 座標としてターゲット中心を表現し、両端を edgePad でクランプ。
    let connLeft = targetCx - cmLeft;
    connLeft = Math.max(edgePad, Math.min(connLeft, cmW - edgePad));
    notch.style.left = `${connLeft}px`;
    notch.style.top = '';
    notch.style.transform = 'translateX(-50%)';
  } else {
    // left / right placement: 垂直方向を補正。
    let connTop = targetCy - cmTop;
    connTop = Math.max(edgePad, Math.min(connTop, cmH - edgePad));
    notch.style.top = `${connTop}px`;
    notch.style.left = '';
    notch.style.transform = 'translateY(-50%)';
  }
}

function updatePointer(step, targetEl) {
  // 青ドット＋同心円パルス（旧 .tutorial-pointer）はターゲット中央被り問題を避けるため
  // 右上寄せにしてみたものの違和感が残ったため、視線誘導は
  // `.tutorial-spotlight--clickable` のリップル（updateMaskAndSpotlight で付与）へ
  // 移管した。pointer 要素は DOM ファクトリの互換のため残置するが、常時非表示。
  if (!pointerEl) return;
  pointerEl.style.opacity = '0';
  pointerEl.style.pointerEvents = 'none';
}

/**
 * #3: コーチマーク内のフォーカス可能要素一覧を返す（display:none のものは除外）。
 */
function getCoachmarkFocusable() {
  if (!coachmarkEl) return [];
  const nodes = coachmarkEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  return Array.prototype.filter.call(nodes, (el) => {
    if (el.disabled) return false;
    if (el.style.display === 'none') return false;
    // 祖先まで遡って非表示でないか確認
    return el.offsetParent !== null || el === document.activeElement;
  });
}

/**
 * #3/#7: Tab / Shift+Tab を完全手動で循環させるフォーカストラップ。
 * コーチマーク内のフォーカス可能要素に加え、user-action ステップでは
 * ハイライト対象も循環に含め、キーボードのみのユーザーが対象を直接操作できるようにする。
 */
function handleCoachmarkTab(ev) {
  const focusable = getCoachmarkFocusable();
  // #7: user-action 系ステップではハイライト対象もタブ循環に含める。
  const isUserAction = currentStep
    && (currentStep.mode === 'user-action' || currentStep.mode === 'user-action-bridge');
  if (isUserAction && currentTargetEl && document.contains(currentTargetEl)) {
    // <label> 自身はフォーカス不可のため、紐づくフォームコントロール（checkbox 等）を
    // 循環に含める。スポットライトは見える <label>（スイッチ全体）に当てつつ、
    // キーボードフォーカスは実際に操作可能な control に渡す。
    const focusTargetEl = (currentTargetEl.tagName === 'LABEL' && currentTargetEl.control)
      ? currentTargetEl.control
      : currentTargetEl;
    if (focusable.indexOf(focusTargetEl) === -1) focusable.push(focusTargetEl);
  }
  if (focusable.length === 0) {
    // フォーカス可能要素が無ければコーチマーク本体に留める。
    ev.preventDefault();
    try { coachmarkEl.focus({ preventScroll: true }); } catch (_e) { /* noop */ }
    return;
  }
  // 完全手動循環: 常に next/prev を明示制御する。
  ev.preventDefault();
  const active = document.activeElement;
  let idx = focusable.indexOf(active);
  if (idx === -1) {
    // コーチマーク本体(tabindex=-1)等、リスト外にフォーカスがある場合は端から開始。
    idx = ev.shiftKey ? 0 : focusable.length - 1;
  }
  const nextIdx = ev.shiftKey
    ? (idx - 1 + focusable.length) % focusable.length
    : (idx + 1) % focusable.length;
  try { focusable[nextIdx].focus({ preventScroll: true }); } catch (_e) { /* noop */ }
}

/**
 * #3/#7: ステップ表示時の自動フォーカス。
 *   - 「次へ」ボタンが表示されていればそこへ（#7: 「スキップ」へ当たって誤離脱するのを防ぐ）。
 *   - user-action ステップで「次へ」非表示のときは「スキップ」を初期フォーカスせず、
 *     コーチマーク本体（tabindex=-1）へフォーカスする。
 */
function trapFocus() {
  if (!coachmarkEl) return;
  const nextBtn = coachmarkEl.querySelector('.tutorial-coachmark__next');
  let focusTarget = null;
  if (nextBtn && nextBtn.style.display !== 'none') {
    focusTarget = nextBtn;
  } else {
    focusTarget = coachmarkEl; // 安全な要素（スキップは避ける）
  }
  try { focusTarget.focus({ preventScroll: true }); } catch (_e) { /* noop */ }
}

// ---------- #3: 背後ページの inert 制御 ----------

/**
 * tutorial-root 以外の body 直下要素へ inert を付与し、背後ページを操作不能にする。
 * destroyOverlay で releaseBackgroundInert により確実に解除する。
 */
function applyBackgroundInert() {
  if (!rootEl || !document.body) return;
  const children = Array.prototype.slice.call(document.body.children);
  children.forEach((el) => {
    if (el === rootEl) return;
    if (el.hasAttribute('inert')) return; // 既に inert（多重付与の冪等化）
    if (inertedSiblings.indexOf(el) !== -1) return;
    el.setAttribute('inert', '');
    inertedSiblings.push(el);
  });
}

function releaseBackgroundInert() {
  inertedSiblings.forEach((el) => {
    if (el && el.removeAttribute) el.removeAttribute('inert');
  });
  inertedSiblings = [];
}

// ---------- #12: SR 通知 ----------

/**
 * ステップ遷移時にタイトル＋本文相当を aria-live 領域へ流し込み、SR に通知する。
 */
function announceStep(step) {
  if (!srLiveEl) return;
  const title = step.title || '';
  const body = step.body || '';
  const stepLabel = `ステップ ${padStep(step.id)} / ${padStep(totalSteps)}`;
  // 同一テキスト連続でも再通知されるよう一旦空にしてから設定する。
  srLiveEl.textContent = '';
  window.requestAnimationFrame(() => {
    if (!srLiveEl) return;
    srLiveEl.textContent = [stepLabel, title, body].filter(Boolean).join('。 ');
  });
}
