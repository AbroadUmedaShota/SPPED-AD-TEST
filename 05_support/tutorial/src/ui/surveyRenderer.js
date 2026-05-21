const I18N = {
  questionTypes: {
    ja: {
      free_answer: '自由記述',
      single_answer: '単一選択',
      multi_answer: '複数選択',
      dropdown: 'ドロップダウン',
      number_answer: '数値入力',
      matrix_sa: 'マトリクス（単一）',
      matrix_ma: 'マトリクス（複数）',
      date_time: '日付/時刻',
      handwriting: '手書きスペース',
      explanation_card: '説明カード'
    },
    en: {
      free_answer: 'Free Text',
      single_answer: 'Single Choice',
      multi_answer: 'Multiple Choice',
      dropdown: 'Dropdown',
      number_answer: 'Number',
      matrix_sa: 'Matrix (Single)',
      matrix_ma: 'Matrix (Multiple)',
      date_time: 'Date/Time',
      handwriting: 'Handwriting',
      explanation_card: 'Explanation Card'
    }
  },
  labels: {
    ja: {
      addOption: '選択肢を追加',
      noQuestions: '設問はまだありません。',
      noGroups: '設問グループはまだありません。',
      unknownType: '不明なタイプ',
      untitledGroup: '無題のグループ',
      untitledQuestion: '設問文を入力してください'
    },
    en: {
      addOption: 'Add option',
      noQuestions: 'No questions.',
      noGroups: 'No question groups.',
      unknownType: 'Unknown type',
      untitledGroup: 'Untitled group',
      untitledQuestion: 'Enter the question text'
    }
  }
};

const QUESTION_TYPE_ORDER = [
  'free_answer',
  'single_answer',
  'multi_answer',
  'dropdown',
  'number_answer',
  'matrix_sa',
  'matrix_ma',
  'date_time',
  'handwriting',
  'explanation_card'
];

const FALLBACK_LANGUAGE = 'ja';

const DEFAULT_NUMERIC_META = { min: '', max: '', step: 1, unitLabel: '', unitSystem: 'metric' };
const DEFAULT_DATETIME_META = { inputMode: 'date', timezone: 'Asia/Tokyo', minDateTime: '', maxDateTime: '', allowPast: true, allowFuture: true };
const DEFAULT_HANDWRITING_META = { canvasWidth: 600, canvasHeight: 200, penColor: '#000000', penWidth: 2, backgroundPattern: 'plain' };

function t(dict, key, lang) {
  const table = I18N[dict]?.[lang] || I18N[dict]?.ja || {};
  return table[key] || I18N[dict]?.ja?.[key] || key;
}

function getLocalizedText(value, lang) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const localized = value[lang];
    return typeof localized === 'string' ? localized : localized ?? '';
  }
  if (typeof value === 'string') {
    return lang === FALLBACK_LANGUAGE ? value : '';
  }
  return '';
}

function getLanguageMeta(languageOptions = {}, code = FALLBACK_LANGUAGE) {
  const { languageMap } = languageOptions;
  if (languageMap && typeof languageMap.get === 'function') {
    return languageMap.get(code) || { code, label: code, shortLabel: code };
  }
  return { code, label: code, shortLabel: code };
}

function getDisplayText(value, languageOptions = {}) {
  const editorLanguage = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
  const current = getLocalizedText(value, editorLanguage).trim();
  if (current) return current;
  return getLocalizedText(value, FALLBACK_LANGUAGE).trim();
}

function getStoredAccordionState(key, defaultState) {
  if (!key) return defaultState;
  const value = localStorage.getItem(`accordionState_${key}`);
  if (value === null) return defaultState;
  return value !== 'false';
}

function ensureReferenceHintElement(group) {
  if (!group) return null;
  let hint = group.querySelector('.translation-reference-hint');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'translation-reference-hint text-xs text-text-sub mt-1 leading-snug hidden';
    group.appendChild(hint);
  }
  return hint;
}

function setReferenceHintForInput(input, referenceText, baseLanguage = FALLBACK_LANGUAGE) {
  if (!input) return;
  const group = input.closest('.input-group');
  if (!group) return;

  const hint = ensureReferenceHintElement(group);
  const lang = input.dataset.lang || group.dataset.lang || FALLBACK_LANGUAGE;
  const hasReference = Boolean(referenceText && String(referenceText).trim());
  const hasValue = Boolean(input.value && input.value.trim());
  const shouldShow = lang !== baseLanguage && hasReference && !hasValue;

  input.dataset.referenceText = hasReference ? String(referenceText) : '';

  if (!hint) return;
  hint.textContent = shouldShow ? `日本語: ${referenceText}` : '';
  hint.classList.toggle('hidden', !shouldShow);
}

