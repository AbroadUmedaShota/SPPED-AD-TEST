/**
 * surveyRenderer.js
 * Renders the survey creation UI based on the surveyData object.
 */

const I18N = {
  questionTypes: {
    ja: {
      free_answer: '自由記述',
      single_answer: '単一選択',
      multi_answer: '複数選択',
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
      addOption: '+ 選択肢を追加',
      noQuestions: '設問はまだありません。',
      noGroups: '質問グループはまだありません。',
      unknownType: '不明なタイプ'
    },
    en: {
      addOption: '+ Add option',
      noQuestions: 'No questions.',
      noGroups: 'No question groups.',
      unknownType: 'Unknown type'
    }
  }
};

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
    const v = value[lang];
    return typeof v === 'string' ? v : (v ?? '');
  }
  if (typeof value === 'string') {
    return lang === 'ja' ? value : '';
  }
  return '';
}

function getLanguageMeta(languageOptions = {}, code = FALLBACK_LANGUAGE) {
  const { languageMap } = languageOptions;
  if (languageMap && typeof languageMap.get === 'function') {
    const meta = languageMap.get(code);
    if (meta) {
      return meta;
    }
  }
  return { code, label: code, shortLabel: code };
}

function hydrateSingleLanguageField(container, value, languageOptions = {}, overrides = {}) {
    if (!container) return;

    const { activeLanguages = ['ja'], editorLanguage = 'ja' } = languageOptions;
    const errorElement = container.querySelector('.error-message');

    const existingGroups = new Map();
    container.querySelectorAll('.input-group[data-lang]').forEach(group => {
        existingGroups.set(group.dataset.lang, group);
    });

    const jaTemplate = existingGroups.get('ja');
    if (!jaTemplate) {
        console.warn('hydrateSingleLanguageField: Japanese template not found.');
        return;
    }

    activeLanguages.forEach(langCode => {
        if (!existingGroups.has(langCode)) {
            const fieldKey = overrides.fieldKey || container.dataset.fieldKey || 'field';
            let newHtml = jaTemplate.outerHTML;
            
            newHtml = newHtml.replace(new RegExp(`(data-lang=)["']ja["']`, 'g'), `$1"${langCode}"`);
            newHtml = newHtml.replace(new RegExp(`(id=)["']${fieldKey}_ja["']`, 'g'), `$1"${fieldKey}_${langCode}"`);
            newHtml = newHtml.replace(new RegExp(`(for=)["']${fieldKey}_ja["']`, 'g'), `$1"${fieldKey}_${langCode}"`);

            if (errorElement) {
                errorElement.insertAdjacentHTML('beforebegin', newHtml);
            } else {
                container.insertAdjacentHTML('beforeend', newHtml);
            }
        }
        existingGroups.delete(langCode);
    });

    existingGroups.forEach(group => group.remove());

    container.querySelectorAll('.input-group[data-lang]').forEach(group => {
        const langCode = group.dataset.lang;
        if (!activeLanguages.includes(langCode)) return;

        group.classList.toggle('hidden', langCode !== editorLanguage);

        const input = group.querySelector('input, textarea');
        if (input) {
            input.value = getLocalizedText(value, langCode);
            const placeholderJa = overrides.placeholderJa ?? container.dataset.placeholderJa ?? ' ';
            const jaValue = getLocalizedText(value, 'ja');

            if (langCode === 'ja') {
                input.placeholder = placeholderJa;
            } else {
                input.placeholder = jaValue || placeholderJa;
            }

            // Add real-time placeholder updater for Japanese input
            if (langCode === 'ja') {
                const updater = (event) => {
                    const currentJaValue = event.target.value || '';
                    const otherInputGroups = container.querySelectorAll('.input-group:not([data-lang="ja"])');
                    otherInputGroups.forEach(group => {
                        const otherInput = group.querySelector('input, textarea');
                        if (otherInput) {
                            otherInput.placeholder = currentJaValue;
                        }
                    });
                };

                // Remove previous listener to avoid duplicates, then add the new one.
                if (input._placeholderUpdater) {
                    input.removeEventListener('input', input._placeholderUpdater);
                }
                input.addEventListener('input', updater);
                input._placeholderUpdater = updater; // Store reference for removal
            }
        }

        const label = group.querySelector('.input-label');
        if (label) {
            const langMeta = getLanguageMeta(languageOptions, langCode);
            const baseLabel = overrides.label ?? container.dataset.label ?? '';
            let labelText = baseLabel;
            if (activeLanguages.length > 1) {
                labelText += `（${langMeta.shortLabel || langMeta.label}）`;
            }
            const isRequired = overrides.required ?? (container.dataset.required === 'true');
            if (isRequired && baseLabel) {
                labelText += '<span class="text-error">*</span>';
            }
            label.innerHTML = labelText;
        }
    });
}

