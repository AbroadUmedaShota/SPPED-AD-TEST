/**
 * surveyCreation-v2.js
 * アンケート作成・編集 v2 ページ専用スクリプト
 */

import { loadCommonHtml, resolveDashboardAssetPath } from './utils.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { initializeDatepickers } from './ui/datepicker.js';
import { initHelpPopovers } from './ui/helpPopover.js';
import { initThemeToggle } from './lib/themeToggle.js';
import { handleOpenModal } from './modalHandler.js';
import { populateQrCodeModal } from './qrCodeModal.js';

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const map = {
    success: { cls: 'v2-toast--success', icon: 'check_circle' },
    error:   { cls: 'v2-toast--error',   icon: 'error' },
    warning: { cls: 'v2-toast--warning', icon: 'warning' },
    info:    { cls: 'v2-toast--info',    icon: 'info' },
  };
  const { cls, icon: iconName } = map[type] ?? map.info;
  const toast = document.createElement('div');
  toast.className = `v2-toast ${cls}`;
  const iconEl = document.createElement('span');
  iconEl.className = 'material-icons text-[18px]';
  iconEl.textContent = iconName;
  toast.append(iconEl, document.createTextNode(message));
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function trapFocus(modal, firstEl, lastEl) {
  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    } else {
      if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
  };
  modal.addEventListener('keydown', onKeydown);
  return () => modal.removeEventListener('keydown', onKeydown);
}

function showNotice(message, type = 'info') {
  const modal = document.getElementById('noticeModal');
  const iconEl = document.getElementById('noticeModalIcon');
  const titleEl = document.getElementById('noticeModalTitle');
  const bodyEl = document.getElementById('noticeModalBody');
  const okBtn = document.getElementById('noticeModalOk');
  if (!modal) return;

  const config = {
    success: { icon: 'check_circle', color: 'text-green-500', title: '完了' },
    error:   { icon: 'error',        color: 'text-red-500',   title: 'エラー' },
    warning: { icon: 'warning',      color: 'text-amber-500', title: '注意' },
    info:    { icon: 'info',         color: 'text-blue-500',  title: 'お知らせ' },
  }[type] ?? { icon: 'info', color: 'text-blue-500', title: 'お知らせ' };

  iconEl.className = `material-icons text-2xl flex-shrink-0 mt-0.5 ${config.color}`;
  iconEl.textContent = config.icon;
  titleEl.textContent = config.title;
  bodyEl.textContent = message;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const prevFocus = document.activeElement;
  okBtn.focus();

  const removeTrap = trapFocus(modal, okBtn, okBtn);

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    okBtn.removeEventListener('click', close);
    modal.removeEventListener('click', onBackdrop);
    modal.removeEventListener('keydown', onEscape);
    removeTrap();
    prevFocus?.focus();
  };
  const onBackdrop = (e) => { if (e.target === modal) close(); };
  const onEscape = (e) => { if (e.key === 'Escape') close(); };
  okBtn.addEventListener('click', close);
  modal.addEventListener('click', onBackdrop);
  modal.addEventListener('keydown', onEscape);
}

function showConfirm(title, message, okLabel, onOk) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const bodyEl = document.getElementById('confirmModalBody');
  const okBtn = document.getElementById('confirmModalOk');
  const cancelBtn = document.getElementById('confirmModalCancel');
  if (!modal) { if (confirm(message)) onOk(); return; }

  titleEl.textContent = title;
  bodyEl.textContent = message;
  okBtn.textContent = okLabel;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const prevFocus = document.activeElement;
  cancelBtn.focus();

  const removeTrap = trapFocus(modal, cancelBtn, okBtn);

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    okBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', close);
    modal.removeEventListener('click', onBackdrop);
    modal.removeEventListener('keydown', onEscape);
    removeTrap();
    prevFocus?.focus();
  };
  const onConfirm = () => { close(); onOk(); };
  const onBackdrop = (e) => { if (e.target === modal) close(); };
  const onEscape = (e) => { if (e.key === 'Escape') close(); };
  okBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', onBackdrop);
  modal.addEventListener('keydown', onEscape);
}

// ─────────────────────────────────────────
// グローバル＆定数定義
// ─────────────────────────────────────────
const QUESTION_TYPES = {
  free_answer:      { label: 'フリーアンサー',    icon: 'short_text' },
  single_answer:    { label: 'シングルアンサー',  icon: 'radio_button_checked' },
  multi_answer:     { label: 'マルチアンサー',    icon: 'check_box' },
  dropdown:         { label: 'ドロップダウン回答', icon: 'arrow_drop_down_circle' },
  number_answer:    { label: '数値回答',          icon: 'pin' },
  matrix_sa:        { label: 'マトリックス(SA)',  icon: 'view_list' },
  matrix_ma:        { label: 'マトリックス(MA)',  icon: 'grid_view' },
  date_time:        { label: '日付/時間',         icon: 'event' },
  handwriting:      { label: '手書きスペース',    icon: 'draw' },
  explanation_card: { label: '説明カード',        icon: 'info_outline' },
};

const CHOICE_TYPES = new Set(['single_answer', 'multi_answer', 'dropdown']);
const MATRIX_TYPES = new Set(['matrix_sa', 'matrix_ma']);

const SUPPORTED_LANGS = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: '中文(简体)' },
  { code: 'zh-TW', name: '中文(繁體)' },
  { code: 'vi', name: 'Tiếng Việt' }
];

let questions = [];     
let nextId = 1;

let isMultilingual = false;
let currentLangs = ['ja']; 
let activeLang = 'ja';

let sortables = {
  questions: null,
  langTabs: null,
  outline: null,
  options: {}
};

// 一度でも操作されたフィールドのみエラーを表示するための管理
const touchedFields = new Set();

// 入力イベントでバリデーション更新
document.addEventListener('input', (e) => {
  if (e.target.matches('input, textarea, select')) {
    if (e.target.id) touchedFields.add(e.target.id);
    updateOutline(); // updateTranslationBadges も内部で呼ばれる
  }
});

// ─────────────────────────────────────────
// 多言語設定処理
// ─────────────────────────────────────────

function ensureMultiLangInputExists(group, lang) {
  if (group.querySelector(`[data-lang="${lang}"]`)) return;
  const inputType = group.dataset.inputType;
  const labelText = group.dataset.label;
  const isRequired = group.dataset.required === "true";
  const parentId = group.dataset.fieldKey;
  
  const div = el('div', { class: 'input-group hidden', 'data-lang': lang });
  const idStr = `${parentId}_${lang}`;
  
  let inputEl;
  if(inputType === 'textarea') {
    inputEl = el('textarea', { id: idStr, placeholder: ' ', class: 'input-field h-20 resize-y', maxlength: '500' });
  } else {
    inputEl = el('input', { type: 'text', id: idStr, placeholder: ' ', class: 'input-field', maxlength: '100', required: isRequired });
  }
  
  const labelEl = el('label', { for: idStr, class: 'input-label' }, 
    labelText, 
    isRequired ? el('span', {class: 'text-error'}, '*') : null
  );

  div.append(inputEl, labelEl);
  group.appendChild(div);
}

function updateMultiLangVisibility() {
  // 単語タブのスタイル更新
  document.querySelectorAll('.lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === activeLang);
  });
  
  // input-groupの表示切り替え
  document.querySelectorAll('.multi-lang-input-group').forEach(group => {
    group.querySelectorAll('[data-lang]').forEach(langDiv => {
      langDiv.classList.toggle('hidden', langDiv.dataset.lang !== activeLang);
    });
  });
  
  // 設問における多言語切り替え
  document.querySelectorAll('[data-lang-wrapper]').forEach(wrapper => {
    wrapper.classList.toggle('hidden', wrapper.dataset.langWrapper !== activeLang);
  });
  updateTranslationBadges();
}

function renderLangSelectionAndTabs() {
  const panel = document.getElementById('languageSelectionPanel');
  const tabsContainer = document.getElementById('languageEditorTabsV2');
  if(!panel || !tabsContainer) return;

  // 選択パネル
  panel.innerHTML = '';
  panel.classList.add('flex', 'flex-wrap', 'gap-2', 'mb-2');
  SUPPORTED_LANGS.forEach(l => {
    const isSelected = currentLangs.includes(l.code);
    
    const btn = el('button', {
      type: 'button',
      class: `relative flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 overflow-hidden group outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary ${
        isSelected 
        ? 'bg-blue-50 text-blue-700 border-2 border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.3)] scale-100' 
        : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm scale-95 hover:scale-100 opacity-80 hover:opacity-100'
      }`,
      onclick: (e) => {
        if(isSelected) {
          if(currentLangs.length <= 1) {
            showToast('最低1つの言語を選択してください', 'warning');
            return;
          }
          currentLangs = currentLangs.filter(c => c !== l.code);
        } else {
          if(currentLangs.length >= 3) {
            showToast('第一言語含む選択可能言語数は3言語までです', 'warning');
            return;
          }
          currentLangs.push(l.code);
        }
        if(!currentLangs.includes(activeLang)) activeLang = currentLangs[0];
        renderLangSelectionAndTabs();
      }
    });

    const shine = el('div', { class: 'absolute inset-0 bg-gradient-to-tr from-white/0 via-white/50 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-full group-hover:translate-x-full duration-700 ease-in-out z-0' });
    
    const iconSpan = el('span', { 
      class: `material-icons text-[18px] relative z-10 transition-all duration-300 ease-out ${isSelected ? 'scale-100 rotate-0 text-blue-500' : 'scale-75 text-gray-300 opacity-50'}` 
    }, isSelected ? 'check_circle' : 'add_circle_outline');

    const txt = el('span', { class: 'relative z-10' }, l.name);

    btn.append(shine, iconSpan, txt);
    panel.appendChild(btn);
  });

  // タブ
  tabsContainer.innerHTML = '';
  currentLangs.forEach(langCode => {
    const langObj = SUPPORTED_LANGS.find(l => l.code === langCode);
    const tab = el('div', {
      class: `lang-tab ${langCode === activeLang ? 'active' : ''}`,
      'data-lang': langCode,
      onclick: () => {
        activeLang = langCode;
        updateMultiLangVisibility();
        updateOutline();
      }
    });

    const iconSpan = el('span', { class: 'material-icons text-[16px] opacity-70' }, 'translate');
    const txt = el('span', { class: 'truncate font-medium' }, langObj ? langObj.name : langCode);

    tab.append(iconSpan, txt);
    tabsContainer.appendChild(tab);
  });

  initLangTabsSortable();
  onLangsChanged(); 
}