export function refreshReferenceHintForInput(input, baseLanguage = FALLBACK_LANGUAGE) {
  if (!input) return;
  setReferenceHintForInput(input, input.dataset.referenceText || '', baseLanguage);
}

function hydrateSingleLanguageField(container, value, languageOptions = {}, overrides = {}) {
  if (!container) return;

  const { activeLanguages = [FALLBACK_LANGUAGE], editorLanguage = FALLBACK_LANGUAGE } = languageOptions;
  const errorElement = container.querySelector('.error-message');
  const existingGroups = new Map();

  container.querySelectorAll('.input-group[data-lang]').forEach((group) => {
    existingGroups.set(group.dataset.lang, group);
  });

  const jaTemplate = existingGroups.get(FALLBACK_LANGUAGE);
  if (!jaTemplate) return;

  activeLanguages.forEach((langCode) => {
    if (!existingGroups.has(langCode)) {
      const fieldKey = overrides.fieldKey || container.dataset.fieldKey || 'field';
      let html = jaTemplate.outerHTML;
      html = html.replace(new RegExp(`(data-lang=)["']${FALLBACK_LANGUAGE}["']`, 'g'), `$1"${langCode}"`);
      html = html.replace(new RegExp(`(id=)["']${fieldKey}_${FALLBACK_LANGUAGE}["']`, 'g'), `$1"${fieldKey}_${langCode}"`);
      html = html.replace(new RegExp(`(for=)["']${fieldKey}_${FALLBACK_LANGUAGE}["']`, 'g'), `$1"${fieldKey}_${langCode}"`);

      if (errorElement) {
        errorElement.insertAdjacentHTML('beforebegin', html);
      } else {
        container.insertAdjacentHTML('beforeend', html);
      }
    }
    existingGroups.delete(langCode);
  });

  existingGroups.forEach((group) => group.remove());

  container.querySelectorAll('.input-group[data-lang]').forEach((group) => {
    const langCode = group.dataset.lang;
    if (!activeLanguages.includes(langCode)) return;

    group.classList.toggle('hidden', langCode !== editorLanguage);

    const input = group.querySelector('input, textarea');
    if (input) {
      const fieldKey = overrides.fieldKey || container.dataset.fieldKey || 'field';
      group.dataset.lang = langCode;
      input.dataset.lang = langCode;
      if (!input.id) {
        input.id = `${fieldKey}_${langCode}`;
      }

      input.value = getLocalizedText(value, langCode);
      const placeholderBase = overrides.placeholderJa ?? container.dataset.placeholderJa ?? '';
      input.placeholder = langCode === FALLBACK_LANGUAGE ? placeholderBase : '';
      setReferenceHintForInput(input, langCode === FALLBACK_LANGUAGE ? '' : getLocalizedText(value, FALLBACK_LANGUAGE));
    }

    const label = group.querySelector('.input-label');
    if (label) {
      if (input?.id) label.setAttribute('for', input.id);
      const baseLabel = overrides.label ?? container.dataset.label ?? '';
      const isRequired = overrides.required ?? (container.dataset.required === 'true');
      const langMeta = getLanguageMeta(languageOptions, langCode);
      let labelText = baseLabel;
      if (activeLanguages.length > 1) {
        labelText += `（${langMeta.shortLabel || langMeta.label}）`;
      }
      if (isRequired && baseLabel) {
        labelText += '<span class="text-error">*</span>';
      }
      label.innerHTML = labelText;
    }
  });
}

export function populateBasicInfo(surveyData, languageOptions = {}) {
  if (!surveyData) return;

  hydrateSingleLanguageField(document.querySelector('[data-field-key="surveyName"]'), surveyData.name, languageOptions, { fieldKey: 'surveyName' });
  hydrateSingleLanguageField(document.querySelector('[data-field-key="displayTitle"]'), surveyData.displayTitle, languageOptions, { fieldKey: 'displayTitle' });
  hydrateSingleLanguageField(document.querySelector('[data-field-key="description"]'), surveyData.description, languageOptions, { fieldKey: 'description' });

  const periodRangeInput = document.getElementById('periodRange');
  if (periodRangeInput && periodRangeInput._flatpickr) {
    if (surveyData.periodStart && surveyData.periodEnd) {
      periodRangeInput._flatpickr.setDate([surveyData.periodStart, surveyData.periodEnd], false);
    } else {
      periodRangeInput._flatpickr.clear(false);
    }
  }

  const deadlineInput = document.getElementById('deadline');
  const memoTextarea = document.getElementById('memo');
  if (deadlineInput) deadlineInput.value = surveyData.deadline || '';
  if (memoTextarea) memoTextarea.value = surveyData.memo || '';
}