export function populateBasicInfo(surveyData, languageOptions = {}) {
  if (!surveyData) return;

  const surveyNameGroup = document.querySelector('[data-field-key="surveyName"]');
  hydrateSingleLanguageField(surveyNameGroup, surveyData.name, languageOptions, { fieldKey: 'surveyName' });

  const displayTitleGroup = document.querySelector('[data-field-key="displayTitle"]');
  hydrateSingleLanguageField(displayTitleGroup, surveyData.displayTitle, languageOptions, { fieldKey: 'displayTitle' });

  const descriptionGroup = document.querySelector('[data-field-key="description"]');
  hydrateSingleLanguageField(descriptionGroup, surveyData.description, languageOptions, { fieldKey: 'description' });

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

function createOptionElement(option, questionId, optionIndex, languageOptions, uiLang) {
  const optionTemplate = document.getElementById('optionTemplate');
  const optionFragment = optionTemplate.content.cloneNode(true);
  const optionItem = optionFragment.querySelector('.option-item');
  const optionGroup = optionItem.querySelector('.multi-lang-input-group');
  hydrateSingleLanguageField(optionGroup, option.text, languageOptions, {
    fieldKey: `option_${questionId}_${optionIndex}`,
    label: '選択肢'
  });
  const optionInput = optionItem.querySelector('.option-text-input');
  if (optionInput) {
    optionInput.dataset.lang = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
    optionInput.dataset.index = optionIndex;
  }
  return optionFragment;
}

function createMatrixRowItem(row, rowIndex, questionId, languageOptions) {
  const editorLanguage = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
  const langMeta = getLanguageMeta(languageOptions, editorLanguage);
  const wrapper = document.createElement('div');
  wrapper.className = 'matrix-row-item flex items-start gap-2';
  wrapper.setAttribute('data-index', String(rowIndex));

  const handle = document.createElement('span');
  handle.className = 'material-icons text-on-surface-variant matrix-handle cursor-move mt-3';
  handle.textContent = 'drag_indicator';
  wrapper.appendChild(handle);

  const inputGroup = document.createElement('div');
  inputGroup.className = 'flex-grow input-group';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-field matrix-row-input';
  input.dataset.index = String(rowIndex);
  input.dataset.lang = editorLanguage;
  input.id = `matrix_row_${questionId}_${rowIndex}_${editorLanguage}`;
  if (editorLanguage === 'ja') {
    input.placeholder = `行${rowIndex + 1}`;
  } else {
    const fallbackValue = getLocalizedText(row.text, 'ja');
    input.placeholder = fallbackValue || `行${rowIndex + 1}`;
  }
  input.value = getLocalizedText(row.text, editorLanguage);
  inputGroup.appendChild(input);

  const label = document.createElement('label');
  label.className = 'input-label';
  label.setAttribute('for', input.id);
  label.textContent = `行（${langMeta.shortLabel || langMeta.label}）`;
  inputGroup.appendChild(label);

  wrapper.appendChild(inputGroup);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-button delete-matrix-row-btn mt-2';
  deleteBtn.setAttribute('aria-label', '行を削除');
  deleteBtn.setAttribute('data-index', String(rowIndex));
  deleteBtn.innerHTML = '<span class="material-icons text-error">remove_circle_outline</span>';
  wrapper.appendChild(deleteBtn);

  return wrapper;
}

function createMatrixColItem(col, colIndex, questionId, languageOptions) {
  const editorLanguage = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
  const langMeta = getLanguageMeta(languageOptions, editorLanguage);
  const wrapper = document.createElement('div');
  wrapper.className = 'matrix-col-item flex items-start gap-2';
  wrapper.setAttribute('data-index', String(colIndex));

  const handle = document.createElement('span');
  handle.className = 'material-icons text-on-surface-variant matrix-handle cursor-move mt-3';
  handle.textContent = 'drag_indicator';
  wrapper.appendChild(handle);

  const inputGroup = document.createElement('div');
  inputGroup.className = 'flex-grow input-group';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-field matrix-col-input';
  input.dataset.index = String(colIndex);
  input.dataset.lang = editorLanguage;
  input.id = `matrix_col_${questionId}_${colIndex}_${editorLanguage}`;
  if (editorLanguage === 'ja') {
    input.placeholder = `列${colIndex + 1}`;
  } else {
    const fallbackValue = getLocalizedText(col.text, 'ja');
    input.placeholder = fallbackValue || `列${colIndex + 1}`;
  }
  input.value = getLocalizedText(col.text, editorLanguage);
  inputGroup.appendChild(input);

  const label = document.createElement('label');
  label.className = 'input-label';
  label.setAttribute('for', input.id);
  label.textContent = `列（${langMeta.shortLabel || langMeta.label}）`;
  inputGroup.appendChild(label);

  wrapper.appendChild(inputGroup);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-button delete-matrix-col-btn mt-2';
  deleteBtn.setAttribute('aria-label', '列を削除');
  deleteBtn.setAttribute('data-index', String(colIndex));
  deleteBtn.innerHTML = '<span class="material-icons text-error">remove_circle_outline</span>';
  wrapper.appendChild(deleteBtn);

  return wrapper;
}

function renderQuestion(question, uiLang, index, languageOptions = {}) {
  const template = document.getElementById('questionTemplate');
  const fragment = template.content.cloneNode(true);
  const questionItem = fragment.querySelector('.question-item');
  const requiredCheckbox = fragment.querySelector('.required-checkbox');
  const matrixEditor = fragment.querySelector('.matrix-editor');
  const typeSelect = fragment.querySelector('.question-type-select');

  const editorLanguage = languageOptions.editorLanguage || FALLBACK_LANGUAGE;

  questionItem.dataset.questionId = question.questionId;
  if (question.type) questionItem.dataset.questionType = question.type;


  if (typeSelect) {
    const supported = ['free_answer', 'single_answer', 'multi_answer', 'dropdown', 'number_answer', 'matrix_sa', 'matrix_ma', 'date_time', 'handwriting', 'explanation_card'];
    typeSelect.value = supported.includes(question.type) ? question.type : 'free_answer';
  }

  const questionTextGroup = questionItem.querySelector('.multi-lang-input-group[data-field-key="questionText"]');
  if (questionTextGroup) {
    hydrateSingleLanguageField(questionTextGroup, question.text, languageOptions, {
      fieldKey: `questionText_${question.questionId}`,
      label: '設問文'
    });
    const textInput = questionTextGroup.querySelector('.question-text-input');
    if (textInput) {
      textInput.dataset.lang = editorLanguage;
    }
  }

  if (requiredCheckbox) {
    requiredCheckbox.checked = !!question.required;
    const requiredLabel = fragment.querySelector('.required-label');
    const checkboxId = `q_${question.questionId}_required`;
    requiredCheckbox.id = checkboxId;
    if (requiredLabel) {
      requiredLabel.setAttribute('for', checkboxId);
    }
  }

  const optionsContainer = fragment.querySelector('.options-container');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    const supportsOptions = question.type === 'single_answer' || question.type === 'multi_answer' || question.type === 'dropdown';
    if (supportsOptions) {
      const list = Array.isArray(question.options) ? question.options : [];
      list.forEach((opt, optIndex) => {
        const optionFragment = createOptionElement(opt, question.questionId, optIndex, languageOptions, uiLang);
        optionsContainer.appendChild(optionFragment);
      });
      const addOptionButton = document.createElement('button');
      addOptionButton.type = 'button';
      addOptionButton.className = 'text-sm text-primary hover:underline mt-2 add-option-btn';
      addOptionButton.textContent = t('labels', 'addOption', uiLang);
      optionsContainer.appendChild(addOptionButton);
    }
  }

  const isMatrix = question.type === 'matrix_sa' || question.type === 'matrix_ma';
  if (matrixEditor) {
    matrixEditor.classList.toggle('hidden', !isMatrix);
  }
  if (isMatrix) {
    const matrix = question.matrix || { rows: [], cols: [] };
    const matrixRowsList = matrixEditor.querySelector('.matrix-rows-list');
    const matrixColsList = matrixEditor.querySelector('.matrix-cols-list');
    if (matrixRowsList) {
      matrixRowsList.innerHTML = '';
      (matrix.rows || []).forEach((row, rowIndex) => {
        matrixRowsList.appendChild(createMatrixRowItem(row, rowIndex, question.questionId, languageOptions));
      });
    }
    if (matrixColsList) {
      matrixColsList.innerHTML = '';
      (matrix.cols || []).forEach((col, colIndex) => {
        matrixColsList.appendChild(createMatrixColItem(col, colIndex, question.questionId, languageOptions));
      });
    }
  }

  applyNumberConfig(questionItem, question);
  applyDateTimeConfig(questionItem, question);
  applyHandwritingConfig(questionItem, question);
  applyTextValidationConfig(questionItem, question);
  applyExplanationCardConfig(questionItem, question, languageOptions);
  applyMultiAnswerConfig(questionItem, question);

  return questionItem;
}