function onLangsChanged() {
  // すべての multi-lang-input-group に現在選択されている言語の要素を確保
  document.querySelectorAll('.multi-lang-input-group').forEach(group => {
    currentLangs.forEach(lang => ensureMultiLangInputExists(group, lang));
  });
  
  // 設問の再レンダリング
  renderAllQuestions();
  updateMultiLangVisibility();
}

function initLangTabsSortable() {
  const container = document.getElementById('languageEditorTabsV2');
  if (!container || typeof Sortable === 'undefined') return;
  
  if (sortables.langTabs) sortables.langTabs.destroy();
  sortables.langTabs = new Sortable(container, {
    handle: '.lang-tab',
    animation: 150,
    group: 'language-tabs',
    onEnd: () => {
      const newOrder = [];
      container.querySelectorAll('.lang-tab').forEach(t => newOrder.push(t.dataset.lang));
      currentLangs = newOrder;
    }
  });
}

function initMultilingualToggle() {
  const toggle = document.getElementById('multilingualEnabledToggle');
  const controls = document.getElementById('multilingual-controls');
  const mainTabs = document.getElementById('mainAreaMultilingualTabs');
  if (!toggle || !controls) return;

  toggle.addEventListener('change', () => {
    isMultilingual = toggle.checked;
    controls.classList.toggle('hidden', !toggle.checked);
    if (mainTabs) {
      mainTabs.style.visibility = toggle.checked ? 'visible' : 'hidden';
    }
    const basicInfoBody = document.getElementById('basicInfoBody');
    basicInfoBody?.classList.toggle('rounded-tl-none', toggle.checked);
    basicInfoBody?.classList.toggle('rounded-tr-none', toggle.checked);
    document.body.classList.toggle('has-multi-lang-tabs', toggle.checked);

    if(!isMultilingual) {
      currentLangs = ['ja'];
      activeLang = 'ja';
      renderLangSelectionAndTabs();
    }
  });
}

