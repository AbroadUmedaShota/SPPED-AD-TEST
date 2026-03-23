/**
 * surveyCreation-v2.js
 * アンケート作成・編集 v2 ページ専用スクリプト
 */

import { loadCommonHtml } from './utils.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { initializeDatepickers } from './ui/datepicker.js';
import { initHelpPopovers } from './ui/helpPopover.js';
import { initThemeToggle } from './lib/themeToggle.js';

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const typeClass = type === 'success' ? 'v2-toast--success'
    : type === 'error' ? 'v2-toast--error'
    : type === 'warning' ? 'v2-toast--warning'
    : 'v2-toast--success';
  const toast = document.createElement('div');
  toast.className = `v2-toast ${typeClass}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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
  options: {}
};

// ─────────────────────────────────────────
// 自動保存 / 下書き機能
// ─────────────────────────────────────────
let saveTimeout = null;
const DRAFT_KEY = 'survey_draft_new'; // 実際には surveyId などで分ける

function queueAutoSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDraft, 5000);
}

function saveDraft() {
  const draft = {
    surveyName: document.getElementById('surveyName_ja')?.value || '',
    periodRange: document.getElementById('periodRange')?.value || '',
    bizcardEnabled: document.getElementById('bizcardEnabled')?.checked || false,
    multilingual: isMultilingual,
    currentLangs: currentLangs,
    activeLang: activeLang,
    allowContinuousAnswer: document.getElementById('allowContinuousAnswer')?.checked || false,
    memo: document.getElementById('memo')?.value || '',
    bizcardOcrMode: document.getElementById('bizcardOcrMode')?.value || 'standard',
    thankYouEmailEnabled: document.getElementById('thankYouEmailEnabled')?.checked || false,
    thankYouEmailSubject: document.getElementById('thankYouEmailSubject')?.value || '',
    thankYouEmailBody_content: document.getElementById('thankYouEmailBody_content')?.value || '',
    
    // 多言語フィールド
    multiLangInputs: {},
    questions: questions
  };

  document.querySelectorAll('.multi-lang-input-group').forEach(group => {
    const key = group.dataset.fieldKey;
    draft.multiLangInputs[key] = {};
    group.querySelectorAll('[data-lang]').forEach(langDiv => {
      const code = langDiv.dataset.lang;
      const input = langDiv.querySelector('input, textarea');
      if (input) draft.multiLangInputs[key][code] = input.value;
    });
  });

  try {
    const json = JSON.stringify(draft);
    if (json.length > 5000000) {
      console.warn("Draft too large to save to localStorage");
      return;
    }
    localStorage.setItem(DRAFT_KEY, json);
    console.log("Draft auto-saved.");
  } catch(e) {
    console.warn("Failed to save draft", e);
  }
}

function loadDraftIfAny() {
  const json = localStorage.getItem(DRAFT_KEY);
  if (!json) return false;
  
  if (!confirm('未保存の下書きがあります。復元しますか？')) {
    localStorage.removeItem(DRAFT_KEY);
    return false;
  }
  
  try {
    const draft = JSON.parse(json);
    
    // Basic restores
    if(draft.surveyName) document.getElementById('surveyName_ja').value = draft.surveyName;
    if(draft.periodRange) document.getElementById('periodRange').value = draft.periodRange;
    if(draft.bizcardEnabled) {
      document.getElementById('bizcardEnabled').checked = draft.bizcardEnabled;
      document.getElementById('bizcardEnabled').dispatchEvent(new Event('change'));
    }
    if(draft.multilingual) {
      document.getElementById('multilingualEnabledToggle').checked = true;
      document.getElementById('multilingualEnabledToggle').dispatchEvent(new Event('change'));
    }
    if(draft.allowContinuousAnswer) document.getElementById('allowContinuousAnswer').checked = draft.allowContinuousAnswer;
    if(draft.memo) document.getElementById('memo').value = draft.memo;
    
    // MultiLang States
    currentLangs = draft.currentLangs || ['ja'];
    activeLang = draft.activeLang || 'ja';
    isMultilingual = draft.multilingual || false;
    
    renderLangSelectionAndTabs();
    
    // MultiLang inputs
    Object.entries(draft.multiLangInputs || {}).forEach(([key, langsObj]) => {
      const group = document.querySelector(`.multi-lang-input-group[data-field-key="${key}"]`);
      if (group) {
        Object.entries(langsObj).forEach(([lang, val]) => {
          ensureMultiLangInputExists(group, lang);
          const input = group.querySelector(`[data-lang="${lang}"] textarea, [data-lang="${lang}"] input`);
          if (input) input.value = val;
        });
      }
    });
    
    // Questions
    questions = draft.questions || [];
    renderAllQuestions();
    
    showToast('下書きを復元しました', 'success');
  } catch(e) {
    console.warn("Error restoring draft", e);
  }
  return true;
}

window.addEventListener('beforeunload', (e) => {
  // 保存ボタン押下時等は例外にする処理が必要。暫定対応。
  if (localStorage.getItem(DRAFT_KEY)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// 入力イベントで自動保存スケジュール
document.addEventListener('input', (e) => {
  if (e.target.matches('input, textarea, select')) {
    queueAutoSave();
    updateOutline(); // リアルタイムバリデーション反映
    updateSaveButtonState();
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
}

function renderLangSelectionAndTabs() {
  const panel = document.getElementById('languageSelectionPanel');
  const tabsContainer = document.getElementById('languageEditorTabsV2');
  if(!panel || !tabsContainer) return;

  // 選択パネル
  panel.innerHTML = '';
  SUPPORTED_LANGS.filter(l => l.code !== 'ja').forEach(l => {
    const lbl = el('label', { class: 'flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-full text-sm cursor-pointer hover:bg-surface-variant transition-colors' });
    const cb = el('input', { 
      type: 'checkbox', 
      value: l.code, 
      class: 'h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary',
      checked: currentLangs.includes(l.code),
      onchange: (e) => {
        if(e.target.checked) {
          if(currentLangs.length >= 3) {
            e.target.checked = false;
            showToast('追加できる言語は最大3言語（日本語含む）です', 'warning');
            return;
          }
          currentLangs.push(l.code);
        } else {
          currentLangs = currentLangs.filter(c => c !== l.code);
        }
        if(!currentLangs.includes(activeLang)) activeLang = currentLangs[0];
        onLangsChanged();
        queueAutoSave();
      }
    });
    lbl.append(cb, l.name);
    panel.appendChild(lbl);
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
        queueAutoSave();
      }
    });
    const handle = el('span', { class: 'material-icons lang-tab-handle' }, 'drag_indicator');
    const txt = el('span', {}, langObj ? langObj.name : langCode);
    
    // 未入力警告アイコン（仮実装）
    const warn = el('span', { class: 'material-icons text-error text-[14px] hidden', 'data-tab-warning': '' }, 'warning');
    
    tab.append(handle, txt, warn);
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
    handle: '.lang-tab-handle',
    animation: 150,
    group: 'language-tabs',
    onEnd: () => {
      const newOrder = [];
      container.querySelectorAll('.lang-tab').forEach(t => newOrder.push(t.dataset.lang));
      currentLangs = newOrder;
      queueAutoSave();
    }
  });
}

function initMultilingualToggle() {
  const toggle = document.getElementById('multilingualEnabledToggle');
  const controls = document.getElementById('multilingual-controls');
  if (!toggle || !controls) return;

  toggle.addEventListener('change', () => {
    isMultilingual = toggle.checked;
    controls.classList.toggle('hidden', !toggle.checked);
    if(!isMultilingual) {
      currentLangs = ['ja'];
      activeLang = 'ja';
      renderLangSelectionAndTabs();
    }
    queueAutoSave();
  });
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

  updateOutline();
  updateEmptyState();
  queueAutoSave();
}

function updateEmptyState() {
  const container = document.getElementById('questionListContainer');
  const emptyMsg = document.getElementById('questionListEmpty');
  const badge = document.getElementById('questionCountBadge');
  if (!container) return;
  const count = container.querySelectorAll('[data-question-id]').length;
  if (emptyMsg) emptyMsg.classList.toggle('hidden', count > 0);
  if (badge) badge.textContent = `${count}問`;
}

// ─────────────────────────────────────────
// バリデーション＆アウトラインパネル
// ─────────────────────────────────────────

function validateForm() {
  let hasBlocker = false;
  
  const surveyName = document.getElementById('surveyName_ja')?.value?.trim();
  const displayTitle = document.getElementById('displayTitle_ja')?.value?.trim();
  const periodRange = document.getElementById('periodRange')?.value?.trim();
  
  if(!surveyName || !displayTitle || !periodRange) hasBlocker = true;
  if(questions.length === 0) hasBlocker = true;
  
  // 選択肢系の検証
  questions.forEach(q => {
    if(CHOICE_TYPES.has(q.type) && (!q.options || q.options.length < 2)) hasBlocker = true;
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
  // 簡易バリデーション (赤ぽっち用)
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
    const targetId = a.getAttribute('href').replace('#', '');
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

    const a = el('a', {
      class: 'flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer text-xs',
      href: '#',
      onclick: (e) => {
        e.preventDefault();
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optionally focus
      }
    },
      el('span', { class: `text-xs font-medium flex-shrink-0 ${hasError ? 'text-error' : 'text-primary'}` }, `Q${i + 1}`),
      el('span', { class: 'truncate' }, textStr)
    );
    if(hasError) {
      a.appendChild(el('span', {class:'text-error font-bold flex-shrink-0 ml-auto'}, '●'));
    }
    outlineList.appendChild(a);
  });
  updateSaveButtonState();
}

// ─────────────────────────────────────────
// 設問カードの構築
// ─────────────────────────────────────────
function renderAllQuestions() {
  const container = document.getElementById('questionListContainer');
  if(!container) return;
  container.innerHTML = '';
  questions.forEach((q, idx) => {
    container.appendChild(buildQuestionCard(q, idx));
  });
  renumberQuestions();
  updateMultiLangVisibility();
}

function buildQuestionCard(q, index) {
  const card = el('article', {
    class: 'question-card bg-surface border border-outline-variant rounded-xl overflow-hidden',
    'data-question-id': q.id,
    'data-question-type': q.type,
    id: `question-${q.id}`
  });

  // ヘッダー
  const header = el('div', { class: 'q-card-header flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-surface' });
  header.addEventListener('click', (e) => { if (!e.target.closest('button')) toggleCard(card); });

  const handle = el('span', { class: 'material-icons text-on-surface-variant q-drag-handle flex-shrink-0 cursor-grab', title: '並び替え' }, 'drag_indicator');
  const numEl = el('span', { class: 'text-sm font-bold text-primary flex-shrink-0', 'data-question-number': '' }, `Q${index + 1}`);
  const typeLabel = el('span', { class: 'text-xs bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded flex-shrink-0' }, getTypeLabel(q.type));
  const requiredBadge = el('span', { class: `text-xs bg-error text-on-error px-1.5 py-0.5 rounded flex-shrink-0${q.required ? '' : ' hidden'}`, 'data-required-badge': '' }, '必須');
  const summaryText = el('p', { class: 'text-sm text-on-surface truncate flex-1 min-w-0', 'data-question-summary-text': '' }, q.text[currentLangs[0]] || '設問文を入力してください');

  const duplicateBtn = el('button', { type: 'button', class: 'v2-icon-btn flex-shrink-0', onclick: (e) => { e.stopPropagation(); duplicateQuestion(q.id); } }, icon('content_copy', 'text-base'));
  const deleteBtn = el('button', { type: 'button', class: 'v2-icon-btn v2-icon-btn--danger flex-shrink-0', onclick: (e) => { e.stopPropagation(); deleteQuestion(q.id); } }, icon('delete', 'text-base text-error'));
  
  const toggleIcon = icon('expand_more', 'text-base transition-transform duration-200');
  toggleIcon.style.transform = 'rotate(180deg)'; 
  const toggleBtn = el('button', { type: 'button', class: 'v2-icon-btn flex-shrink-0', 'data-toggle-btn': '', onclick: (e) => { e.stopPropagation(); toggleCard(card); } }, toggleIcon);

  header.append(handle, numEl, typeLabel, requiredBadge, summaryText, duplicateBtn, deleteBtn, toggleBtn);

  // 詳細
  const detail = el('div', { class: 'q-card-detail border-t border-outline-variant', 'data-detail-panel': '' });
  detail.appendChild(buildBasicSection(q, card));
  
  const ansSec = buildAnswerSection(q);
  if (ansSec) detail.appendChild(ansSec);
  detail.appendChild(buildAdvancedSection(q));

  card.append(header, detail);
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

function buildBasicSection(q, cardNode) {
  const section = el('section', { class: 'p-4 space-y-3' });
  section.appendChild(el('h4', { class: 'text-sm font-semibold text-on-surface' }, '基本設定'));

  // 設問文（多言語対応）
  const wrappers = currentLangs.map(lang => {
    const input = el('input', {
      type: 'text', class: 'input-field w-full', placeholder: ' ',
      value: q.text[lang] || '',
      oninput: (e) => {
        if(!q.text) q.text = {};
        q.text[lang] = e.target.value;
        if(lang === currentLangs[0]) {
          const sum = cardNode.querySelector('[data-question-summary-text]');
          if(sum) sum.textContent = e.target.value || '設問文を入力してください';
          updateOutline();
        }
      }
    });
    const label = el('label', {class: 'input-label'}, `設問文 (${lang})`);
    const group = el('div', {class: 'input-group'});
    group.append(input, label);
    const wrap = el('div', {'data-lang-wrapper': lang}, group);
    return wrap;
  });
  wrappers.forEach(w => section.appendChild(w));

  const checkbox = el('input', {
    type: 'checkbox', class: 'h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary',
    checked: q.required,
    onchange: (e) => {
      q.required = e.target.checked;
      cardNode.querySelector('[data-required-badge]')?.classList.toggle('hidden', !q.required);
    }
  });
  section.appendChild(el('div', { class: 'flex items-center gap-2' }, checkbox, el('label', {class: 'text-sm text-on-surface-variant'}, '必須回答にする')));

  return section;
}

function buildAnswerSection(q) {
  if (CHOICE_TYPES.has(q.type)) return buildChoiceSection(q);
  if (MATRIX_TYPES.has(q.type)) return buildMatrixSection(q);
  // (簡易化: その他のタイプも同様に実装)
  return el('section', {class: 'px-4 pb-4'}, el('p', {class: 'text-xs text-on-surface-variant'}, `${getTypeLabel(q.type)}の回答設定`));
}

function buildChoiceSection(q) {
  const section = el('section', { class: 'px-4 pb-4 space-y-3 border-t border-outline-variant pt-4' });
  section.appendChild(el('h4', { class: 'text-sm font-semibold text-on-surface' }, '選択肢設定'));

  const optionsList = el('div', { class: 'space-y-2', id: `options-list-${q.id}` });
  (q.options || []).forEach((opt, idx) => {
    optionsList.appendChild(buildOptionRow(q, idx, opt));
  });
  section.appendChild(optionsList);

  const addBtn = el('button', {
    type: 'button',
    class: 'inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors mt-2',
    onclick: () => {
      if (!q.options) q.options = [];
      const newOpt = {};
      currentLangs.forEach(l => newOpt[l] = `選択肢${q.options.length + 1}`);
      q.options.push(newOpt);
      const row = buildOptionRow(q, q.options.length - 1, newOpt);
      optionsList.appendChild(row);
      updateMultiLangVisibility();
      queueAutoSave();
    }
  }, icon('add', 'text-base'), '選択肢を追加');
  section.appendChild(addBtn);

  // 遅延してSortable初期化
  setTimeout(() => {
    if(sortables.options[q.id]) sortables.options[q.id].destroy();
    sortables.options[q.id] = new Sortable(optionsList, {
      handle: '.option-drag-handle',
      animation: 100,
      group: `options-${q.id}`,
      onEnd: () => {
        // DOM順序から配列を再構築
        const newOpts = [];
        optionsList.querySelectorAll('[data-option-index]').forEach(row => {
          const oldIdx = parseInt(row.dataset.optionIndex, 10);
          newOpts.push(q.options[oldIdx]);
        });
        q.options = newOpts;
        
        // idx を再振り当て
        optionsList.querySelectorAll('[data-option-index]').forEach((row, i) => {
          row.dataset.optionIndex = i;
        });
        queueAutoSave();
        updateOutline();
      }
    });
  }, 100);

  return section;
}

function buildOptionRow(q, idx, optValObj) {
  const row = el('div', { class: 'flex items-center gap-2', 'data-option-index': idx });
  const handle = el('span', { class: 'material-icons text-on-surface-variant cursor-grab text-base flex-shrink-0 option-drag-handle' }, 'drag_indicator');

  const inputsWrap = el('div', { class: 'flex-1' });
  currentLangs.forEach(lang => {
    const input = el('input', {
      type: 'text',
      class: 'w-full border border-outline-variant rounded-lg px-3 py-1.5 text-sm bg-surface text-on-surface focus:outline-none focus:border-primary',
      value: optValObj[lang] || '',
      placeholder: `選択肢 (${lang})`,
      oninput: (e) => {
        const curIdx = parseInt(row.dataset.optionIndex,10);
        if(q.options[curIdx]) q.options[curIdx][lang] = e.target.value;
      }
    });
    inputsWrap.appendChild(el('div', {'data-lang-wrapper': lang}, input));
  });

  const deleteBtn = el('button', {
    type: 'button',
    class: 'v2-icon-btn v2-icon-btn--danger flex-shrink-0',
    onclick: () => {
      const parent = row.parentNode;
      if (parent.children.length <= 1) {
        showToast('選択肢は最低1つ必要です', 'warning'); return;
      }
      const curIdx = parseInt(row.dataset.optionIndex,10);
      q.options.splice(curIdx, 1);
      row.remove();
      // idx再振り当て
      parent.querySelectorAll('[data-option-index]').forEach((r, i) => r.dataset.optionIndex = i);
      updateOutline();
      queueAutoSave();
    }
  }, icon('close', 'text-base text-error'));

  row.append(handle, inputsWrap, deleteBtn);
  return row;
}

function buildMatrixSection(q) {
  const section = el('section', { class: 'px-4 pb-4 space-y-4 border-t border-outline-variant pt-4' });
  section.appendChild(el('h4', { class: 'text-sm font-semibold text-on-surface' }, 'マトリックス設定'));

  // 行
  section.appendChild(buildMatrixList(q, 'rows', '行'));
  // 列
  section.appendChild(buildMatrixList(q, 'cols', '列'));

  return section;
}

function buildMatrixList(q, key, label) {
  const fieldKey = key === 'rows' ? 'matrixRows' : 'matrixCols';
  const wrap = el('div', { class: 'space-y-2' });
  wrap.appendChild(el('p', { class: 'text-xs font-semibold text-on-surface-variant' }, `${label}ラベル`));

  const list = el('div', { class: 'space-y-1.5', 'data-matrix-list': fieldKey });
  (q[fieldKey] || []).forEach((vObj, i) => list.appendChild(buildMatrixRow(q, fieldKey, i, vObj)));
  wrap.appendChild(list);

  const addBtn = el('button', {
    type: 'button',
    class: 'text-sm text-primary flex items-center gap-1 hover:underline',
    onclick: () => {
      if (!q[fieldKey]) q[fieldKey] = [];
      const newObj = {};
      currentLangs.forEach(l => newObj[l] = `${label}${q[fieldKey].length + 1}`);
      q[fieldKey].push(newObj);
      list.appendChild(buildMatrixRow(q, fieldKey, q[fieldKey].length - 1, newObj));
      updateMultiLangVisibility();
      queueAutoSave();
    }
  }, icon('add', 'text-sm'), `${label}を追加`);
  wrap.appendChild(addBtn);
  return wrap;
}

function buildMatrixRow(q, fieldKey, idx, valObj) {
  const row = el('div', { class: 'flex items-center gap-2', 'data-matrix-row': idx });
  
  const inputsWrap = el('div', { class: 'flex-1' });
  currentLangs.forEach(lang => {
    const input = el('input', {
      type: 'text',
      class: 'w-full border border-outline-variant rounded-lg px-3 py-1 text-sm bg-surface text-on-surface focus:outline-none focus:border-primary',
      value: valObj[lang] || '',
      placeholder: `ラベル (${lang})`,
      oninput: (e) => {
        const curIdx = parseInt(row.dataset.matrixRow,10);
        if(q[fieldKey] && q[fieldKey][curIdx]) q[fieldKey][curIdx][lang] = e.target.value;
      }
    });
    inputsWrap.appendChild(el('div', {'data-lang-wrapper': lang}, input));
  });

  const delBtn = el('button', {
    type: 'button',
    class: 'v2-icon-btn v2-icon-btn--danger flex-shrink-0',
    onclick: () => {
      const parentList = row.parentNode;
      if (parentList.children.length <= 1) { showToast('最低1つ必要です', 'warning'); return; }
      const curIdx = parseInt(row.dataset.matrixRow, 10);
      if (q[fieldKey]) q[fieldKey].splice(curIdx, 1);
      row.remove();
      parentList.querySelectorAll('[data-matrix-row]').forEach((r, i) => r.dataset.matrixRow = i);
      queueAutoSave();
    }
  }, icon('close', 'text-base text-error'));
  row.append(inputsWrap, delBtn);
  return row;
}

function buildAdvancedSection(q) {
  const section = el('section', { class: 'px-4 pb-4 border-t border-outline-variant pt-4' });

  const toggleBtn = el('button', {
    type: 'button',
    class: 'flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors',
    'aria-expanded': 'false',
    onclick: (e) => {
      const panel = section.querySelector('[data-jump-panel]');
      const isOpen = e.currentTarget.getAttribute('aria-expanded') === 'true';
      e.currentTarget.setAttribute('aria-expanded', String(!isOpen));
      panel?.classList.toggle('hidden', isOpen);
      const ic = e.currentTarget.querySelector('.material-icons');
      if (ic) ic.textContent = isOpen ? 'chevron_right' : 'expand_more';
    }
  },
    icon('chevron_right', 'text-base transition-transform'),
    '高度設定（条件分岐）'
  );

  const panel = el('div', { class: 'hidden mt-3 space-y-2', 'data-jump-panel': '' });
  panel.appendChild(el('p', { class: 'text-xs text-on-surface-variant' }, 'この設問の回答に応じてジャンプ先を設定できます。（プレミアム機能）'));

  section.append(toggleBtn, panel);
  return section;
}

// ─────────────────────────────────────────
// 追加・削除・複製・Sortable
// ─────────────────────────────────────────
function addQuestion(type) {
  const q = defaultQuestion(type);
  questions.push(q);
  renderAllQuestions();
  const card = document.getElementById(`question-${q.id}`);
  if(card) {
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }
}

function deleteQuestion(id) {
  if (!confirm('削除しますか？')) return;
  questions = questions.filter(q => q.id !== id);
  if(sortables.options[id]) {
    sortables.options[id].destroy();
    delete sortables.options[id];
  }
  renderAllQuestions();
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
  setTimeout(() => document.getElementById(`question-${copy.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
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
  const fabBtn = document.getElementById('fab-main-button');
  const fabMenu = document.getElementById('fab-menu');
  if (!fabBtn || !fabMenu) return;

  function close() {
    fabBtn.setAttribute('aria-expanded', 'false');
    fabMenu.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
    setTimeout(() => fabMenu.hidden = true, 300);
  }

  fabBtn.addEventListener('click', () => {
    if (fabBtn.getAttribute('aria-expanded') === 'true') {
      close();
    } else {
      fabBtn.setAttribute('aria-expanded', 'true');
      fabMenu.hidden = false;
      fabMenu.removeAttribute('inert');
      requestAnimationFrame(() => fabMenu.classList.remove('scale-95', 'opacity-0', 'pointer-events-none'));
    }
  });

  fabMenu.querySelectorAll('[data-question-type]').forEach(b => {
    b.addEventListener('click', () => { close(); addQuestion(b.dataset.questionType); });
  });
}