function createStatusBadge(text, variant = '') {
  const badge = document.createElement('span');
  badge.className = `question-status-badge${variant ? ` ${variant}` : ''}`;
  badge.textContent = text;
  return badge;
}

function countMissingTranslations(value, languageOptions = {}) {
  const activeLanguages = Array.isArray(languageOptions.activeLanguages) ? languageOptions.activeLanguages : [FALLBACK_LANGUAGE];
  if (activeLanguages.length <= 1 || !languageOptions.allowMultilingual) return 0;

  return activeLanguages.filter((code) => code !== FALLBACK_LANGUAGE).reduce((sum, code) => {
    const translated = getLocalizedText(value, code).trim();
    return sum + (translated ? 0 : 1);
  }, 0);
}

function getQuestionStatus(question, languageOptions = {}) {
  const statuses = [];
  const textMissing = !getLocalizedText(question.text, FALLBACK_LANGUAGE).trim();
  if (textMissing) statuses.push({ text: '未入力', variant: 'is-danger' });

  const supportsOptions = ['single_answer', 'multi_answer', 'dropdown'].includes(question.type);
  if (supportsOptions && (!Array.isArray(question.options) || question.options.length < 2)) {
    statuses.push({ text: '選択肢不足', variant: 'is-warning' });
  }

  const isMatrix = question.type === 'matrix_sa' || question.type === 'matrix_ma';
  if (isMatrix) {
    const rows = Array.isArray(question.matrix?.rows) ? question.matrix.rows.length : 0;
    const cols = Array.isArray(question.matrix?.cols) ? question.matrix.cols.length : 0;
    if (rows === 0 || cols === 0) statuses.push({ text: '行列不足', variant: 'is-warning' });
  }

  if (question.meta?.jump?.targetQuestionId) statuses.push({ text: '分岐あり', variant: 'is-info' });

  const translationMissing = countMissingTranslations(question.text, languageOptions);
  if (translationMissing > 0) statuses.push({ text: '未翻訳あり', variant: 'is-warning' });

  return statuses;
}

function getGroupIssueCount(group, languageOptions = {}) {
  return (group.questions || []).reduce((count, question) => count + getQuestionStatus(question, languageOptions).length, 0);
}

function createTypeMenuItem(type, activeType, uiLang) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `question-type-menu-item${type === activeType ? ' is-active' : ''}`;
  button.dataset.questionTypeOption = type;
  const helpIcon = type === 'handwriting'
    ? `<span class="help-trigger help-inline-button material-icons" data-help-key="handwritingSpace" data-help-target="handwriting-type" aria-label="${t('questionTypes', type, uiLang)}の説明を表示">help_outline</span>`
    : '';
  button.innerHTML = `
    <span class="question-type-menu-item__content">
      <span>${t('questionTypes', type, uiLang)}</span>
      ${helpIcon}
    </span>
    <span class="material-icons question-type-menu-item__check">check</span>
  `;
  return button;
}

function createOptionElement(option, questionId, optionIndex, languageOptions = {}) {
  const template = document.getElementById('optionTemplate');
  const fragment = template.content.cloneNode(true);
  const optionItem = fragment.querySelector('.option-item');
  const optionGroup = optionItem.querySelector('.multi-lang-input-group');

  hydrateSingleLanguageField(optionGroup, option.text, languageOptions, {
    fieldKey: `option_${questionId}_${optionIndex}`,
    label: '選択肢',
    placeholderJa: '選択肢を入力'
  });

  const input = optionItem.querySelector('.option-text-input');
  if (input) {
    input.dataset.lang = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
    input.dataset.index = String(optionIndex);
  }

  return optionItem;
}