function applyExplanationCardConfig(questionItem, question, languageOptions) {
  const section = questionItem.querySelector('[data-config-section="explanation_card"]');
  if (!section) return;
  if (question.type !== 'explanation_card') {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  hydrateSingleLanguageField(section, question.explanationText, languageOptions, {
    fieldKey: `explanationDescription_${question.questionId}`,
    label: '説明文'
  });
}


function applyNumberConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="number"]');
  if (!section) return;
  if (question.type !== 'number_answer') {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const numeric = (question.meta && question.meta.validation && question.meta.validation.numeric) || DEFAULT_NUMERIC_META;
  const minInput = section.querySelector('[data-config-field="min"]');
  if (minInput) minInput.value = numeric.min ?? '';
  const maxInput = section.querySelector('[data-config-field="max"]');
  if (maxInput) maxInput.value = numeric.max ?? '';
  const stepInput = section.querySelector('[data-config-field="step"]');
  if (stepInput) stepInput.value = numeric.step ?? 1;
  const unitLabelInput = section.querySelector('[data-config-field="unitLabel"]');
  if (unitLabelInput) unitLabelInput.value = numeric.unitLabel || '';
}

function applyDateTimeConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="date_time"]');
  if (!section) return;
  if (question.type !== 'date_time') {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const config = question.meta?.dateTimeConfig || DEFAULT_DATETIME_META;
  const mode = config.inputMode || 'datetime'; // Default to datetime if not set

  const showDateCheckbox = section.querySelector('[data-config-field="showDate"]');
  const showTimeCheckbox = section.querySelector('[data-config-field="showTime"]');

  if (showDateCheckbox) {
    showDateCheckbox.checked = (mode === 'date' || mode === 'datetime');
  }
  if (showTimeCheckbox) {
    showTimeCheckbox.checked = (mode === 'time' || mode === 'datetime');
  }
}