function initInlineAddButton() {
  const btn = document.getElementById('addQuestionInlineBtn');
  const menu = document.getElementById('inlineQuestionTypeMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  menu.querySelectorAll('[data-question-type]').forEach(b => {
    b.addEventListener('click', () => { menu.classList.add('hidden'); addQuestion(b.dataset.questionType); });
  });
  document.addEventListener('click', e => { if(!btn.contains(e.target)) menu.classList.add('hidden'); });
}

// ─────────────────────────────────────────
// 保存ボタン制御
// ─────────────────────────────────────────
function initSaveButton() {
  document.getElementById('createSurveyBtn')?.addEventListener('click', attemptSave);
  document.getElementById('createSurveyBtnMobile')?.addEventListener('click', attemptSave);
}

function attemptSave() {
  if (!validateForm()) {
    showToast('保存に失敗しました（詳細は各項目を確認してください）', 'error');
    // 自動スクロール: 最初のエラーへの移動処理
    const errDot = document.querySelector('.error-dot');
    if(errDot) {
      const linkTarget = errDot.closest('a').getAttribute('href').replace('#', '');
      if(linkTarget && document.getElementById(linkTarget)) {
         document.getElementById(linkTarget).scrollIntoView({behavior: 'smooth', block: 'center'});
      } else {
         const card = errDot.closest('a').onclick; 
         if(card) card({preventDefault:()=>{}}); // Quick hack to invoke scroll inside outline listener
      }
    } else {
       // Error dots logic missed it, fallback
       document.querySelector('.input-field:invalid')?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
    return;
  }
  
  localStorage.removeItem(DRAFT_KEY);
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
    
    const titleInput = document.getElementById('displayTitle_ja');
    if(titleInput) titleInput.value = surveyNameJa;
    
    const periodInput = document.getElementById('periodRange');
    if(periodInput && json.periodStart && json.periodEnd) {
      periodInput.value = `${json.periodStart} to ${json.periodEnd}`;
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
  bizToggle?.addEventListener('change', () => {
    const on = bizToggle.checked;
    ['bizcardDataSettingsSection', 'thankYouEmailSettingsSection'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.classList.toggle('opacity-50', !on); el.classList.toggle('pointer-events-none', !on); }
    });
  });

  initMultilingualToggle();
  initFab();
  initInlineAddButton();
  initSortable();
  initSaveButton();

  // Load Draft
  const restored = loadDraftIfAny();
  if(!restored) {
    await loadFromUrlParams(); // URLからパラメータを復元
    renderLangSelectionAndTabs();
    updateOutline();
    updateEmptyState();
  }
}

document.addEventListener('DOMContentLoaded', init);