function initLangTabWidthTracking() {
  const mainTabs     = document.getElementById('mainAreaMultilingualTabs');
  const basicInfo    = document.getElementById('basicInfoBody');
  const questionsCol = document.getElementById('questions-column');
  if (!mainTabs || !basicInfo || !questionsCol) return;

  // タブは sticky。貼り付き時だけ margin-left + width で幅・位置を追従させる。
  // margin-left を使うことで left/transform の循環計算バグを回避する。
  let rafId = null;

  function getHeaderH() {
    const headerEl = document.getElementById('header-placeholder')?.firstElementChild
                  || document.querySelector('header');
    return headerEl ? headerEl.offsetHeight : 64;
  }

  function updateTabPosition() {
    if (mainTabs.style.visibility !== 'visible') {
      reset();
      return;
    }

    const headerH   = getHeaderH();
    const tabsRect  = mainTabs.getBoundingClientRect();

    // sticky で貼り付いているか: top が headerH とほぼ一致
    const isStuck = Math.abs(tabsRect.top - headerH) < 4;

    if (!isStuck) {
      reset();
      return;
    }

    // 貼り付き時: タブの親要素の左端を基準に margin-left で位置補正
    const parentRect = mainTabs.parentElement.getBoundingClientRect();
    const basicRect  = basicInfo.getBoundingClientRect();
    const questRect  = questionsCol.getBoundingClientRect();
    const tabsH      = mainTabs.offsetHeight;

    const questVisible = questRect.top < headerH + tabsH + 40;
    const targetRect   = questVisible ? questRect : basicRect;

    mainTabs.style.marginLeft = (targetRect.left - parentRect.left) + 'px';
    mainTabs.style.width      = targetRect.width + 'px';
  }

  function reset() {
    mainTabs.style.marginLeft = '';
    mainTabs.style.width      = '';
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateTabPosition();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  const toggle = document.getElementById('multilingualEnabledToggle');
  if (toggle) {
    toggle.addEventListener('change', () => setTimeout(updateTabPosition, 50));
  }
}

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────
function generateId() {
  return `q_${Date.now()}_${nextId++}`;
}

function getTypeLabel(type) {
  return QUESTION_TYPES[type]?.label ?? type;
}

function defaultQuestion(type) {
  const base = { id: generateId(), type, text: { ja: '' }, required: false };
  if (CHOICE_TYPES.has(type)) {
    base.options = [{ja: '選択肢1'}, {ja: '選択肢2'}];
  }
  if (MATRIX_TYPES.has(type)) {
    base.matrixRows = [{ja: '行1'}, {ja: '行2'}];
    base.matrixCols = [{ja: '列1'}, {ja: '列2'}];
  }
  if (type === 'number_answer') {
    base.config = { min: '', max: '', unit: '', step: '' };
  }
  if (type === 'free_answer') {
    base.config = { minLength: '', maxLength: '' };
  }
  if (type === 'date_time') {
    base.config = { showDate: true, showTime: false };
  }
  if (type === 'handwriting') {
    base.config = { height: 200 };
  }
  if (type === 'explanation_card') {
    base.config = { description: {ja: ''} };
  }
  return base;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') {
      if (v) node.setAttribute(k, '');
      else node.removeAttribute(k);
    }
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function icon(name, extraClass = '') {
  return el('span', { class: `material-icons${extraClass ? ' ' + extraClass : ''}` }, name);
}

function smoothScrollTo(scrollable, targetY, duration = 400) {
  const start = scrollable.scrollTop;
  const diff = targetY - start;
  let startTime = null;
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function step(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    scrollable.scrollTop = start + diff * ease(progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function smoothScrollIntoView(el, block = 'center', duration = 400) {
  const scrollable = document.scrollingElement || document.documentElement;
  const rect = el.getBoundingClientRect();
  const scrollableRect = { top: 0, height: window.innerHeight };
  let targetY;
  if (block === 'center') {
    targetY = scrollable.scrollTop + rect.top - scrollableRect.height / 2 + rect.height / 2;
  } else {
    targetY = scrollable.scrollTop + rect.top - 80;
  }
  smoothScrollTo(scrollable, targetY, duration);
}

function smoothScrollIntoViewInPanel(panel, target, duration = 400) {
  const panelRect = panel.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offsetTop = panel.scrollTop + targetRect.top - panelRect.top - panelRect.height / 2 + targetRect.height / 2;
  smoothScrollTo(panel, offsetTop, duration);
}


// ─────────────────────────────────────────
// 設問リスト制御
// ─────────────────────────────────────────
function renumberQuestions() {
  const container = document.getElementById('questionListContainer');
  if (!container) return;
  const cards = container.querySelectorAll('[data-question-id]');
  cards.forEach((card, i) => {
    const numEl = card.querySelector('[data-question-number]');
    if (numEl) numEl.textContent = `Q${i + 1}`;
  });

  const newOrder = [];
  cards.forEach(card => {
    const q = questions.find(q => q.id === card.dataset.questionId);
    if (q) newOrder.push(q);
  });
  questions = newOrder;

  rebuildSeparators();
  updateOutline();
  updateEmptyState();
}

function updateEmptyState() {
  const container = document.getElementById('questionListContainer');
  const emptyMsg = document.getElementById('questionListEmpty');
  const inlineArea = document.getElementById('addQuestionInlineArea');
  const badge = document.getElementById('questionCountBadge');
  if (!container) return;
  const count = container.querySelectorAll('[data-question-id]').length;
  if (emptyMsg) emptyMsg.classList.toggle('hidden', count > 0);
  if (inlineArea) inlineArea.classList.toggle('hidden', count === 0);
  if (badge) badge.textContent = `${count}問`;
}

// ─────────────────────────────────────────
// バリデーション＆アウトラインパネル
// ─────────────────────────────────────────

function setFieldError(fieldId, hasError) {
  const showError = hasError && touchedFields.has(fieldId);
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (input) input.classList.toggle('input-error', showError);
  if (errorEl) errorEl.classList.toggle('hidden', !showError);
}

// ─────────────────────────────────────────
// 翻訳進捗
// ─────────────────────────────────────────

/**
 * 指定言語で未翻訳の項目数を返す。
 * 対象: multi-lang-input-group の入力値 + 各設問の text / options / matrixRows / matrixCols
 */
function countMissingForLang(lang) {
  let count = 0;

  // 基本情報のマルチ言語フィールド（displayTitle, description など）
  document.querySelectorAll('.multi-lang-input-group').forEach(group => {
    const input = group.querySelector(`[data-lang="${lang}"] input, [data-lang="${lang}"] textarea`);
    if (input && !input.value.trim()) count++;
  });

  // 設問
  questions.forEach(q => {
    if (!q.text?.[lang]?.trim()) count++;
    if (CHOICE_TYPES.has(q.type)) {
      (q.options || []).forEach(opt => { if (!opt[lang]?.trim()) count++; });
    }
    if (MATRIX_TYPES.has(q.type)) {
      (q.matrixRows || []).forEach(r => { if (!r[lang]?.trim()) count++; });
      (q.matrixCols || []).forEach(c => { if (!c[lang]?.trim()) count++; });
    }
  });

  return count;
}

/**
 * 指定設問・指定言語で未翻訳の項目数を返す（設問カードのバッジ用）
 */
function countMissingForQuestion(q, lang) {
  let count = 0;
  if (!q.text?.[lang]?.trim()) count++;
  if (CHOICE_TYPES.has(q.type)) {
    (q.options || []).forEach(opt => { if (!opt[lang]?.trim()) count++; });
  }
  if (MATRIX_TYPES.has(q.type)) {
    (q.matrixRows || []).forEach(r => { if (!r[lang]?.trim()) count++; });
    (q.matrixCols || []).forEach(c => { if (!c[lang]?.trim()) count++; });
  }
  return count;
}

/**
 * 言語タブの「未入力 N」バッジ & 設問カードの未翻訳バッジを更新する
 */
function updateTranslationBadges() {
  if (!isMultilingual) return;
  const extraLangs = currentLangs.slice(1); // 第一言語(ja)以外

  // 言語タブのバッジ
  document.querySelectorAll('#languageEditorTabsV2 .lang-tab[data-lang]').forEach(tab => {
    const lang = tab.dataset.lang;
    if (lang === currentLangs[0]) return;
    const count = countMissingForLang(lang);
    let badge = tab.querySelector('.translation-progress-badge');
    if (count > 0) {
      if (!badge) {
        badge = el('span', { class: 'translation-progress-badge' });
        tab.appendChild(badge);
      }
      badge.textContent = `未入力 ${count}`;
    } else if (badge) {
      badge.remove();
    }
  });

  // 設問カードの未翻訳バッジ
  // アクティブタブが追加言語のときだけ、その言語の未翻訳数を表示する
  const showLang = activeLang !== currentLangs[0] ? activeLang : null;
  questions.forEach(q => {
    const card = document.getElementById(`question-${q.id}`);
    if (!card) return;
    const missing = showLang ? countMissingForQuestion(q, showLang) : 0;
    let badge = card.querySelector('[data-untranslated-badge]');
    if (missing > 0) {
      if (!badge) {
        badge = el('span', {
          class: 'translation-progress-badge flex-shrink-0',
          'data-untranslated-badge': ''
        });
        const header = card.querySelector('.q-card-header');
        const deleteBtn = header?.querySelector('.v2-icon-btn--danger');
        if (deleteBtn) header.insertBefore(badge, deleteBtn);
      }
      badge.textContent = `未翻訳 ${missing}`;
    } else if (badge) {
      badge.remove();
    }
  });
}

function validateForm() {
  const surveyName = document.getElementById('surveyName_ja')?.value?.trim();
  const displayTitle = document.getElementById('displayTitle_ja')?.value?.trim();
  const periodRange = document.getElementById('periodRange')?.value?.trim();

  const nameErr = !surveyName;
  const titleErr = !displayTitle;
  const periodErr = !periodRange;

  setFieldError('surveyName_ja', nameErr);
  setFieldError('displayTitle_ja', titleErr);
  setFieldError('periodRange', periodErr);

  let hasBlocker = nameErr || titleErr || periodErr;
  if (questions.length === 0) hasBlocker = true;
  questions.forEach(q => {
    if (CHOICE_TYPES.has(q.type) && (!q.options || q.options.length < 2)) hasBlocker = true;
  });

  return !hasBlocker;
}

function updateSaveButtonState() {
  const valid = validateForm();
  document.getElementById('createSurveyBtn').disabled = !valid;
  const mobBtn = document.getElementById('createSurveyBtnMobile');
  if(mobBtn) mobBtn.disabled = !valid;
}

function checkValidationForSection(idOrFn) {
  if(idOrFn === 'basicInfoBody') {
    return !document.getElementById('surveyName_ja')?.value.trim() ||
           !document.getElementById('displayTitle_ja')?.value.trim() ||
           !document.getElementById('periodRange')?.value.trim();
  }
  return false;
}

function updateOutline() {
  const outlineList = document.getElementById('outline-questions-list');
  if (!outlineList) return;
  
  // Basic Settings Outline Dots
  document.querySelectorAll('#outline-map-list > a.outline-item').forEach(a => {
    const targetId = a.dataset.scrollTarget;
    const hasError = checkValidationForSection(targetId);
    let dot = a.querySelector('.error-dot');
    if(hasError) {
      if(!dot) a.appendChild(el('span', {class:'error-dot text-error mx-1 font-bold'}, '●'));
    } else {
      if(dot) dot.remove();
    }
  });

  const cards = document.getElementById('questionListContainer').querySelectorAll('[data-question-id]');
  outlineList.innerHTML = '';
  cards.forEach((card, i) => {
    const q = questions.find(q => q.id === card.dataset.questionId);
    const textStr = q.text?.[currentLangs[0]] || '設問文を入力してください';
    
    // Validate choice length
    let hasError = CHOICE_TYPES.has(q.type) && (!q.options || q.options.length < 2);
    if (!q.text?.[currentLangs[0]]) hasError = true;

    // 未翻訳チェック: 追加言語タブ表示中のみ、その言語の未翻訳数を表示
    const showLang = isMultilingual && activeLang !== currentLangs[0] ? activeLang : null;
    const totalMissing = showLang ? countMissingForQuestion(q, showLang) : 0;

    const a = el('a', {
      class: 'flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer text-xs outline-item',
      href: '#',
      'data-question-id': q.id,
      onclick: (e) => {
        e.preventDefault();
        smoothScrollIntoView(card, 'center');
      }
    },
      el('span', { class: `text-xs font-medium flex-shrink-0 ${hasError ? 'text-error' : 'text-primary'}` }, `Q${i + 1}`),
      el('span', { class: 'truncate' }, textStr)
    );
    if(hasError) {
      a.appendChild(el('span', {class:'text-error font-bold flex-shrink-0 ml-auto'}, '●'));
    } else if (totalMissing > 0) {
      a.appendChild(el('span', {
        class: 'flex-shrink-0 ml-auto w-2 h-2 rounded-full bg-red-500',
        title: `未翻訳 ${totalMissing}件`
      }));
    }
    outlineList.appendChild(a);
  });

  // アウトラインのドラッグ並び替え
  if (typeof Sortable !== 'undefined') {
    if (sortables.outline) sortables.outline.destroy();
    sortables.outline = new Sortable(outlineList, {
      animation: 150,
      ghostClass: 'dragging-item',
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        const container = document.getElementById('questionListContainer');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('[data-question-id]'));
        const moved = cards.splice(evt.oldIndex, 1)[0];
        cards.splice(evt.newIndex, 0, moved);
        cards.forEach(card => container.appendChild(card));
        renumberQuestions();
      }
    });
  }

  updateSaveButtonState();
  updateTranslationBadges();
}

// ─────────────────────────────────────────
// 設問カードの構築
// ─────────────────────────────────────────
function renderAllQuestions() {
  const container = document.getElementById('questionListContainer');
  if(!container) return;
  // 空状態表示は container 外に退避してから innerHTML をクリアする
  const emptyMsg = document.getElementById('questionListEmpty');
  container.innerHTML = '';
  if (emptyMsg) container.appendChild(emptyMsg);
  questions.forEach((q, idx) => {
    container.appendChild(buildQuestionCard(q, idx));
  });
  renumberQuestions(); // 内部で rebuildSeparators も呼ぶ
  updateMultiLangVisibility();
}

function buildQuestionCard(q, index) {
  const card = el('article', {
    class: 'question-card bg-white border border-gray-300/80 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-300 relative group overflow-hidden focus-within:ring-2 focus-within:ring-indigo-100',
    'data-question-id': q.id,
    'data-question-type': q.type,
    id: `question-${q.id}`
  });

  const decLineBorderColor = 'bg-gray-200 group-hover:bg-primary';
  const decLine = el('div', { class: `absolute left-0 top-0 bottom-0 w-1.5 ${decLineBorderColor} transition-colors z-10` });

  const header = el('div', { class: 'q-card-header flex items-center gap-3 px-5 py-4 cursor-pointer select-none bg-white relative z-0' });
  header.addEventListener('click', (e) => { if (!e.target.closest('button') && !e.target.closest('input')) toggleCard(card); });

  const handle = el('span', { class: 'material-icons text-gray-300 hover:text-gray-500 q-drag-handle flex-shrink-0 cursor-grab p-1 -ml-2 rounded hover:bg-gray-100 transition-colors', title: '並び替え' }, 'drag_indicator');
  
  const numEl = el('span', { class: 'text-sm font-black text-primary flex-shrink-0 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100', 'data-question-number': '' }, `Q${index + 1}`);
  
  // --- インラインポップオーバー式タイプ変更 ---
  const typeWrapper = el('div', { class: 'relative flex-shrink-0', style: 'z-index: 30;' });

  const typeBadge = el('span', {
    class: 'text-[11px] font-bold bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-gray-200 shadow-sm cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors',
    role: 'button',
    tabindex: '0',
    title: '設問タイプを変更',
    'aria-label': `設問タイプ: ${getTypeLabel(q.type)}（クリックで変更）`,
  },
    icon(QUESTION_TYPES[q.type]?.icon || 'help', 'text-[14px] opacity-70'),
    el('span', { 'data-type-badge-label': '' }, getTypeLabel(q.type)),
    icon('unfold_more', 'text-[12px] opacity-40 ml-0.5')
  );

  const typePopover = el('div', {
    class: 'hidden fixed bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-56',
    style: 'z-index: 9999;'
  });
  document.body.appendChild(typePopover);

  function buildTypePopoverContent(pendingType) {
    typePopover.innerHTML = '';
    const grid = el('div', { class: 'grid grid-cols-1 gap-1' });
    Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
      const isCurrent = type === q.type;
      const btn = el('button', {
        type: 'button',
        class: `flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors w-full text-left ${
          isCurrent
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 cursor-default'
            : 'border-transparent bg-transparent text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
        }`,
      },
        icon(def.icon, 'text-[14px] opacity-70'),
        def.label,
        ...(isCurrent ? [el('span', { class: 'ml-auto text-[9px] font-bold bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded' }, '現在')] : [])
      );
      if (!isCurrent) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const fromChoice = CHOICE_TYPES.has(q.type);
          const toChoice = CHOICE_TYPES.has(type);
          const fromMatrix = MATRIX_TYPES.has(q.type);
          const toMatrix = MATRIX_TYPES.has(type);
          const needsReset = !(fromChoice && toChoice) && !(fromMatrix && toMatrix);
          if (needsReset && (q.options?.length || q.matrixRows?.length)) {
            // 確認行を表示
            typePopover.innerHTML = '';
            const warn = el('p', { class: 'text-xs text-gray-600 mb-3 leading-snug' },
              `「${def.label}」に変更すると選択肢・詳細設定がリセットされます。`
            );
            const confirmRow = el('div', { class: 'flex gap-2' });
            const confirmBtn = el('button', { type: 'button', class: 'flex-1 bg-indigo-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-indigo-700 transition-colors' }, '変更する');
            const cancelBtn = el('button', { type: 'button', class: 'flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-1.5 rounded-lg hover:bg-gray-200 transition-colors' }, '戻る');
            confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); doTypeChange(type); });
            cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); buildTypePopoverContent(); });
            confirmRow.append(confirmBtn, cancelBtn);
            typePopover.append(warn, confirmRow);
          } else {
            doTypeChange(type);
          }
        });
      }
      grid.appendChild(btn);
    });
    typePopover.appendChild(grid);
  }

  function doTypeChange(newType) {
    applyTypeChange(q, card, newType);
    // バッジ表示を更新
    const labelEl = typeBadge.querySelector('[data-type-badge-label]');
    const iconEl = typeBadge.querySelector('.material-icons');
    if (labelEl) labelEl.textContent = getTypeLabel(newType);
    if (iconEl) iconEl.textContent = QUESTION_TYPES[newType]?.icon || 'help';
    closeTypePopover();
  }

  function positionPopover() {
    const rect = typeBadge.getBoundingClientRect();
    const popoverWidth = 224; // w-56
    let left = rect.right - popoverWidth;
    if (left < 8) left = 8;
    typePopover.style.top = `${rect.bottom + 4}px`;
    typePopover.style.left = `${left}px`;
  }

  function closeTypePopover() {
    typePopover.classList.add('hidden');
    document.removeEventListener('click', onOutsideClick, true);
    window.removeEventListener('scroll', closeTypePopover, true);
    window.removeEventListener('resize', closeTypePopover);
  }

  function onOutsideClick(e) {
    if (!typeWrapper.contains(e.target) && !typePopover.contains(e.target)) closeTypePopover();
  }

  typeBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!typePopover.classList.contains('hidden')) { closeTypePopover(); return; }
    buildTypePopoverContent();
    positionPopover();
    typePopover.classList.remove('hidden');
    document.addEventListener('click', onOutsideClick, true);
    window.addEventListener('scroll', closeTypePopover, true);
    window.addEventListener('resize', closeTypePopover);
  });
  typeBadge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); typeBadge.click(); }
    if (e.key === 'Escape') closeTypePopover();
  });

  typeWrapper.append(typeBadge);
  const typeLabel = typeWrapper; // 既存の参照名を維持

  const reqBg = q.required ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-400';
  const requiredBadge = el('span', {
    class: `text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 cursor-pointer select-none transition-colors border shadow-sm ${reqBg}`,
    'data-required-badge': '',
    role: 'button',
    tabindex: '0',
    title: '必須/任意を切り替え',
    'aria-label': q.required ? '必須（クリックで任意に変更）' : '任意（クリックで必須に変更）',
    'aria-pressed': String(q.required),
  }, q.required ? '必須' : '任意');

  const summaryText = el('p', { class: 'text-sm font-bold text-gray-800 truncate flex-1 min-w-0 px-2', 'data-question-summary-text': '' }, q.text[currentLangs[0]] || '設問文を入力してください');

  const actionGroup = el('div', { class: 'flex items-center gap-1 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity' });

  const duplicateBtn = el('button', { type: 'button', class: 'w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors', title: '設問を複製', onclick: (e) => { e.stopPropagation(); duplicateQuestion(q.id); } }, icon('content_copy', 'text-[18px]'));

  const deleteBtn = el('button', { type: 'button', class: 'w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors', title: '設問を削除', onclick: (e) => { e.stopPropagation(); deleteQuestion(q.id); } }, icon('delete_outline', 'text-[18px]'));

  actionGroup.append(duplicateBtn, deleteBtn);

  function syncRequired(val) {
    q.required = val;
    const newBg = q.required ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-400';
    requiredBadge.className = `text-[11px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 cursor-pointer select-none transition-colors border shadow-sm ${newBg}`;
    requiredBadge.textContent = q.required ? '必須' : '任意';
    requiredBadge.setAttribute('aria-label', q.required ? '必須（クリックで任意に変更）' : '任意（クリックで必須に変更）');
    requiredBadge.setAttribute('aria-pressed', String(q.required));
  }

  requiredBadge.addEventListener('click', (e) => { e.stopPropagation(); syncRequired(!q.required); });
  requiredBadge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); syncRequired(!q.required); } });

  const toggleIcon = icon('expand_more', 'text-[24px] transition-transform duration-300 text-gray-400 group-hover:text-primary');
  toggleIcon.style.transform = 'rotate(180deg)';
  const toggleBtn = el('button', { type: 'button', class: 'w-8 h-8 rounded-full flex items-center justify-center hover:bg-indigo-50 text-gray-600 ml-1 transition-colors', 'data-toggle-btn': '', onclick: (e) => { e.stopPropagation(); toggleCard(card); } }, toggleIcon);

  header.append(handle, numEl, summaryText, actionGroup, toggleBtn);

  const detail = el('div', { class: 'q-card-detail border-t border-gray-100 bg-gray-50/30', 'data-detail-panel': '' });
  detail.appendChild(buildBasicSection(q, card, requiredBadge));

  const ansSec = buildAnswerSection(q, typeLabel);
  if (ansSec) detail.appendChild(ansSec);
  detail.appendChild(buildAdvancedSection(q));

  card.append(decLine, header, detail);
  return card;
}