function createMatrixItem(type, value, index, questionId, languageOptions = {}) {
  const editorLanguage = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
  const langMeta = getLanguageMeta(languageOptions, editorLanguage);
  const wrapper = document.createElement('div');
  wrapper.className = `${type}-item`;
  wrapper.dataset.index = String(index);

  const handle = document.createElement('span');
  handle.className = 'material-icons text-on-surface-variant matrix-handle handle cursor-move mt-3';
  handle.textContent = 'drag_indicator';
  wrapper.appendChild(handle);

  const group = document.createElement('div');
  group.className = 'flex-grow input-group input-group-stacked question-builder-field';
  group.dataset.lang = editorLanguage;

  const label = document.createElement('label');
  label.className = 'input-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = `input-field question-builder-input ${type}-input`;
  input.dataset.index = String(index);
  input.dataset.lang = editorLanguage;
  input.id = `${type}_${questionId}_${index}_${editorLanguage}`;
  input.placeholder = editorLanguage === FALLBACK_LANGUAGE ? `${type === 'matrix-row' ? '行' : '列'}${index + 1}` : '';
  input.value = getLocalizedText(value.text, editorLanguage);

  label.setAttribute('for', input.id);
  label.textContent = `${type === 'matrix-row' ? '行' : '列'}（${langMeta.shortLabel || langMeta.label}）`;

  group.append(label, input);
  wrapper.appendChild(group);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = `icon-button delete-${type}-btn mt-2`;
  deleteBtn.dataset.index = String(index);
  deleteBtn.setAttribute('aria-label', `${type === 'matrix-row' ? '行' : '列'}を削除`);
  deleteBtn.innerHTML = '<span class="material-icons text-error">remove_circle_outline</span>';
  wrapper.appendChild(deleteBtn);

  setReferenceHintForInput(input, editorLanguage === FALLBACK_LANGUAGE ? '' : getLocalizedText(value.text, FALLBACK_LANGUAGE));

  return wrapper;
}

function createMatrixRowItem(row, rowIndex, questionId, languageOptions = {}) {
  return createMatrixItem('matrix-row', row, rowIndex, questionId, languageOptions);
}

function createMatrixColItem(col, colIndex, questionId, languageOptions = {}) {
  return createMatrixItem('matrix-col', col, colIndex, questionId, languageOptions);
}

function applyTextValidationConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="free_answer"]');
  if (!section) return;
  const visible = question.type === 'free_answer';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const validation = question.meta?.validation?.text || { minLength: '', maxLength: '' };
  const minInput = section.querySelector('[data-config-field="minLength"]');
  const maxInput = section.querySelector('[data-config-field="maxLength"]');
  if (minInput) minInput.value = validation.minLength ?? '';
  if (maxInput) maxInput.value = validation.maxLength ?? '';
}

function applyMultiAnswerConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="multi_answer"]');
  if (!section) return;
  const visible = question.type === 'multi_answer';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const maxSelectionsInput = section.querySelector('[data-config-field="maxSelections"]');
  if (maxSelectionsInput) {
    const optionCount = Array.isArray(question.options) ? question.options.length : 1;
    maxSelectionsInput.value = question.meta?.maxSelections ?? optionCount;
    maxSelectionsInput.max = String(optionCount);
  }
}

function applyNumberConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="number"]');
  if (!section) return;
  const visible = question.type === 'number_answer';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const numeric = question.meta?.validation?.numeric || DEFAULT_NUMERIC_META;
  const minInput = section.querySelector('[data-config-field="min"]');
  const maxInput = section.querySelector('[data-config-field="max"]');
  const stepInput = section.querySelector('[data-config-field="step"]');
  const unitLabelInput = section.querySelector('[data-config-field="unitLabel"]');
  if (minInput) minInput.value = numeric.min ?? '';
  if (maxInput) maxInput.value = numeric.max ?? '';
  if (stepInput) stepInput.value = numeric.step ?? 1;
  if (unitLabelInput) unitLabelInput.value = numeric.unitLabel || '';
}

function applyDateTimeConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="date_time"]');
  if (!section) return;
  const visible = question.type === 'date_time';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const config = question.meta?.dateTimeConfig || DEFAULT_DATETIME_META;
  const mode = config.inputMode || 'datetime';
  const showDateCheckbox = section.querySelector('[data-config-field="showDate"]');
  const showTimeCheckbox = section.querySelector('[data-config-field="showTime"]');
  if (showDateCheckbox) showDateCheckbox.checked = mode === 'date' || mode === 'datetime';
  if (showTimeCheckbox) showTimeCheckbox.checked = mode === 'time' || mode === 'datetime';
}

function applyHandwritingConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="handwriting"]');
  if (!section) return;
  const visible = question.type === 'handwriting';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const config = question.meta?.handwritingConfig || DEFAULT_HANDWRITING_META;
  const presetSelect = section.querySelector('[data-config-field="canvasHeightPreset"]');
  const customHeightGroup = section.querySelector('[data-handwriting-sub-config="customHeight"]');
  const customHeightInput = section.querySelector('[data-config-field="canvasHeight"]');
  if (!presetSelect || !customHeightGroup || !customHeightInput) return;

  const height = config.canvasHeight ?? 200;
  const presetValues = ['100', '200', '300', '500'];
  if (presetValues.includes(String(height))) {
    presetSelect.value = String(height);
    customHeightGroup.classList.add('hidden');
  } else {
    presetSelect.value = 'custom';
    customHeightGroup.classList.remove('hidden');
    customHeightInput.value = height;
  }
}

function applyExplanationCardConfig(questionItem, question, languageOptions = {}) {
  const section = questionItem.querySelector('[data-config-section="explanation_card"]');
  if (!section) return;
  const visible = question.type === 'explanation_card';
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  hydrateSingleLanguageField(section, question.explanationText, languageOptions, {
    fieldKey: `explanationDescription_${question.questionId}`,
    label: '説明文',
    placeholderJa: '説明文を入力'
  });
}

function applyChoiceOptions(questionItem, question, languageOptions = {}) {
  const section = questionItem.querySelector('[data-config-section="choice_options"]');
  if (!section) return;
  const visible = ['single_answer', 'multi_answer', 'dropdown'].includes(question.type);
  section.classList.toggle('hidden', !visible);
  if (!visible) return;

  const optionsContainer = section.querySelector('.options-container');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    (question.options || []).forEach((option, optionIndex) => {
      optionsContainer.appendChild(createOptionElement(option, question.questionId, optionIndex, languageOptions));
    });
  }

  const bulkInput = section.querySelector('.option-bulk-input');
  if (bulkInput) {
    bulkInput.value = (question.options || []).map((option) => getLocalizedText(option.text, FALLBACK_LANGUAGE)).join('\n');
  }

  const bulkPanel = section.querySelector('[data-option-bulk-panel]');
  const bulkToggle = section.querySelector('[data-option-bulk-toggle]');
  if (bulkPanel && bulkToggle) {
    bulkPanel.classList.add('hidden');
    bulkToggle.setAttribute('aria-expanded', 'false');
  }
}

function applyMatrixConfig(questionItem, question, languageOptions = {}) {
  const matrixEditor = questionItem.querySelector('.matrix-editor');
  if (!matrixEditor) return;
  const visible = question.type === 'matrix_sa' || question.type === 'matrix_ma';
  matrixEditor.classList.toggle('hidden', !visible);
  if (!visible) return;

  const matrixRowsList = matrixEditor.querySelector('.matrix-rows-list');
  const matrixColsList = matrixEditor.querySelector('.matrix-cols-list');
  if (matrixRowsList) {
    matrixRowsList.innerHTML = '';
    (question.matrix?.rows || []).forEach((row, rowIndex) => {
      matrixRowsList.appendChild(createMatrixRowItem(row, rowIndex, question.questionId, languageOptions));
    });
  }
  if (matrixColsList) {
    matrixColsList.innerHTML = '';
    (question.matrix?.cols || []).forEach((col, colIndex) => {
      matrixColsList.appendChild(createMatrixColItem(col, colIndex, question.questionId, languageOptions));
    });
  }
}

function applyJumpConfig(questionItem, question, languageOptions = {}) {
  const section = questionItem.querySelector('[data-config-section="jump"]');
  if (!section) return;
  const isExplanation = question.type === 'explanation_card';
  section.classList.toggle('hidden', isExplanation);
  if (isExplanation) return;

  const select = section.querySelector('.jump-target-select');
  const lockedMessage = section.querySelector('[data-jump-locked-message]');
  if (!select) return;

  const allowBranching = languageOptions.allowBranching === true;
  const targets = Array.isArray(languageOptions.jumpTargets) ? languageOptions.jumpTargets : [];
  const availableTargets = targets.filter((target) => target.id !== question.questionId);
  select.innerHTML = '<option value="">次の設問へ</option>';
  availableTargets.forEach((target) => {
    const option = document.createElement('option');
    option.value = target.id;
    option.textContent = target.label || target.id;
    select.appendChild(option);
  });

  select.value = question.meta?.jump?.targetQuestionId || '';
  select.disabled = !allowBranching;
  select.setAttribute('aria-disabled', allowBranching ? 'false' : 'true');
  if (lockedMessage) lockedMessage.classList.toggle('hidden', allowBranching);
}

