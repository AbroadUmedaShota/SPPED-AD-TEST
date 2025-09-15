/**
 * surveyRenderer.js
 * Renders the survey creation UI based on the surveyData object.
 */

// --- Simple i18n dictionaries for UI labels ---
const I18N = {
  questionTypes: {
    ja: {
      free_answer: '自由回答',
      single_answer: '単一回答',
      multi_answer: '複数回答',
      number_answer: '数値入力',
      matrix_sa: 'マトリクス（単一）',
      matrix_ma: 'マトリクス（複数）'
    },
    en: {
      free_answer: 'Free Text',
      single_answer: 'Single Choice',
      multi_answer: 'Multiple Choice',
      number_answer: 'Number',
      matrix_sa: 'Matrix (Single)',
      matrix_ma: 'Matrix (Multiple)'
    }
  },
  labels: {
    ja: {
      addOption: '+ 選択肢を追加',
      noQuestions: '設問がありません。',
      noGroups: '設問グループはありません。',
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
// Ensure labels are readable even if source encoding is broken
try {
  if (I18N.labels?.ja) {
    I18N.labels.ja.addOption = '+ Add option';
    I18N.labels.ja.noQuestions = 'No questions.';
    I18N.labels.ja.noGroups = 'No question groups.';
    I18N.labels.ja.unknownType = 'Unknown type';
  }
  if (I18N.questionTypes?.ja) {
    I18N.questionTypes.ja.free_answer = 'Free Text';
    I18N.questionTypes.ja.single_answer = 'Single Choice';
    I18N.questionTypes.ja.multi_answer = 'Multiple Choice';
    I18N.questionTypes.ja.number_answer = 'Number';
    I18N.questionTypes.ja.matrix_sa = 'Matrix (Single)';
    I18N.questionTypes.ja.matrix_ma = 'Matrix (Multiple)';
    if (!I18N.questionTypes.ja.date_time) I18N.questionTypes.ja.date_time = 'Date/Time';
    if (!I18N.questionTypes.ja.handwriting) I18N.questionTypes.ja.handwriting = 'Handwriting';
  }
} catch (_) { /* noop */ }
// Complete missing type labels (fallback; ASCII-safe)
try {
  if (!I18N.questionTypes?.ja?.date_time) I18N.questionTypes.ja.date_time = 'Date/Time';
  if (!I18N.questionTypes?.ja?.handwriting) I18N.questionTypes.ja.handwriting = 'Handwriting';
  if (!I18N.questionTypes?.en?.date_time) I18N.questionTypes.en.date_time = 'Date/Time';
  if (!I18N.questionTypes?.en?.handwriting) I18N.questionTypes.en.handwriting = 'Handwriting';
} catch (_) { /* noop */ }

function t(dict, key, lang) {
  const d = I18N[dict]?.[lang] || I18N[dict]?.ja || {};
  return d[key] || (I18N[dict]?.ja?.[key] || key);
}

/**
 * Populates the basic information section of the form.
 * @param {object} surveyData - The main survey data object.
 */
function toML(value) {
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value === 'string') return { ja: value, en: '' };
  return { ja: '', en: '' };
}

export function populateBasicInfo(surveyData) {
  if (!surveyData) return;

  // --- Get DOM Elements ---
  const surveyNameInputJa = document.getElementById('surveyName_ja');
  const surveyNameInputEn = document.getElementById('surveyName_en');
  const displayTitleInputJa = document.getElementById('displayTitle_ja');
  const displayTitleInputEn = document.getElementById('displayTitle_en');
  const descriptionTextareaJa = document.getElementById('description_ja');
  const descriptionTextareaEn = document.getElementById('description_en');
  const periodStartInput = document.getElementById('periodStart');
  const periodEndInput = document.getElementById('periodEnd');
  const planSelect = document.getElementById('plan');
  const deadlineInput = document.getElementById('deadline');
  const memoTextarea = document.getElementById('memo');

  // --- Bind Data to View (single-language friendly) ---
  const getStr = (v) => (v && typeof v === 'object') ? (v.ja || v.en || '') : (v || '');
  if (surveyNameInputJa) surveyNameInputJa.value = getStr(surveyData.name);
  if (displayTitleInputJa) displayTitleInputJa.value = getStr(surveyData.displayTitle);
  if (descriptionTextareaJa) descriptionTextareaJa.value = getStr(surveyData.description);
  
  if (periodStartInput) periodStartInput.value = surveyData.periodStart || '';
  if (periodEndInput) periodEndInput.value = surveyData.periodEnd || '';
  if (planSelect) planSelect.value = surveyData.plan || 'Standard';
  if (deadlineInput) deadlineInput.value = surveyData.deadline || '';
  if (memoTextarea) memoTextarea.value = surveyData.memo || '';
}

/**
 * Renders a single question.
 * @param {object} question - The question data object.
 * @param {string} lang - The current language code for UI labels.
 * @param {number} index - The index of the question in its group.
 * @returns {HTMLElement} - The rendered question element.
 */
function renderQuestion(question, lang, index) {
  const template = document.getElementById('questionTemplate');
  const fragment = template.content.cloneNode(true);
  const questionItem = fragment.querySelector('.question-item');
  const questionTitle = fragment.querySelector('.question-title');
  const requiredCheckbox = fragment.querySelector('.required-checkbox');
  const matrixEditor = fragment.querySelector('.matrix-editor');
  const matrixRowsList = fragment.querySelector('.matrix-rows-list');
  const matrixColsList = fragment.querySelector('.matrix-cols-list');
  const typeSelect = fragment.querySelector('.question-type-select');

  questionItem.dataset.questionId = question.questionId;
  if (question.type) questionItem.dataset.questionType = question.type;
  const fallbackType = (type, lang) => {
    const map = {
      date_time: { ja: '���t/����', en: 'Date/Time' },
      handwriting: { ja: '�菑���X�y�[�X', en: 'Handwriting' }
    };
    return (map[type] && map[type][lang]) || (map[type]?.ja) || null;
  };
  const typeJaMap = {
    free_answer: '自由記述',
    single_answer: '単一選択',
    multi_answer: '複数選択',
    number_answer: '数値入力',
    matrix_sa: 'マトリクス（単一）',
    matrix_ma: 'マトリクス（複数）',
    date_time: '日付/時刻',
    handwriting: '手書きスペース'
  };
  const labelJA = typeJaMap[question.type] || '不明なタイプ';
  questionTitle.textContent = `Q${index + 1}: ${labelJA}`;

  // Initialize type select
  if (typeSelect) {
    const supported = [
      'free_answer', 'single_answer', 'multi_answer', 'number_answer', 'matrix_sa', 'matrix_ma', 'date_time', 'handwriting'
    ];
    if (!supported.includes(question.type)) {
      typeSelect.value = 'free_answer';
    } else {
      typeSelect.value = question.type;
    }
  }

  const questionTextInputJa = questionItem.querySelector('.question-text-input[data-lang="ja"]');
  const questionTextInputEn = questionItem.querySelector('.question-text-input[data-lang="en"]');
  const getStr = (v) => (v && typeof v === 'object') ? (v.ja || v.en || '') : (v || '');
  if (questionTextInputJa) questionTextInputJa.value = getStr(question.text);

  // Assign unique id/for to avoid duplicate ids from template
  const requiredLabel = fragment.querySelector('.required-label');
  const requiredId = `q_${question.questionId}_required`;
  if (requiredCheckbox) requiredCheckbox.id = requiredId;
  if (requiredLabel) requiredLabel.setAttribute('for', requiredId);

  if (requiredCheckbox) requiredCheckbox.checked = question.required;
  if (requiredCheckbox) requiredCheckbox.onchange = (e) => { question.required = e.target.checked; };

  const optionsContainer = fragment.querySelector('.options-container');
  // Render options for single/multi only (not for matrix)
  if (question.options && !(question.type === 'matrix_sa' || question.type === 'matrix_ma')) {
    question.options.forEach((opt) => {
      const optionTemplate = document.getElementById('optionTemplate');
      const optionFragment = optionTemplate.content.cloneNode(true);
      const optionItem = optionFragment.querySelector('.option-item');
      
      const optionInputJa = optionItem.querySelector('.option-text-input[data-lang="ja"]');
      const optionInputEn = optionItem.querySelector('.option-text-input[data-lang="en"]');
      const getStr = (v) => (v && typeof v === 'object') ? (v.ja || v.en || '') : (v || '');
      if (optionInputJa) optionInputJa.value = getStr(opt.text);

      optionsContainer.appendChild(optionFragment);
    });
    const addOptionButton = document.createElement('button');
    addOptionButton.type = 'button';
    addOptionButton.className = 'text-sm text-primary hover:underline mt-2 add-option-btn';
    addOptionButton.textContent = t('labels', 'addOption', lang);
    optionsContainer.appendChild(addOptionButton);
  }

  // Render matrix editor for matrix types
  if (question.type === 'matrix_sa' || question.type === 'matrix_ma') {
    // Ensure matrix structure exists
    if (!question.matrix) {
      question.matrix = { rows: [], cols: [] };
    }
    if (!Array.isArray(question.matrix.rows)) question.matrix.rows = [];
    if (!Array.isArray(question.matrix.cols)) question.matrix.cols = [];

    // Provide minimum defaults for usability
    if (question.matrix.rows.length === 0) {
      question.matrix.rows.push({ text: { ja: '行1', en: '' } }, { text: { ja: '行2', en: '' } });
    }
    if (question.matrix.cols.length === 0) {
      question.matrix.cols.push({ text: { ja: '列1', en: '' } }, { text: { ja: '列2', en: '' } });
    }

    if (matrixEditor) {
      // Clear lists
      if (matrixRowsList) matrixRowsList.innerHTML = '';
      if (matrixColsList) matrixColsList.innerHTML = '';

      // Rows
      if (matrixRowsList) {
        question.matrix.rows.forEach((row, i) => {
          const _text = (row && typeof row.text === 'object') ? (row.text.ja || row.text.en || '') : (row.text || '');
          const wrapper = document.createElement('div');
          wrapper.className = 'matrix-row-item flex items-start gap-2';
          wrapper.setAttribute('data-index', String(i));
          wrapper.innerHTML = `
            <span class="material-icons text-on-surface-variant matrix-handle cursor-move mt-3">drag_indicator</span>
            <div class="flex-grow multi-lang-input-group">
              <div class="input-group">
                <input type="text" class="input-field matrix-row-input" data-lang="ja" data-index="${i}" placeholder=" " value="${_text}">
                <label class="input-label">行ラベル</label>
              </div>
              <div class="input-group">
                <input type="text" class="input-field matrix-row-input" data-lang="en" data-index="${i}" placeholder=" " value="${row.text && row.text.en ? row.text.en : ''}">
                <label class="input-label">English</label>
              </div>
            </div>
            <button type="button" class="icon-button delete-matrix-row-btn mt-2" aria-label="行を削除" data-index="${i}"><span class="material-icons text-error">remove_circle_outline</span></button>
          `;
          matrixRowsList.appendChild(wrapper);
        });
      }

      // Columns
      if (matrixColsList) {
        question.matrix.cols.forEach((col, j) => {
          const _text = (col && typeof col.text === 'object') ? (col.text.ja || col.text.en || '') : (col.text || '');
          const wrapper = document.createElement('div');
          wrapper.className = 'matrix-col-item flex items-start gap-2';
          wrapper.setAttribute('data-index', String(j));
          wrapper.innerHTML = `
            <span class="material-icons text-on-surface-variant matrix-handle cursor-move mt-3">drag_indicator</span>
            <div class="flex-grow multi-lang-input-group">
              <div class="input-group">
                <input type="text" class="input-field matrix-col-input" data-lang="ja" data-index="${j}" placeholder=" " value="${_text}">
                <label class="input-label">列ラベル</label>
              </div>
              <div class="input-group">
                <input type="text" class="input-field matrix-col-input" data-lang="en" data-index="${j}" placeholder=" " value="${col.text && col.text.en ? col.text.en : ''}">
                <label class="input-label">English</label>
              </div>
            </div>
            <button type="button" class="icon-button delete-matrix-col-btn mt-2" aria-label="列を削除" data-index="${j}"><span class="material-icons text-error">remove_circle_outline</span></button>
          `;
          matrixColsList.appendChild(wrapper);
        });
      }
    }
  } else {
    // Not matrix: clear editor area
    if (matrixRowsList) matrixRowsList.innerHTML = '';
    if (matrixColsList) matrixColsList.innerHTML = '';
  }

  return questionItem;
}

/**
 * Renders a single question group.
 * @param {object} group - The question group data object.
 * @param {string} lang - The current language code for UI labels.
 * @returns {HTMLElement} - The rendered question group element.
 */
function renderQuestionGroup(group, lang) {
  const template = document.getElementById('questionGroupTemplate');
  const fragment = template.content.cloneNode(true);
  const groupItem = fragment.querySelector('.question-group');
  const questionsList = fragment.querySelector('.questions-list');

  groupItem.dataset.groupId = group.groupId;

  group.title = toML(group.title);

  const titleInputJa = groupItem.querySelector('.group-title-input[data-lang="ja"]');
  const titleInputEn = groupItem.querySelector('.group-title-input[data-lang="en"]');
  if (titleInputJa) titleInputJa.value = group.title.ja || '';
  if (titleInputEn) titleInputEn.value = group.title.en || '';

  questionsList.innerHTML = '';
  if (group.questions && group.questions.length > 0) {
    group.questions.forEach((q, i) => {
      questionsList.appendChild(renderQuestion(q, lang, i));
    });
  } else {
    const msg = t('labels', 'noQuestions', lang);
    questionsList.innerHTML = `<p class="text-on-surface-variant text-sm p-4">${msg}</p>`;
  }

  return groupItem;
}

/**
 * Renders all question groups into the container.
 * @param {Array<object>} groups - An array of question group objects.
 * @param {string} lang - The current language code for UI labels.
 */
export function renderAllQuestionGroups(groups, lang) {
  const container = document.getElementById('questionGroupsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (groups && groups.length > 0) {
    groups.forEach(group => {
      container.appendChild(renderQuestionGroup(group, lang));
    });
  } else {
    const msg = t('labels', 'noGroups', lang);
    container.innerHTML = `<p class="text-on-surface-variant p-4">${msg}</p>`;
  }
}

/**
 * Renders the outline map for navigation.
 */
export function renderOutlineMap() {
  const outlineMapContainer = document.getElementById('outline-map-container');
  if (!outlineMapContainer) return;

  const main = document.querySelector('main');
  if (!main) return;

  const headings = Array.from(main.querySelectorAll('h2, h3'));
  if (!headings.length) {
    outlineMapContainer.innerHTML = '';
    return;
  }

  let html = '<h3 class="text-lg font-semibold mb-4">目次</h3><ul class="space-y-2">';
  headings.forEach((h, idx) => {
    if (!h.id) h.id = `section-${idx}`;
    const level = parseInt(h.tagName.substring(1), 10) || 2;
    const paddingLeft = (level - 2) * 16; // h2=0, h3=16
    const text = h.textContent || '';
    html += `
      <li>
        <a href="#${h.id}" class="block text-on-surface-variant hover:text-primary text-sm" style="padding-left: ${paddingLeft}px;">${text}</a>
      </li>
    `;
  });
  html += '</ul>';
  outlineMapContainer.innerHTML = html;

  // Override heading text to ASCII-safe label to avoid encoding issues
  try {
    const h3 = outlineMapContainer.querySelector('h3');
    if (h3) h3.textContent = 'Outline';
  } catch (_) { /* noop */ }
}

/**
 * Displays a generic error message.
 */
export function displayErrorMessage() {
  const container = document.getElementById('questionGroupsContainer');
  if (!container) return;
  container.innerHTML = '<p class="text-error p-4">アンケートの読み込み時にエラーが発生しました。</p>';
}