function toggleCard(card) {
  const detail = card.querySelector('[data-detail-panel]');
  const toggleIcon = card.querySelector('[data-toggle-btn] .material-icons');
  if (!detail) return;
  const isOpen = !detail.classList.contains('hidden');
  detail.classList.toggle('hidden', isOpen);
  if (toggleIcon) toggleIcon.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function buildBasicSection(q, cardNode, requiredBadge) {
  const section = el('section', { class: 'px-5 py-4 space-y-4' });
  const sectionHeader = el('div', { class: 'flex items-center gap-2' });
  sectionHeader.appendChild(el('h4', { class: 'text-sm font-bold text-gray-700 flex items-center gap-1.5' }, icon('edit_note', 'text-[18px] text-gray-400'), '基本設定'));
  sectionHeader.appendChild(requiredBadge);
  section.appendChild(sectionHeader);

  const firstLang = currentLangs[0];
  currentLangs.forEach((lang) => {
    const isFirst = lang === firstLang;
    const input = el('input', {
      type: 'text', class: 'input-field w-full bg-white font-bold text-sm', placeholder: ' ',
      value: q.text[lang] || '',
      oninput: (e) => {
        if (!q.text) q.text = {};
        q.text[lang] = e.target.value;
        if (isFirst) {
          const sum = cardNode.querySelector('[data-question-summary-text]');
          if (sum) sum.textContent = e.target.value || '設問文を入力してください';
          section.querySelectorAll('[data-ref-hint]').forEach(hint => {
            hint.textContent = e.target.value || '';
            hint.classList.toggle('hidden', !e.target.value);
          });
          updateOutline();
        } else {
          updateTranslationBadges();
        }
      }
    });
    const group = el('div', { class: 'input-group mb-0' });
    group.append(input, el('label', { class: 'input-label bg-transparent' }, `設問文 (${lang})`));
    const wrapper = el('div', { 'data-lang-wrapper': lang }, group);
    if (!isFirst) {
      const refText = q.text[firstLang] || '';
      const hint = el('p', {
        class: `ref-lang-hint${refText ? '' : ' hidden'}`,
        'data-ref-hint': ''
      }, refText);
      wrapper.appendChild(hint);
    }
    section.appendChild(wrapper);
  });

  return section;
}

function buildAnswerSection(q, typeLabel) {
  if (CHOICE_TYPES.has(q.type)) return buildChoiceSection(q, typeLabel);
  if (MATRIX_TYPES.has(q.type)) return buildMatrixSection(q, typeLabel);
  const section = el('section', {class: 'px-5 pb-5 border-t border-gray-100 pt-4'});
  const hdr = el('div', {class: 'flex items-center justify-between gap-2 mb-3'});
  hdr.appendChild(el('h4', {class: 'text-sm font-bold text-gray-700 flex items-center gap-1.5'}, icon('tune', 'text-[18px] text-gray-400'), '回答設定'));
  if (typeLabel) hdr.appendChild(typeLabel);
  section.appendChild(hdr);
  section.appendChild(el('div', {class: 'bg-white border border-gray-200 rounded-xl p-4 text-center'}, el('p', {class: 'text-xs text-gray-500 font-bold'}, `${getTypeLabel(q.type)}の回答設定`)));
  return section;
}

function buildChoiceSection(q, typeLabel) {
  const section = el('section', { class: 'px-5 pb-5 space-y-4 border-t border-gray-100 pt-4' });
  const hdr = el('div', { class: 'flex items-center justify-between gap-2' });
  hdr.appendChild(el('h4', { class: 'text-sm font-bold text-gray-700 flex items-center gap-1.5' }, icon('list_alt', 'text-[18px] text-gray-400'), '選択肢設定'));
  if (typeLabel) hdr.appendChild(typeLabel);
  section.appendChild(hdr);

  const optionsList = el('div', { class: 'space-y-2.5', id: `options-list-${q.id}` });
  (q.options || []).forEach((opt, idx) => {
    optionsList.appendChild(buildOptionRow(q, idx, opt));
  });
  section.appendChild(optionsList);

  const addBtn = el('button', {
    type: 'button',
    class: 'inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-500 hover:border-primary hover:text-primary hover:bg-indigo-50 transition-colors mt-3 w-full sm:w-auto shadow-sm',
    onclick: () => {
      if (!q.options) q.options = [];
      const newOpt = {};
      currentLangs.forEach(l => newOpt[l] = `選択肢${q.options.length + 1}`);
      q.options.push(newOpt);
      const row = buildOptionRow(q, q.options.length - 1, newOpt);
      optionsList.appendChild(row);
      updateMultiLangVisibility();
    }
  }, icon('add', 'text-[18px]'), '選択肢を追加');
  section.appendChild(addBtn);

  setTimeout(() => {
    if(sortables.options[q.id]) sortables.options[q.id].destroy();
    sortables.options[q.id] = new Sortable(optionsList, {
      handle: '.option-drag-handle',
      animation: 100,
      ghostClass: 'opacity-50',
      group: `options-${q.id}`,
      onEnd: () => {
        const newOpts = [];
        optionsList.querySelectorAll('[data-option-index]').forEach(row => {
          const oldIdx = parseInt(row.dataset.optionIndex, 10);
          newOpts.push(q.options[oldIdx]);
        });
        q.options = newOpts;
        optionsList.querySelectorAll('[data-option-index]').forEach((row, i) => {
          row.dataset.optionIndex = i;
        });
        updateOutline();
      }
    });
  }, 100);

  return section;
}

function buildOptionRow(q, idx, optValObj) {
  const row = el('div', { class: 'flex items-center gap-2 group/opt', 'data-option-index': idx });
  const handle = el('span', { class: 'material-icons text-gray-300 hover:text-gray-500 cursor-grab text-[20px] flex-shrink-0 option-drag-handle px-1 py-2 hover:bg-gray-100 rounded transition-colors' }, 'drag_indicator');

  const inputsWrap = el('div', { class: 'flex-1 space-y-1.5' });
  const firstLangOpt = currentLangs[0];
  currentLangs.forEach(lang => {
    const isFirst = lang === firstLangOpt;
    const wrap = el('div', {'data-lang-wrapper': lang});
    const input = el('input', {
      type: 'text',
      class: 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm hover:border-gray-300 transition-colors',
      value: optValObj[lang] || '',
      placeholder: `選択肢 (${lang})`,
      oninput: (e) => {
        const curIdx = parseInt(row.dataset.optionIndex,10);
        if(q.options[curIdx]) q.options[curIdx][lang] = e.target.value;
        if (isFirst) {
          inputsWrap.querySelectorAll('[data-ref-hint]').forEach(hint => {
            hint.textContent = e.target.value || '';
            hint.classList.toggle('hidden', !e.target.value);
          });
        } else {
          updateTranslationBadges();
        }
      }
    });
    if (!isFirst) {
      const refText = optValObj[firstLangOpt] || '';
      const hint = el('p', {
        class: `ref-lang-hint${refText ? '' : ' hidden'}`,
        'data-ref-hint': ''
      }, refText);
      wrap.appendChild(input);
      wrap.appendChild(hint);
    } else {
      wrap.appendChild(input);
    }
    inputsWrap.appendChild(wrap);
  });

  const deleteBtn = el('button', {
    type: 'button',
    class: 'w-9 h-9 flex items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0 opacity-0 group-hover/opt:opacity-100 focus:opacity-100',
    onclick: () => {
      const parent = row.parentNode;
      if (parent.children.length <= 1) {
        showToast('選択肢は最低1つ必要です', 'warning'); return;
      }
      const curIdx = parseInt(row.dataset.optionIndex,10);
      q.options.splice(curIdx, 1);
      row.remove();
      parent.querySelectorAll('[data-option-index]').forEach((r, i) => r.dataset.optionIndex = i);
      updateOutline();
    }
  }, icon('close', 'text-[20px]'));

  row.append(handle, inputsWrap, deleteBtn);
  return row;
}

function buildMatrixSection(q, typeLabel) {
  const section = el('section', { class: 'px-5 pb-5 space-y-5 border-t border-gray-100 pt-4' });
  const hdr = el('div', { class: 'flex items-center justify-between gap-2' });
  hdr.appendChild(el('h4', { class: 'text-sm font-bold text-gray-700 flex items-center gap-1.5' }, icon('grid_on', 'text-[18px] text-gray-400'), 'マトリックス設定'));
  if (typeLabel) hdr.appendChild(typeLabel);
  section.appendChild(hdr);

  section.appendChild(buildMatrixList(q, 'rows', '行'));
  section.appendChild(buildMatrixList(q, 'cols', '列'));

  return section;
}

function buildMatrixList(q, key, label) {
  const fieldKey = key === 'rows' ? 'matrixRows' : 'matrixCols';
  const wrap = el('div', { class: 'space-y-3 bg-white border border-gray-100 p-4 rounded-xl shadow-sm' });
  wrap.appendChild(el('p', { class: 'text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 inline-block rounded-md border border-gray-200' }, `${label}ラベル`));

  const list = el('div', { class: 'space-y-2', 'data-matrix-list': fieldKey });
  (q[fieldKey] || []).forEach((vObj, i) => list.appendChild(buildMatrixRow(q, fieldKey, i, vObj)));
  wrap.appendChild(list);

  const addBtn = el('button', {
    type: 'button',
    class: 'text-sm text-primary font-bold flex items-center gap-1 hover:text-blue-700 transition-colors mt-2 p-1 rounded hover:bg-indigo-50',
    onclick: () => {
      if (!q[fieldKey]) q[fieldKey] = [];
      const newObj = {};
      currentLangs.forEach(l => newObj[l] = `${label}${q[fieldKey].length + 1}`);
      q[fieldKey].push(newObj);
      list.appendChild(buildMatrixRow(q, fieldKey, q[fieldKey].length - 1, newObj));
      updateMultiLangVisibility();
    }
  }, icon('add_circle_outline', 'text-[18px]'), `${label}を追加`);
  wrap.appendChild(addBtn);
  return wrap;
}

function buildMatrixRow(q, fieldKey, idx, valObj) {
  const row = el('div', { class: 'flex items-center gap-2 group/mat', 'data-matrix-row': idx });
  
  const inputsWrap = el('div', { class: 'flex-1 space-y-1.5' });
  const firstLangMat = currentLangs[0];
  currentLangs.forEach(lang => {
    const isFirst = lang === firstLangMat;
    const wrap = el('div', {'data-lang-wrapper': lang});
    const input = el('input', {
      type: 'text',
      class: 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors',
      value: valObj[lang] || '',
      placeholder: `ラベル (${lang})`,
      oninput: (e) => {
        const curIdx = parseInt(row.dataset.matrixRow,10);
        if(q[fieldKey] && q[fieldKey][curIdx]) q[fieldKey][curIdx][lang] = e.target.value;
        if (isFirst) {
          inputsWrap.querySelectorAll('[data-ref-hint]').forEach(hint => {
            hint.textContent = e.target.value || '';
            hint.classList.toggle('hidden', !e.target.value);
          });
        } else {
          updateTranslationBadges();
        }
      }
    });
    if (!isFirst) {
      const refText = valObj[firstLangMat] || '';
      const hint = el('p', {
        class: `ref-lang-hint${refText ? '' : ' hidden'}`,
        'data-ref-hint': ''
      }, refText);
      wrap.appendChild(input);
      wrap.appendChild(hint);
    } else {
      wrap.appendChild(input);
    }
    inputsWrap.appendChild(wrap);
  });

  const delBtn = el('button', {
    type: 'button',
    class: 'w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0 opacity-0 group-hover/mat:opacity-100 focus:opacity-100',
    onclick: () => {
      const parentList = row.parentNode;
      if (parentList.children.length <= 1) { showToast('最低1つ必要です', 'warning'); return; }
      const curIdx = parseInt(row.dataset.matrixRow, 10);
      if (q[fieldKey]) q[fieldKey].splice(curIdx, 1);
      row.remove();
      parentList.querySelectorAll('[data-matrix-row]').forEach((r, i) => r.dataset.matrixRow = i);
    }
  }, icon('close', 'text-[18px]'));
  row.append(inputsWrap, delBtn);
  return row;
}

function buildAdvancedSection(q) {
  const section = el('section', { class: 'px-5 py-4 border-t border-gray-100 bg-gray-100/50 flex flex-col items-center justify-center' });

  const toggleBtn = el('button', {
    type: 'button',
    class: 'flex items-center justify-center gap-2 text-sm font-bold text-gray-500 hover:text-primary bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-full transition-all hover:shadow-md w-full sm:w-auto',
    'aria-expanded': 'false',
    onclick: (e) => {
      const panel = section.querySelector('[data-jump-panel]');
      const isOpen = e.currentTarget.getAttribute('aria-expanded') === 'true';
      e.currentTarget.setAttribute('aria-expanded', String(!isOpen));
      panel?.classList.toggle('hidden', isOpen);
      const ic = e.currentTarget.querySelector('.material-icons:last-child');
      if (ic) ic.style.transform = isOpen ? 'rotate(-180deg)' : 'rotate(0deg)';
    }
  },
    icon('tune', 'text-[18px] opacity-70'),
    '高度設定（条件分岐等）',
    icon('expand_more', 'text-[20px] transition-transform duration-300 opacity-50 ml-2')
  );

  const panel = el('div', { class: 'hidden mt-4 space-y-2 w-full', 'data-jump-panel': '' });
  panel.appendChild(el('p', { class: 'text-xs text-gray-500 text-center flex items-center justify-center gap-1' }, icon('lock', 'text-[14px]'), 'この設問の回答に応じてジャンプ先を設定できます。（プレミアム機能）'));

  section.append(toggleBtn, panel);
  return section;
}

// ─────────────────────────────────────────
// 設問タイプ変更ダイアログ
// ─────────────────────────────────────────
function showTypeChangeDialog(q, card) {
  const dialog = document.getElementById('questionTypeChangeDialog');
  const grid = document.getElementById('typeChangeGrid');
  const confirmPhase = document.getElementById('typeChangeConfirmPhase');
  const warningText = document.getElementById('typeChangeWarningText');
  const confirmBtn = document.getElementById('typeChangeConfirm');
  const cancelBtn = document.getElementById('typeChangeCancel');
  const closeBtn = document.getElementById('typeChangeClose');
  if (!dialog || !grid) return;

  // 初期化
  grid.innerHTML = '';
  confirmPhase.classList.add('hidden');
  let pendingType = null;

  // タイプ選択グリッドを生成
  Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
    const isCurrent = type === q.type;
    const btn = el('button', {
      type: 'button',
      class: `flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
        isCurrent
          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 cursor-default ring-2 ring-indigo-200'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700'
      }`,
      ...(isCurrent ? { 'aria-current': 'true' } : {}),
    },
      icon(def.icon, 'text-base opacity-70'),
      def.label,
      ...(isCurrent ? [el('span', { class: 'ml-auto text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded' }, '現在')] : [])
    );

    if (!isCurrent) {
      btn.addEventListener('click', () => {
        pendingType = type;

        // 警告テキスト生成
        const fromChoice = CHOICE_TYPES.has(q.type);
        const toChoice = CHOICE_TYPES.has(type);
        const fromMatrix = MATRIX_TYPES.has(q.type);
        const toMatrix = MATRIX_TYPES.has(type);

        let warn = `「${QUESTION_TYPES[q.type].label}」から「${def.label}」に変更します。`;
        if (fromChoice && toChoice) {
          warn += '選択肢はそのまま引き継がれます。';
        } else if (fromMatrix && toMatrix) {
          warn += '行・列の設定はそのまま引き継がれます。';
        } else {
          warn += '入力済みの選択肢・詳細設定はリセットされます。';
        }

        warningText.textContent = warn;

        // ボタンのハイライト更新
        grid.querySelectorAll('button').forEach(b => b.classList.remove('ring-2', 'ring-indigo-300', 'border-indigo-400', 'bg-indigo-50', 'text-indigo-700'));
        btn.classList.add('ring-2', 'ring-indigo-300', 'border-indigo-400', 'bg-indigo-50', 'text-indigo-700');

        confirmPhase.classList.remove('hidden');
        confirmBtn.focus();
      });
    }
    grid.appendChild(btn);
  });

  dialog.classList.remove('hidden');
  dialog.classList.add('flex');
  const prevFocus = document.activeElement;

  const close = () => {
    dialog.classList.add('hidden');
    dialog.classList.remove('flex');
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', close);
    closeBtn.removeEventListener('click', close);
    dialog.removeEventListener('click', onBackdrop);
    dialog.removeEventListener('keydown', onEscape);
    prevFocus?.focus();
  };

  const onConfirm = () => {
    if (!pendingType) return;
    applyTypeChange(q, card, pendingType);
    close();
  };

  const onBackdrop = (e) => { if (e.target === dialog) close(); };
  const onEscape = (e) => { if (e.key === 'Escape') close(); };

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', onBackdrop);
  dialog.addEventListener('keydown', onEscape);
}