function bindStackedFieldLabels(root, fieldPrefix) {
  root.querySelectorAll('.input-group.input-group-stacked.question-builder-field').forEach((group, index) => {
    const label = group.querySelector('.input-label');
    const control = group.querySelector('input, textarea, select');
    if (!label || !control) return;

    if (!control.id) {
      control.id = `${fieldPrefix}-${index}`;
    }
    label.setAttribute('for', control.id);
  });
}

function bindInlineToggleLabels(root, fieldPrefix) {
  root.querySelectorAll('.question-builder-inline-toggle').forEach((wrapper, index) => {
    const label = wrapper.querySelector('label');
    const control = wrapper.querySelector('input[type="checkbox"], input[type="radio"]');
    if (!label || !control) return;

    if (!control.id) {
      control.id = `${fieldPrefix}-toggle-${index}`;
    }
    label.setAttribute('for', control.id);
  });
}

function bindQuestionDetailLabels(questionItem, questionId) {
  if (!questionItem || !questionId) return;
  bindStackedFieldLabels(questionItem, `question-${questionId}-field`);
  bindInlineToggleLabels(questionItem, `question-${questionId}`);
}

function renderQuestion(question, uiLang, index, languageOptions = {}) {
  const template = document.getElementById('questionTemplate');
  const fragment = template.content.cloneNode(true);
  const questionItem = fragment.querySelector('.question-item');
  const summary = fragment.querySelector('.question-card-summary');
  const detailPanel = fragment.querySelector('.question-detail-panel');
  const requiredCheckbox = fragment.querySelector('.required-checkbox');
  const typeSelect = fragment.querySelector('.question-type-select');
  const typeTrigger = fragment.querySelector('[data-current-type-trigger]');
  const typeTriggerLabel = fragment.querySelector('[data-current-type-label]');
  const typeMenu = fragment.querySelector('[data-question-type-menu]');
  const questionTextGroup = fragment.querySelector('.multi-lang-input-group[data-field-key="questionText"]');

  questionItem.dataset.questionId = question.questionId;
  questionItem.dataset.questionType = question.type || 'free_answer';
  questionItem.id = `question-${question.questionId}`;

  const detailId = `question-detail-${question.questionId}`;
  const isExpanded = getStoredAccordionState(question.questionId, false);
  if (summary) {
    summary.dataset.accordionTarget = detailId;
    summary.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }
  if (detailPanel) {
    detailPanel.id = detailId;
    detailPanel.classList.toggle('hidden', !isExpanded);
  }

  const questionNumber = fragment.querySelector('[data-question-number]');
  if (questionNumber) questionNumber.textContent = `Q${index + 1}`;

  const summaryText = fragment.querySelector('[data-question-summary-text]');
  if (summaryText) summaryText.textContent = getDisplayText(question.text, languageOptions) || t('labels', 'untitledQuestion', uiLang);

  const typeLabel = fragment.querySelector('[data-question-type-label]');
  if (typeLabel) typeLabel.textContent = t('questionTypes', question.type, uiLang);

  const requiredBadge = fragment.querySelector('[data-question-required-badge]');
  if (requiredBadge) requiredBadge.classList.toggle('hidden', !question.required);

  const statusContainer = fragment.querySelector('[data-question-status-badges]');
  if (statusContainer) {
    statusContainer.innerHTML = '';
    const statuses = getQuestionStatus(question, languageOptions);
    statuses.slice(0, 2).forEach((status) => {
      statusContainer.appendChild(createStatusBadge(status.text, status.variant));
    });
    if (statuses.length > 2) {
      statusContainer.appendChild(createStatusBadge(`+${statuses.length - 2}`, 'is-info'));
    }
  }

  if (typeSelect) typeSelect.value = QUESTION_TYPE_ORDER.includes(question.type) ? question.type : 'free_answer';
  if (typeSelect) {
    typeSelect.id = `question-type-${question.questionId}`;
    typeSelect.name = `questionType_${question.questionId}`;
  }

  if (typeTriggerLabel) {
    typeTriggerLabel.textContent = t('questionTypes', question.type, uiLang);
  }
  if (typeMenu) {
    typeMenu.innerHTML = '';
    QUESTION_TYPE_ORDER.forEach((type) => {
      typeMenu.appendChild(createTypeMenuItem(type, question.type, uiLang));
    });
  }
  if (typeTrigger) typeTrigger.setAttribute('aria-expanded', 'false');

  hydrateSingleLanguageField(questionTextGroup, question.text, languageOptions, {
    fieldKey: `questionText_${question.questionId}`,
    label: '設問文',
    placeholderJa: '設問文を入力'
  });

  const textInput = questionItem.querySelector('.question-text-input');
  if (textInput) textInput.dataset.lang = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
  if (requiredCheckbox) requiredCheckbox.checked = Boolean(question.required);

  applyTextValidationConfig(questionItem, question);
  applyMultiAnswerConfig(questionItem, question);
  applyNumberConfig(questionItem, question);
  applyDateTimeConfig(questionItem, question);
  applyHandwritingConfig(questionItem, question);
  applyExplanationCardConfig(questionItem, question, languageOptions);
  applyChoiceOptions(questionItem, question, languageOptions);
  applyMatrixConfig(questionItem, question, languageOptions);
  applyJumpConfig(questionItem, question, languageOptions);

  const advancedPanel = questionItem.querySelector('[data-advanced-settings-panel]');
  const advancedToggle = questionItem.querySelector('[data-advanced-settings-toggle]');
  if (advancedPanel && advancedToggle) {
    const hasJump = Boolean(question.meta?.jump?.targetQuestionId);
    advancedPanel.classList.toggle('hidden', !hasJump);
    advancedToggle.setAttribute('aria-expanded', hasJump ? 'true' : 'false');
  }

  bindQuestionDetailLabels(questionItem, question.questionId);

  return questionItem;
}

