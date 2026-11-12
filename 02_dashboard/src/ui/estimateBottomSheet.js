/**
 * @file estimateBottomSheet.js
 * 1280px 未満で料金見積もりを「下部固定バー＋下からせり上がるシート」として扱うための開閉制御。
 * 見た目（位置・アニメーション）は service-top-style.css の .estimate-sheet* / .estimate-bar* が担う。
 */

const SHEET_MEDIA_QUERY = '(max-width: 1279.98px)';
const TEXT_ENTRY_SELECTOR = [
  'textarea',
  'input:not([type])',
  'input[type="text"]',
  'input[type="number"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="password"]',
  '[contenteditable="true"]'
].join(',');

/**
 * 下部バーと内訳シートを初期化します。
 * @param {object} [options] - 要素 ID の指定。
 * @param {string} [options.sheetId] - シート（内訳）の要素 ID。
 * @param {string} [options.barId] - 下部バーの要素 ID。
 * @param {string} [options.toggleId] - バー1行目のトグルボタンの ID。
 * @param {string} [options.closeId] - シートの閉じるボタンの ID。
 * @param {string} [options.scrimId] - 背景（半透明の黒）の要素 ID。
 * @param {string} [options.toggleLabelId] - トグルの文言（内訳／閉じる）を入れる要素の ID。
 * @param {string} [options.backgroundId] - シートを開いている間に操作不可にする背面要素の ID。
 * @returns {{open: Function, close: Function, isOpen: Function}|null} 制御用の関数。必要な要素が無ければ null。
 */
export function initEstimateBottomSheet({
  sheetId = 'estimateSheet',
  barId = 'estimateBar',
  toggleId = 'estimateSheetToggleBtn',
  closeId = 'estimateSheetCloseBtn',
  scrimId = 'estimateSheetScrim',
  toggleLabelId = 'estimateSheetToggleLabel',
  backgroundId = 'estimateSheetBackground'
} = {}) {
  const sheet = document.getElementById(sheetId);
  const bar = document.getElementById(barId);
  const toggleBtn = document.getElementById(toggleId);
  const closeBtn = document.getElementById(closeId);
  const scrim = document.getElementById(scrimId);
  const toggleLabel = document.getElementById(toggleLabelId);
  const background = document.getElementById(backgroundId);
  const toggleIcon = toggleBtn?.querySelector('.material-icons');

  if (!sheet || !bar || !toggleBtn || !closeBtn || !scrim) return null;
  if (sheet.dataset.estimateSheetBound === 'true') return null;
  sheet.dataset.estimateSheetBound = 'true';

  const sheetMedia = window.matchMedia(SHEET_MEDIA_QUERY);
  const dialogLabel = sheet.dataset.sheetLabel || '料金見積もり';
  let isSheetOpen = false;

  const isModalOpenOnTop = () => Boolean(
    document.querySelector('dialog[open]') ||
    document.querySelector('.modal-overlay[data-state="open"]')
  );

  const applyState = (nextOpen) => {
    isSheetOpen = nextOpen;
    sheet.classList.toggle('is-open', nextOpen);
    scrim.classList.toggle('is-visible', nextOpen);
    document.body.classList.toggle('estimate-sheet-open', nextOpen);
    toggleBtn.setAttribute('aria-expanded', String(nextOpen));
    toggleBtn.setAttribute('aria-label', nextOpen ? '料金見積もりの内訳を閉じる' : '料金見積もりの内訳を開く');
    if (toggleLabel) toggleLabel.textContent = nextOpen ? '閉じる' : '内訳';
    if (toggleIcon) toggleIcon.textContent = nextOpen ? 'expand_more' : 'expand_less';

    // 開いている間だけダイアログとして扱う（1280px 以上や閉じた状態では通常の領域）
    if (nextOpen) {
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-label', dialogLabel);
    } else {
      sheet.removeAttribute('role');
      sheet.removeAttribute('aria-modal');
      sheet.removeAttribute('aria-label');
    }

    // 背面（設定フォーム）はシートを開いている間は操作・読み上げの対象から外す
    if (background) {
      if (nextOpen) background.setAttribute('inert', '');
      else background.removeAttribute('inert');
    }
  };

  const open = () => {
    if (isSheetOpen || !sheetMedia.matches) return;
    applyState(true);
    // 開いたら閉じるボタンへフォーカスを移す（スクロール位置は動かさない）
    closeBtn.focus({ preventScroll: true });
  };

  const close = ({ restoreFocus = true } = {}) => {
    if (!isSheetOpen) return;
    const focusWasInSheet = sheet.contains(document.activeElement);
    applyState(false);
    // 閉じたらトグルへフォーカスを戻す（シートの外へ移っていた場合は動かさない）
    if (restoreFocus && (focusWasInSheet || document.activeElement === document.body)) {
      toggleBtn.focus({ preventScroll: true });
    }
  };

  toggleBtn.addEventListener('click', () => {
    if (isSheetOpen) close();
    else open();
  });
  closeBtn.addEventListener('click', () => close());
  scrim.addEventListener('click', () => close());

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isSheetOpen) return;
    // 注意事項モーダルや確認モーダルが前面にあるときは、そちらの Esc を優先する
    if (isModalOpenOnTop()) return;
    close();
  });

  // 1280px 以上になったら閉じて PC レイアウトへ戻す
  sheetMedia.addEventListener('change', (event) => {
    if (!event.matches) {
      close({ restoreFocus: false });
      bar.classList.remove('is-hidden-for-input');
    }
  });

  // テキスト入力中（ソフトキーボード表示中）はバーを隠し、フォーカスが外れたら戻す
  const isTextEntry = (element) => element instanceof Element && element.matches(TEXT_ENTRY_SELECTOR);
  document.addEventListener('focusin', (event) => {
    if (!sheetMedia.matches) return;
    bar.classList.toggle('is-hidden-for-input', isTextEntry(event.target));
  });
  document.addEventListener('focusout', (event) => {
    if (!isTextEntry(event.target)) return;
    // 次のフォーカス先が確定してから判定する（入力欄どうしの移動では隠したままにする）
    window.setTimeout(() => {
      if (!isTextEntry(document.activeElement)) bar.classList.remove('is-hidden-for-input');
    }, 0);
  });

  // バーの実際の高さを CSS 変数へ渡す（本文とシートの下端の余白に使う）
  const syncBarHeight = () => {
    const height = Math.ceil(bar.getBoundingClientRect().height);
    if (height > 0) document.documentElement.style.setProperty('--estimate-bar-height', `${height}px`);
  };
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncBarHeight).observe(bar);
  }
  window.addEventListener('resize', syncBarHeight);
  syncBarHeight();

  applyState(false);

  return { open, close, isOpen: () => isSheetOpen };
}