function applyTypeChange(q, card, newType) {
  const oldType = q.type;
  const fromChoice = CHOICE_TYPES.has(oldType);
  const toChoice = CHOICE_TYPES.has(newType);
  const fromMatrix = MATRIX_TYPES.has(oldType);
  const toMatrix = MATRIX_TYPES.has(newType);

  // タイプを更新
  q.type = newType;

  // データの引き継ぎ/リセット
  if (fromChoice && toChoice) {
    // 選択肢系→選択肢系: 選択肢をそのまま保持
  } else if (fromMatrix && toMatrix) {
    // マトリックス同士: 行・列をそのまま保持
  } else {
    // それ以外: 不要なデータを削除し、新タイプのデフォルトを適用
    delete q.options;
    delete q.matrixRows;
    delete q.matrixCols;
    delete q.config;

    const defaults = defaultQuestion(newType);
    if (defaults.options)     q.options     = defaults.options;
    if (defaults.matrixRows)  q.matrixRows  = defaults.matrixRows;
    if (defaults.matrixCols)  q.matrixCols  = defaults.matrixCols;
    if (defaults.config)      q.config      = defaults.config;
  }

  // カードを差し替え
  const container = document.getElementById('questionListContainer');
  if (!container) return;
  const idx = questions.findIndex(item => item.id === q.id);
  const newCard = buildQuestionCard(q, idx < 0 ? 0 : idx);
  card.replaceWith(newCard);
  renumberQuestions();
  updateMultiLangVisibility();

  showToast(`設問タイプを「${QUESTION_TYPES[newType].label}」に変更しました`, 'success');
}