function applyHandwritingConfig(questionItem, question) {
  const section = questionItem.querySelector('[data-config-section="handwriting"]');
  if (!section) return;
  if (question.type !== 'handwriting') {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const config = question.meta?.handwritingConfig || DEFAULT_HANDWRITING_META;
  
  const presetSelect = section.querySelector('[data-config-field="canvasHeightPreset"]');
  const customHeightGroup = section.querySelector('[data-handwriting-sub-config="customHeight"]');
  const customHeightInput = section.querySelector('[data-config-field="canvasHeight"]');

  if (presetSelect && customHeightGroup && customHeightInput) {
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
}

function applyTextValidationConfig(questionItem, question) {
    const section = questionItem.querySelector('[data-config-section="free_answer"]');
    if (!section) return;

    if (question.type !== 'free_answer') {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    const validation = question.meta?.validation?.text || { minLength: '', maxLength: '' };

    const minLengthInput = section.querySelector('[data-config-field="minLength"]');
    if (minLengthInput) {
        minLengthInput.value = validation.minLength ?? '';
    }

    const maxLengthInput = section.querySelector('[data-config-field="maxLength"]');
    if (maxLengthInput) {
        maxLengthInput.value = validation.maxLength ?? '';
    }
}

function applyMultiAnswerConfig(questionItem, question) {
    const section = questionItem.querySelector('[data-config-section="multi_answer"]');
    if (!section) return;

    if (question.type !== 'multi_answer') {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    const maxSelectionsInput = section.querySelector('[data-config-field="maxSelections"]');
    if (maxSelectionsInput) {
        const meta = question.meta || {};
        const numOptions = Array.isArray(question.options) ? question.options.length : 1;
        maxSelectionsInput.value = meta.maxSelections ?? numOptions;
        maxSelectionsInput.max = numOptions;
    }
}


function renderQuestionGroup(group, uiLang, languageOptions = {}) {
  const template = document.getElementById('questionGroupTemplate');
  const fragment = template.content.cloneNode(true);
  const groupItem = fragment.querySelector('.question-group');
  const questionsList = fragment.querySelector('.questions-list');

  groupItem.dataset.groupId = group.groupId;

  const titleGroup = groupItem.querySelector('.multi-lang-input-group');
  if (titleGroup) {
    hydrateSingleLanguageField(titleGroup, group.title, languageOptions, {
      fieldKey: `groupTitle_${group.groupId}`,
      label: 'グループタイトル'
    });
    const titleInput = titleGroup.querySelector('.group-title-input');
    if (titleInput) {
      titleInput.dataset.lang = languageOptions.editorLanguage || FALLBACK_LANGUAGE;
    }
  }

  if (questionsList) {
    questionsList.innerHTML = '';
    if (Array.isArray(group.questions) && group.questions.length) {
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
  if (Array.isArray(groups) && groups.length) {
    groups.forEach((group) => {
      container.appendChild(renderQuestionGroup(group, uiLang, languageOptions));
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'text-on-surface-variant p-4';
    empty.textContent = t('labels', 'noGroups', uiLang);
    container.appendChild(empty);
  }
}

export function renderOutlineMap() {
  const outlineMapContainer = document.getElementById('outline-map-container');
  if (!outlineMapContainer) return;

  const mainContent = document.getElementById('survey-content-area');
  if (!mainContent) return;

  const headings = Array.from(mainContent.querySelectorAll('h2, .group-title-input, .question-text-input'));
  if (!headings.length) {
    outlineMapContainer.innerHTML = '';
    return;
  }

  let html = '<h3 class="text-lg font-semibold mb-4">目次</h3><ul class="space-y-2">';
  headings.forEach((h, idx) => {
    const isQuestion = h.classList.contains('question-text-input');
    const isGroup = h.classList.contains('group-title-input');
    
    let targetElement;
    let text;
    let level = 2;

    if (isQuestion) {
        targetElement = h.closest('.question-item');
        text = h.value || '';
        level = 3;
    } else if (isGroup) {
        targetElement = h.closest('.question-group');
        text = h.value || '';
        level = 2;
    } else { // h2
        targetElement = h;
        text = h.textContent || '';
        level = 1;
    }

    if (!targetElement) return;
    if (!targetElement.id) {
      targetElement.id = `section-gen-${idx}`;
    }

    const paddingLeft = (level - 1) * 16;
    if (!text.trim()) return;

    html += `
      <li>
        <a href="#${targetElement.id}" class="block text-on-surface-variant hover:text-primary text-sm truncate" style="padding-left: ${paddingLeft}px;" title="${text}">${text}</a>
      </li>
    `;
  });
  html += '</ul>';
  outlineMapContainer.innerHTML = html;
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

    const hasContent = outlineMapList.hasChildNodes();
    outlineActions.classList.toggle('hidden', !hasContent);

    if (!hasContent) return;

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