function renderQuestionGroup(group, uiLang, languageOptions = {}) {
  const template = document.getElementById('questionGroupTemplate');
  const fragment = template.content.cloneNode(true);
  const groupItem = fragment.querySelector('.question-group');
  const header = fragment.querySelector('.group-header');
  const body = fragment.querySelector('.question-builder-group__body');
  const questionsList = fragment.querySelector('.questions-list');
  const titleGroup = fragment.querySelector('.multi-lang-input-group');

  groupItem.dataset.groupId = group.groupId;
  groupItem.id = `group-${group.groupId}`;

  const bodyId = `group-body-${group.groupId}`;
  const isExpanded = getStoredAccordionState(group.groupId, true);
  if (header) {
    header.dataset.accordionTarget = bodyId;
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }
  if (body) {
    body.id = bodyId;
    body.classList.toggle('hidden', !isExpanded);
  }

  hydrateSingleLanguageField(titleGroup, group.title, languageOptions, {
    fieldKey: `groupTitle_${group.groupId}`,
    label: 'グループタイトル',
    placeholderJa: 'グループタイトルを入力'
  });

  const titleInput = groupItem.querySelector('.group-title-input');
  if (titleInput) titleInput.dataset.lang = languageOptions.editorLanguage || FALLBACK_LANGUAGE;

  const countBadge = groupItem.querySelector('[data-group-question-count]');
  if (countBadge) countBadge.textContent = `${(group.questions || []).length}問`;

  const issueBadge = groupItem.querySelector('[data-group-issue-count]');
  const issueCount = getGroupIssueCount(group, languageOptions);
  if (issueBadge) {
    issueBadge.textContent = issueCount > 0 ? `${issueCount}件の確認事項` : '';
    issueBadge.classList.toggle('hidden', issueCount === 0);
  }

  if (questionsList) {
    questionsList.innerHTML = '';
    if (Array.isArray(group.questions) && group.questions.length > 0) {
      group.questions.forEach((question, index) => {
        questionsList.appendChild(renderQuestion(question, uiLang, index, languageOptions));
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'text-on-surface-variant text-sm p-4';
      empty.textContent = t('labels', 'noQuestions', uiLang);
      questionsList.appendChild(empty);
    }
  }

  return groupItem;
}

export function renderAllQuestionGroups(groups, uiLang, languageOptions = {}) {
  const container = document.getElementById('questionGroupsContainer');
  if (!container) return;

  container.innerHTML = '';
  if (!Array.isArray(groups) || groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-on-surface-variant p-4';
    empty.textContent = t('labels', 'noGroups', uiLang);
    container.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    container.appendChild(renderQuestionGroup(group, uiLang, languageOptions));
  });
}

export function renderOutlineMap() {
  const list = document.getElementById('outline-map-list');
  if (!list) return;

  const groupElements = Array.from(document.querySelectorAll('.question-group'));
  list.innerHTML = '';

  if (groupElements.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-on-surface-variant';
    empty.textContent = '設問を追加すると編集ナビが表示されます。';
    list.appendChild(empty);
    return;
  }

  groupElements.forEach((groupElement) => {
    const section = document.createElement('section');
    section.className = 'outline-nav-section';

    const groupToggle = document.createElement('button');
    groupToggle.type = 'button';
    groupToggle.className = 'outline-nav-group-toggle';
    groupToggle.dataset.outlineGroupToggle = groupElement.dataset.groupId || '';

    const titleInput = groupElement.querySelector('.group-title-input');
    const questionItems = Array.from(groupElement.querySelectorAll('.question-item'));
    const issueCount = questionItems.reduce((count, item) => count + item.querySelectorAll('.question-status-badge').length, 0);

    const groupText = document.createElement('span');
    groupText.className = 'outline-nav-group-text';

    const groupLabel = document.createElement('span');
    groupLabel.className = 'outline-nav-group-label';
    groupLabel.textContent = titleInput?.value?.trim() || t('labels', 'untitledGroup', FALLBACK_LANGUAGE);

    const groupMeta = document.createElement('span');
    groupMeta.className = 'outline-nav-group-meta';
    groupMeta.textContent = issueCount > 0 ? `${questionItems.length}問 / ${issueCount}件の確認事項` : `${questionItems.length}問`;
    groupText.append(groupLabel, groupMeta);
    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'material-icons';
    toggleIcon.textContent = 'expand_more';
    groupToggle.append(groupText, toggleIcon);
    section.appendChild(groupToggle);

    const questionList = document.createElement('div');
    questionList.className = 'outline-nav-question-list hidden';
    questionList.dataset.outlineGroupQuestions = groupElement.dataset.groupId || '';

    questionItems.forEach((questionItem) => {
      const questionLink = document.createElement('a');
      questionLink.href = `#${questionItem.id}`;
      questionLink.className = 'outline-nav-question-link';
      questionLink.dataset.outlineQuestionId = questionItem.dataset.questionId || '';

      const questionLabel = document.createElement('span');
      questionLabel.className = 'outline-nav-question-label';
      questionLabel.textContent = questionItem.querySelector('[data-question-summary-text]')?.textContent?.trim() || t('labels', 'untitledQuestion', FALLBACK_LANGUAGE);

      const typeLabel = questionItem.querySelector('[data-question-type-label]')?.textContent?.trim() || '';
      const statuses = Array.from(questionItem.querySelectorAll('.question-status-badge')).map((badge) => badge.textContent.trim()).filter(Boolean);
      const questionMeta = document.createElement('span');
      questionMeta.className = 'outline-nav-question-meta';
      questionMeta.textContent = statuses.length > 0 ? `${typeLabel} / ${statuses.join(' / ')}` : typeLabel;

      questionLink.append(questionLabel, questionMeta);
      questionList.appendChild(questionLink);
    });

    section.appendChild(questionList);
    list.appendChild(section);
  });
}

export function displayErrorMessage() {
  const container = document.getElementById('questionGroupsContainer');
  if (!container) return;
  container.innerHTML = '<p class="text-error p-4">アンケートの読み込み時にエラーが発生しました。</p>';
}

export function updateOutlineActionsState() {
  const outlineActions = document.getElementById('outline-action-buttons');
  const outlineMapList = document.getElementById('outline-map-list');
  if (!outlineActions || !outlineMapList) return;

  const hasOutlineEntries = Boolean(
    outlineMapList.querySelector('[data-outline-group-toggle], .outline-nav-question-link')
  );
  outlineActions.classList.toggle('hidden', !hasOutlineEntries);
  if (!hasOutlineEntries) return;

  const mainSaveBtn = document.getElementById('createSurveyBtn');
  const mainPreviewBtn = document.getElementById('showPreviewBtn');
  const outlineSaveBtn = outlineActions.querySelector('[data-outline-action="save"]');
  const outlinePreviewBtn = outlineActions.querySelector('[data-outline-action="preview"]');

  if (mainSaveBtn && outlineSaveBtn) {
    outlineSaveBtn.disabled = mainSaveBtn.disabled;
    if (!outlineSaveBtn.dataset.listener) {
      outlineSaveBtn.addEventListener('click', () => mainSaveBtn.click());
      outlineSaveBtn.dataset.listener = 'true';
    }
  }

  if (mainPreviewBtn && outlinePreviewBtn) {
    outlinePreviewBtn.disabled = mainPreviewBtn.disabled;
    if (!outlinePreviewBtn.dataset.listener) {
      outlinePreviewBtn.addEventListener('click', () => mainPreviewBtn.click());
      outlinePreviewBtn.dataset.listener = 'true';
    }
  }
}