// ─────────────────────────────────────────
// 追加・削除・複製・Sortable
// ─────────────────────────────────────────

/**
 * 設問と設問の間に表示する「ここに追加」セパレーター
 * insertIndex: このインデックスの位置（前のカードの直後）に挿入するセパレーター
 */
function buildInsertSeparator(insertIndex) {
  const sep = el('div', {
    class: 'insert-separator',
    'data-insert-index': String(insertIndex),
    'aria-hidden': 'true'
  });

  const line = el('div', { class: 'insert-separator__line' });

  const btn = el('button', {
    type: 'button',
    class: 'insert-separator__btn',
    title: 'ここに設問を追加',
  },
    icon('add', 'text-[14px]'),
    'ここに追加'
  );

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openInsertTypeMenu(btn, insertIndex);
  });

  sep.append(line, btn);
  return sep;
}

/** セパレーターのタイプ選択ポップオーバーを開く */
function openInsertTypeMenu(anchorEl, insertIndex) {
  // 既存のポップオーバーを閉じる
  const existing = document.getElementById('insertTypePopover');
  if (existing) existing.remove();

  const popover = el('div', {
    id: 'insertTypePopover',
    class: 'fixed bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64',
    style: 'z-index: 9999;'
  });

  const title = el('p', { class: 'text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 px-1' }, '追加する設問タイプ');
  const grid = el('div', { class: 'grid grid-cols-1 gap-0.5' });

  Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
    const b = el('button', {
      type: 'button',
      class: 'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-primary transition-colors w-full text-left',
    },
      icon(def.icon, 'text-[14px] opacity-60'),
      def.label
    );
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
      insertQuestionAt(type, insertIndex);
    });
    grid.appendChild(b);
  });

  popover.append(title, grid);
  document.body.appendChild(popover);

  // アンカー位置に配置
  const rect = anchorEl.getBoundingClientRect();
  const popW = 256;
  let left = rect.left + rect.width / 2 - popW / 2;
  if (left < 8) left = 8;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  const top = rect.bottom + 6;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  // 外クリック・Escapeで閉じる
  const close = (e) => {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'click' && popover.contains(e.target)) return;
    popover.remove();
    document.removeEventListener('click', close, true);
    document.removeEventListener('keydown', close);
  };
  setTimeout(() => {
    document.addEventListener('click', close, true);
    document.addEventListener('keydown', close);
  }, 0);
}

/** 指定インデックスの位置に設問を挿入する */
function insertQuestionAt(type, insertIndex) {
  const q = defaultQuestion(type);
  questions.splice(insertIndex, 0, q);
  // renderAllQuestions で全再描画（セパレーターも再配置される）
  const container = document.getElementById('questionListContainer');
  if (!container) return;
  renderAllQuestions();
  const card = document.getElementById(`question-${q.id}`);
  if (card) setTimeout(() => smoothScrollIntoView(card, 'center'), 50);
}

/** コンテナ内のセパレーターを現在のカード配置に合わせて再構築する */
function rebuildSeparators() {
  const container = document.getElementById('questionListContainer');
  if (!container) return;
  // 既存セパレーターを除去
  container.querySelectorAll('.insert-separator').forEach(s => s.remove());
  // カード間にセパレーターを挿入（先頭カードの前も含む）
  const cards = Array.from(container.querySelectorAll('[data-question-id]'));
  cards.forEach((card, i) => {
    // 先頭カードの前にも挿入（insertIndex = 0）
    if (i === 0) {
      card.before(buildInsertSeparator(0));
    }
    // 各カードの直後（insertIndex = i+1）
    card.after(buildInsertSeparator(i + 1));
  });
}

function addQuestion(type) {
  const q = defaultQuestion(type);
  questions.push(q);
  const container = document.getElementById('questionListContainer');
  if (container) {
    const card = buildQuestionCard(q, questions.length - 1);
    // 末尾追加エリアの直前に挿入（セパレーターの後、末尾ボタンの前）
    container.appendChild(card);
    renumberQuestions(); // 内部で rebuildSeparators も呼ぶ
    updateMultiLangVisibility();
    setTimeout(() => smoothScrollIntoView(card, 'center'), 50);
  }
}

function deleteQuestion(id) {
  showConfirm(
    '設問を削除',
    'この設問を削除しますか？削除すると元に戻せません。',
    '削除する',
    () => {
      questions = questions.filter(q => q.id !== id);
      if(sortables.options[id]) {
        sortables.options[id].destroy();
        delete sortables.options[id];
      }
      renderAllQuestions();
    }
  );
}

function duplicateQuestion(id) {
  const srcIdx = questions.findIndex(q => q.id === id);
  if (srcIdx < 0) return;
  const copy = JSON.parse(JSON.stringify(questions[srcIdx]));
  copy.id = generateId();
  currentLangs.forEach(l => {
    if(copy.text && copy.text[l]) copy.text[l] += ' (コピー)';
  });
  questions.splice(srcIdx + 1, 0, copy);
  renderAllQuestions();
  const card = document.getElementById(`question-${copy.id}`);
  if (card) setTimeout(() => smoothScrollIntoView(card, 'center'), 50);
}

function initSortable() {
  const container = document.getElementById('questionListContainer');
  if (!container || typeof Sortable === 'undefined') return;
  
  if (sortables.questions) sortables.questions.destroy();
  sortables.questions = new Sortable(container, {
    handle: '.q-drag-handle',
    animation: 150,
    ghostClass: 'dragging-item',
    group: 'questions',
    onEnd: () => renumberQuestions()
  });
}

// ─────────────────────────────────────────
// FAB / Inline Add
// ─────────────────────────────────────────
function initFab() {
  const fabContainer = document.getElementById('fab-container');
  const fabBtn = document.getElementById('fab-main-button');
  const fabMenu = document.getElementById('fab-menu');
  if (!fabBtn || !fabMenu || !fabContainer) return;

  function close() {
    fabBtn.setAttribute('aria-expanded', 'false');
    fabMenu.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
    setTimeout(() => { fabMenu.classList.add('hidden'); }, 300);
  }

  // ドラッグ機能
  let isDragging = false;
  let hasDragged = false;
  let offsetX, offsetY;

  fabBtn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasDragged = false;
    const rect = fabContainer.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    hasDragged = true;
    fabBtn.style.cursor = 'grabbing';

    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    const { width, height } = fabContainer.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + width > vw) newLeft = vw - width;
    if (newTop + height > vh) newTop = vh - height;

    fabContainer.style.left = `${newLeft}px`;
    fabContainer.style.top = `${newTop}px`;
    fabContainer.style.bottom = 'auto';
    fabContainer.style.right = 'auto';
  });

  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    fabBtn.style.cursor = 'pointer';
  });

  fabBtn.addEventListener('dragstart', (e) => e.preventDefault());

  fabBtn.addEventListener('click', () => {
    if (hasDragged) return;
    if (fabBtn.getAttribute('aria-expanded') === 'true') {
      close();
    } else {
      fabBtn.setAttribute('aria-expanded', 'true');
      fabMenu.classList.remove('hidden');
      fabMenu.removeAttribute('inert');
      requestAnimationFrame(() => fabMenu.classList.remove('scale-95', 'opacity-0', 'pointer-events-none'));
    }
  });

  if (fabMenu.children.length === 0) {
    const listWrap = el('div', { class: 'py-2 flex flex-col gap-1' });
    Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
      const b = el('button', {
        type: 'button',
        class: 'w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors rounded-lg text-sm font-semibold',
        'data-question-type': type
      }, icon(def.icon, 'text-gray-500 mr-3 opacity-80'), def.label);
      b.addEventListener('click', () => { close(); addQuestion(type); });
      listWrap.appendChild(b);
    });
    fabMenu.appendChild(listWrap);
  } else {
    fabMenu.querySelectorAll('[data-question-type]').forEach(b => {
      b.addEventListener('click', () => { close(); addQuestion(b.dataset.questionType); });
    });
  }

  // 外クリックでメニューを閉じる
  document.addEventListener('click', (e) => {
    if (fabContainer.contains(e.target)) return;
    if (fabBtn.getAttribute('aria-expanded') === 'true') close();
  });
}

function initInlineAddButton() {
  // 設問タイプボタンを生成してメニューに追加するヘルパー
  function populateMenu(menu, onSelect) {
    Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
      const b = el('button', {
        type: 'button',
        class: 'flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-indigo-50 hover:border-primary hover:text-primary transition-colors',
        'data-question-type': type
      }, icon(def.icon, 'text-base opacity-60'), def.label);
      b.addEventListener('click', () => { onSelect(); addQuestion(type); });
      menu.appendChild(b);
    });
  }

  // 空状態メニュー（最初の設問を追加ボタン用）― インライン展開
  const firstBtn = document.getElementById('addFirstQuestionBtn');
  const firstMenu = document.getElementById('inlineQuestionTypeMenu');
  if (firstBtn && firstMenu) {
    const closeFirst = () => firstMenu.classList.replace('grid', 'hidden');
    populateMenu(firstMenu, closeFirst);
    firstBtn.addEventListener('click', () => {
      const isOpen = firstMenu.classList.contains('grid');
      if (isOpen) closeFirst(); else firstMenu.classList.replace('hidden', 'grid');
    });
  }

  // 設問追加エリアメニュー（設問を追加するボタン用）
  const btn = document.getElementById('addQuestionInlineBtn');
  const menu = document.getElementById('inlineQuestionTypeMenuBottom');
  if (!btn || !menu) return;
  populateMenu(menu, () => menu.classList.add('hidden'));
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) menu.classList.add('hidden');
  });
}

function initOutlineScrollSpy() {
  const OFFSET = 120; // px from top to consider "active"

  const setActive = (key) => {
    document.querySelectorAll('#outline-map-list .outline-item').forEach(a => {
      a.classList.toggle('active', a.dataset.scrollTarget === key);
    });
    document.querySelectorAll('#outline-questions-list a[data-question-id]').forEach(a => {
      a.classList.toggle('active', a.dataset.questionId === key);
    });
  };

  const getTargets = () => {
    const targets = [];
    [
      { el: document.getElementById('basicInfoBody'),          key: 'basicInfoBody' },
      { el: document.getElementById('integrationBody'),        key: 'integrationBody' },
      { el: document.getElementById('additionalSettingsBody'), key: 'additionalSettingsBody' },
      ...Array.from(document.querySelectorAll('#questionListContainer [data-question-id]')).map(targetEl => ({
        el: targetEl, key: targetEl.dataset.questionId
      })),
      ...((() => {
        const btn = document.getElementById('thankYouAccordionBtn');
        return btn && btn.getAttribute('aria-expanded') === 'true'
          ? [{ el: btn, key: 'thankYouAccordionBtn' }]
          : [];
      })()),
    ].forEach(({ el, key }) => { if (el) targets.push({ el, key }); });
    return targets;
  };

  const update = () => {
    const targets = getTargets();
    if (!targets.length) return;

    // Find the last target whose top edge has passed OFFSET from the top of viewport
    let active = targets[0];
    for (const t of targets) {
      if (t.el.getBoundingClientRect().top <= OFFSET) {
        active = t;
      }
    }

    // 末尾付近のターゲットはOFFSETに届かない場合があるため、
    // 次のターゲットがビューポート下半分に入り始めたら順番にアクティブを進める
    let activeIndex = targets.indexOf(active);
    while (activeIndex < targets.length - 1) {
      const next = targets[activeIndex + 1];
      if (next.el.getBoundingClientRect().top < window.innerHeight * 0.6) {
        active = next;
        activeIndex++;
      } else {
        break;
      }
    }

    setActive(active.key);
  };

  window.addEventListener('scroll', update, { passive: true });
  update();

  // Re-run when questions are added/removed
  const questionList = document.getElementById('questionListContainer');
  if (questionList) {
    new MutationObserver(update).observe(questionList, { childList: true });
  }

  return update;
}

function initOutlineScrollLinks() {
  document.querySelectorAll('#outline-map-list [data-scroll-target]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.dataset.scrollTarget;
      const target = document.getElementById(targetId);
      if (!target) return;

      // 左カラムの sticky コンテナ内にある場合はそちらをスクロール
      const stickyPanel = target.closest('.sticky-panel');
      if (stickyPanel) {
        smoothScrollIntoViewInPanel(stickyPanel, target);
      } else {
        smoothScrollIntoView(target, 'start');
      }

      // サンクス画面の場合はアコーディオンを開く
      if (targetId === 'thankYouAccordionBtn') {
        const body = document.getElementById('thankYouAccordionBody');
        const iconEl = document.getElementById('thankYouAccordionIcon');
        if (body && body.classList.contains('hidden')) {
          target.setAttribute('aria-expanded', 'true');
          body.classList.remove('hidden');
          if (iconEl) iconEl.style.transform = 'rotate(180deg)';
        }
      }
    });
  });
}

function initThankYouAccordion(onToggle) {
  const btn = document.getElementById('thankYouAccordionBtn');
  const body = document.getElementById('thankYouAccordionBody');
  const icon = document.getElementById('thankYouAccordionIcon');
  if (!btn || !body) return;
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    body.classList.toggle('hidden', isOpen);
    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
    if (onToggle) onToggle();
  });
}

function initMobileAddButton() {
  const btn = document.getElementById('addQuestionMobileBtn');
  const menu = document.getElementById('mobileQuestionTypeMenu');
  if (!btn || !menu) return;

  // Populate menu if empty
  if (menu.children.length === 0) {
    Object.entries(QUESTION_TYPES).forEach(([type, def]) => {
      const b = el('button', {
        type: 'button',
        class: 'flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-indigo-50 hover:border-primary hover:text-primary transition-colors',
        'data-question-type': type
      }, icon(def.icon, 'text-base opacity-60'), def.label);
      b.addEventListener('click', () => { menu.classList.add('hidden'); addQuestion(type); });
      menu.appendChild(b);
    });
  }

  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) menu.classList.add('hidden');
  });
}

// ─────────────────────────────────────────
// Outline Map Drawer Toggle Logic
// ─────────────────────────────────────────
function initOutlineToggle() {
  const toggleBtn = document.getElementById('outline-map-toggle-btn');
  const outlineColumn = document.getElementById('outline-column');
  const toggleIcon = document.getElementById('outline-map-toggle-icon');

  if (!toggleBtn || !outlineColumn) return;

  toggleBtn.addEventListener('click', () => {
    const isClosed = outlineColumn.classList.contains('translate-x-full');
    
    if (isClosed) {
      outlineColumn.classList.remove('translate-x-full');
      toggleBtn.style.transform = 'translateX(-288px)'; // shift btn left by 72 (w-72 = 288px)
      if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
    } else {
      outlineColumn.classList.add('translate-x-full');
      toggleBtn.style.transform = 'translateX(0)';
      if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
    }
  });
}

// ─────────────────────────────────────────
// QRモーダル制御
// ─────────────────────────────────────────
function openQrModal() {
  const surveyId = document.body.dataset.currentSurveyId || null;
  handleOpenModal(
    'qrCodeModal',
    resolveDashboardAssetPath('modals/qrCodeModal.html'),
    () => populateQrCodeModal({ surveyId })
  );
}

function initQrButtons() {
  document.getElementById('openQrModalBtn')?.addEventListener('click', openQrModal);
  document.getElementById('openQrModalBtnMobile')?.addEventListener('click', openQrModal);
}

// ─────────────────────────────────────────
// プレビュー
// ─────────────────────────────────────────
function buildPreviewData() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim();

  // 多言語テキストフィールドを収集
  const buildMultiLangField = (fieldKey) => {
    const result = {};
    currentLangs.forEach(lang => {
      const el = document.getElementById(`${fieldKey}_${lang}`);
      result[lang] = el?.value?.trim() || '';
    });
    return result;
  };

  // 期間パース
  const periodRange = getVal('periodRange');
  const [periodStart, periodEnd] = periodRange.split(' 〜 ').map(s => s?.trim() || '');

  // 設問データを survey-answer.js が期待する形式に変換
  const normalizedQuestions = questions.map(q => {
    const cfg = q.config || {};
    const base = {
      id: String(q.id),
      type: q.type,
      text: q.text || {},
      required: q.required || false,
      meta: q.meta || {},
    };

    if (CHOICE_TYPES.has(q.type)) {
      base.options = (q.options || []).map((opt, i) => ({
        text: typeof opt === 'object' ? opt : { ja: String(opt) },
        value: `opt_${i}`,
      }));
    }

    if (MATRIX_TYPES.has(q.type)) {
      base.rows = (q.matrixRows || []).map((r, i) => ({
        id: `row_${i}`,
        text: typeof r === 'object' ? r : { ja: String(r) },
      }));
      base.columns = (q.matrixCols || []).map((c, i) => ({
        id: `col_${i}`,
        value: `col_${i}`,
        text: typeof c === 'object' ? c : { ja: String(c) },
      }));
    }

    if (q.type === 'free_answer' && (cfg.minLength || cfg.maxLength)) {
      base.meta = {
        ...base.meta,
        validation: { text: { minLength: cfg.minLength || 0, maxLength: cfg.maxLength || 0 } },
      };
    }

    if (q.type === 'number_answer') {
      base.min = cfg.min !== '' ? cfg.min : undefined;
      base.max = cfg.max !== '' ? cfg.max : undefined;
      base.step = cfg.step !== '' ? cfg.step : 1;
    }

    if (q.type === 'date_time') {
      const showDate = cfg.showDate !== false;
      const showTime = cfg.showTime === true;
      base.meta = {
        ...base.meta,
        dateTimeConfig: {
          inputMode: showDate && showTime ? 'datetime' : showTime ? 'time' : 'date',
        },
      };
    }

    if (q.type === 'handwriting') {
      base.meta = {
        ...base.meta,
        handwritingConfig: { canvasHeight: cfg.height || 200 },
      };
    }

    if (q.type === 'explanation_card') {
      // explanation_cardはtextとして表示されるのみ
      const desc = cfg.description;
      if (desc && typeof desc === 'object') {
        base.text = desc;
      }
    }

    return base;
  });

  return {
    displayTitle: buildMultiLangField('displayTitle'),
    description: buildMultiLangField('description'),
    periodStart: periodStart || '',
    periodEnd: periodEnd || '',
    editorLanguage: currentLangs[0] || 'ja',
    activeLanguages: currentLangs,
    questions: normalizedQuestions,
  };
}

function openPreview() {
  try {
    const data = buildPreviewData();
    localStorage.setItem('surveyPreviewData', JSON.stringify(data));
    handleOpenModal(
      'surveyPreviewModalV2',
      resolveDashboardAssetPath('modals/surveyPreviewModalV2.html'),
      () => {
        const iframe = document.getElementById('surveyPreviewIframe');
        if (iframe) {
          iframe.src = resolveDashboardAssetPath('survey-answer.html') + '?preview=1';
        }

        // デバイス切り替えボタンのイベント（<script>タグは innerHTML 挿入時に実行されないためここで設定）
        const phoneBtn = document.getElementById('v2-preview-phone-btn');
        const tabletBtn = document.getElementById('v2-preview-tablet-btn');
        const frame = document.getElementById('v2-preview-device-frame');
        if (!phoneBtn || !tabletBtn || !frame) return;

        const reloadIframe = () => {
          if (iframe) {
            iframe.src = resolveDashboardAssetPath('survey-answer.html') + '?preview=1';
          }
        };
        const setPhone = () => {
          frame.style.width = '390px';
          frame.style.height = '844px';
          phoneBtn.classList.add('bg-surface', 'text-on-surface', 'shadow-sm');
          phoneBtn.classList.remove('text-on-surface-variant');
          tabletBtn.classList.remove('bg-surface', 'text-on-surface', 'shadow-sm');
          tabletBtn.classList.add('text-on-surface-variant');
          reloadIframe();
        };
        const setTablet = () => {
          frame.style.width = '768px';
          frame.style.height = '1024px';
          tabletBtn.classList.add('bg-surface', 'text-on-surface', 'shadow-sm');
          tabletBtn.classList.remove('text-on-surface-variant');
          phoneBtn.classList.remove('bg-surface', 'text-on-surface', 'shadow-sm');
          phoneBtn.classList.add('text-on-surface-variant');
          reloadIframe();
        };
        phoneBtn.addEventListener('click', setPhone);
        tabletBtn.addEventListener('click', setTablet);
      }
    );
  } catch (e) {
    console.error('プレビューの表示に失敗しました', e);
    showToast('プレビューの表示に失敗しました', 'error');
  }
}

function initPreviewButtons() {
  document.getElementById('showPreviewBtn')?.addEventListener('click', openPreview);
  document.getElementById('showPreviewBtnMobile')?.addEventListener('click', openPreview);
}

// ─────────────────────────────────────────
// 保存ボタン制御
// ─────────────────────────────────────────
function initSaveButton() {
  document.getElementById('createSurveyBtn')?.addEventListener('click', attemptSave);
  document.getElementById('createSurveyBtnMobile')?.addEventListener('click', attemptSave);
}

function attemptSave() {
  // 保存試行時は全必須フィールドを touched 扱いにしてエラーを表示する
  ['surveyName_ja', 'displayTitle_ja', 'periodRange'].forEach(id => touchedFields.add(id));

  if (!validateForm()) {
    if (questions.length === 0) {
      showToast('設問を1件以上追加してください', 'error');
      const firstBtn = document.getElementById('addFirstQuestionBtn');
      if (firstBtn) smoothScrollIntoView(firstBtn, 'center');
    } else {
      showToast('保存に失敗しました（詳細は各項目を確認してください）', 'error');
      const firstError = document.querySelector('.input-error');
      if (firstError) smoothScrollIntoView(firstError, 'center');
    }
    return;
  }

  showToast('アンケートを保存しました', 'success');
  // API送信などの後続処理...
}

// ─────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────
async function loadFromUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    const surveyName = params.get('surveyName');

    if (surveyName) {
      const nameInput = document.getElementById('surveyName_ja');
      if (nameInput) {
        nameInput.value = surveyName;
      }
    }

    if (surveyId) {
      // ログや後続のAPI実装時に利用可能
      console.log('Loaded Survey ID from URL:', surveyId);
      // 将来的に dataset や hidden に持たせる場合を想定
      document.body.dataset.currentSurveyId = surveyId;
      await loadSurveyData(surveyId);

      // 関連設定リンクに surveyId パラメータを付与
      const bizcardLink = document.getElementById('linkBizcardSettings');
      if (bizcardLink) bizcardLink.href = `./bizcardSettings.html?surveyId=${encodeURIComponent(surveyId)}&from=v2`;
      const emailLink = document.getElementById('linkThankYouEmailSettings');
      if (emailLink) emailLink.href = `./thankYouEmailSettings.html?surveyId=${encodeURIComponent(surveyId)}&from=v2`;
    }
  } catch (e) {
    console.warn('URLパラメータの解析に失敗しました', e);
  }
}

async function loadSurveyData(surveyId) {
  try {
    const res = await fetch(`../data/surveys/${surveyId}.json`);
    if(!res.ok) throw new Error("Fetch failed");
    const json = await res.json();
    
    const surveyNameJa = (typeof json.name === 'object') ? (json.name.ja || '') : (json.name || '');
    const nameInput = document.getElementById('surveyName_ja');
    if(nameInput) nameInput.value = surveyNameJa || `アンケート ${surveyId}`;
    
    const nameDisp = document.getElementById('surveyNameDisplay');
    if(nameDisp) nameDisp.textContent = surveyNameJa || `アンケート ${surveyId}`;
    
    const idDisp = document.getElementById('surveyIdDisplay');
    if(idDisp) idDisp.textContent = surveyId;
    
    const titleInput = document.getElementById('displayTitle_ja');
    if(titleInput) titleInput.value = surveyNameJa;
    
    const periodInput = document.getElementById('periodRange');
    const periodDisp = document.getElementById('surveyPeriodDisplay');
    if(json.periodStart && json.periodEnd) {
      const pStr = `${json.periodStart} - ${json.periodEnd}`;
      if(periodInput) periodInput.value = pStr;
      if(periodDisp) periodDisp.textContent = pStr;
    }
    
    const typeMap = {
      'single_choice': 'single_answer',
      'multi_choice': 'multi_answer',
      'text': 'free_answer',
      'free_text': 'free_answer',
      'number': 'number_answer',
      'date': 'date_time',
      'time': 'date_time',
      'matrix_sa': 'matrix_sa',
      'matrix_ma': 'matrix_ma',
      'handwriting': 'handwriting',
      'explanation': 'explanation_card',
      'image': 'free_answer'
    };
    
    questions = (json.details || []).map(q => {
      const type = typeMap[q.type] || q.type;
      const base = {
        id: generateId(),
        type: type,
        text: { ja: q.text || '' },
        required: q.required || false
      };
      
      if (CHOICE_TYPES.has(type)) {
        base.options = (q.options || []).map(o => ({ ja: typeof o === 'string' ? o : (o.text || '') }));
        if(base.options.length === 0) base.options = [{ja:'選択肢1'}];
      }
      if (MATRIX_TYPES.has(type)) {
        base.matrixRows = (q.rows || []).map(r => ({ ja: r.text || '' }));
        base.matrixCols = (q.options || []).map(c => ({ ja: c.text || '' }));
      }
      return base;
    });
    
    showToast('アンケートデータを読み込みました', 'success');
  } catch(e) {
    console.warn("アンケートデータの読み込みに失敗:", e);
    showToast('既存アンケートの読み込みに失敗しました', 'warning');
  }
}

async function init() {
  try {
    await Promise.all([
      loadCommonHtml('header-placeholder', 'common/header.html'),
      loadCommonHtml('sidebar-placeholder', 'common/sidebar.html'),
      loadCommonHtml('footer-placeholder', 'common/footer.html'),
    ]);
  } catch(e) {
    console.warn("共通HTMLパーツの読み込みに失敗しました（ローカル環境のCORS制約等のため）。処理を続行します。", e);
  }

  try { initThemeToggle?.(); } catch(e){}
  try { initSidebarHandler?.(); } catch(e){}
  try { initBreadcrumbs?.(); } catch(e){}
  try { initHelpPopovers?.(); } catch(e){}
  try { initializeDatepickers?.(); } catch(e){}

  // Accordions (Settings)
  document.querySelectorAll('.v2-accordion-trigger').forEach(btn => {
    const target = document.getElementById(btn.getAttribute('data-accordion-v2'));
    if(!target) return;
    btn.addEventListener('click', e => {
      if(e.target.closest('.help-trigger')) return;
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      target.classList.toggle('v2-collapsed', open);
    });
  });

  // Toggles
  const bizToggle = document.getElementById('bizcardEnabled');
  const _applyBizcardLinkState = (on) => {
    ['bizcardDataSettingsSection', 'thankYouEmailSettingsSection'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('opacity-40', !on);
      el.classList.toggle('pointer-events-none', !on);
      el.classList.toggle('grayscale', !on);
      if (!on) {
        el.dataset.savedHref = el.getAttribute('href') ?? '';
        el.removeAttribute('href');
        el.setAttribute('aria-disabled', 'true');
      } else {
        if (el.dataset.savedHref) el.setAttribute('href', el.dataset.savedHref);
        el.removeAttribute('aria-disabled');
      }
    });
  };
  bizToggle?.addEventListener('change', () => _applyBizcardLinkState(bizToggle.checked));
  if (bizToggle) _applyBizcardLinkState(bizToggle.checked);

  initMultilingualToggle();
  initLangTabWidthTracking();
  initFab();
  initInlineAddButton();
  initMobileAddButton();
  initOutlineScrollLinks();
  const scrollSpyUpdate = initOutlineScrollSpy();
  initThankYouAccordion(scrollSpyUpdate);
  initOutlineToggle();
  initSortable();
  initSaveButton();
  initQrButtons();
  initPreviewButtons();

  await loadFromUrlParams();
  renderLangSelectionAndTabs();
  updateOutline();
  updateEmptyState();
}

document.addEventListener('DOMContentLoaded', init);
