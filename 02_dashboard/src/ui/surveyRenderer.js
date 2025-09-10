/**
 * surveyRenderer.js
 * Renders the survey creation UI based on the surveyData object and current language.
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

function t(dict, key, lang) {
  const d = I18N[dict]?.[lang] || I18N[dict]?.ja || {};
  return d[key] || (I18N[dict]?.ja?.[key] || key);
}

// --- Helper to safely get multilingual text ---
function getText(field, lang) {
  if (typeof field === 'object' && field !== null) {
    return field[lang] || field.ja || '';
  }
  return field || '';
}

/**
 * Populates the basic information section of the form.
 * @param {object} surveyData - The main survey data object.
 * @param {string} lang - The current language code ('ja' or 'en').
 */
export function populateBasicInfo(surveyData, lang) {
  if (!surveyData) return;

  // --- Get DOM Elements ---
  const surveyNameInput = document.getElementById('surveyName');
  const displayTitleInput = document.getElementById('displayTitle');
  const descriptionTextarea = document.getElementById('description');
  const periodStartInput = document.getElementById('periodStart');
  const periodEndInput = document.getElementById('periodEnd');
  const planSelect = document.getElementById('plan');
  const deadlineInput = document.getElementById('deadline');
  const memoTextarea = document.getElementById('memo');

  // --- Ensure multilingual fields are objects ---
  if (typeof surveyData.name !== 'object' || surveyData.name === null) surveyData.name = { ja: '', en: '' };
  if (typeof surveyData.displayTitle !== 'object' || surveyData.displayTitle === null) surveyData.displayTitle = { ja: '', en: '' };
  if (typeof surveyData.description !== 'object' || surveyData.description === null) surveyData.description = { ja: '', en: '' };

  // --- Bind Data to View ---
  if (surveyNameInput) surveyNameInput.value = getText(surveyData.name, lang);
  if (displayTitleInput) displayTitleInput.value = getText(surveyData.displayTitle, lang);
  if (descriptionTextarea) descriptionTextarea.value = getText(surveyData.description, lang);
  if (periodStartInput) periodStartInput.value = surveyData.periodStart || '';
  if (periodEndInput) periodEndInput.value = surveyData.periodEnd || '';
  if (planSelect) planSelect.value = surveyData.plan || 'Standard';
  if (deadlineInput) deadlineInput.value = surveyData.deadline || '';
  if (memoTextarea) memoTextarea.value = surveyData.memo || '';

  // --- Bind View to Data ---
  if (surveyNameInput) surveyNameInput.oninput = (e) => { surveyData.name[lang] = e.target.value; };
  if (displayTitleInput) displayTitleInput.oninput = (e) => { surveyData.displayTitle[lang] = e.target.value; };
  if (descriptionTextarea) descriptionTextarea.oninput = (e) => { surveyData.description[lang] = e.target.value; };
  if (periodStartInput) periodStartInput.onchange = (e) => { surveyData.periodStart = e.target.value; };
  if (periodEndInput) periodEndInput.onchange = (e) => { surveyData.periodEnd = e.target.value; };
  if (planSelect) planSelect.onchange = (e) => { surveyData.plan = e.target.value; };
  if (deadlineInput) deadlineInput.onchange = (e) => { surveyData.deadline = e.target.value; };
  if (memoTextarea) memoTextarea.oninput = (e) => { surveyData.memo = e.target.value; };
}

/**
 * Renders a single question.
 * @param {object} question - The question data object.
 * @param {string} lang - The current language code.
 * @param {number} index - The index of the question in its group.
 * @returns {HTMLElement} - The rendered question element.
 */
function renderQuestion(question, lang, index) {
  const template = document.getElementById('questionTemplate');
  const fragment = template.content.cloneNode(true);
  const questionItem = fragment.querySelector('.question-item');
  const questionTitle = fragment.querySelector('.question-title');
  const questionTextInput = fragment.querySelector('.question-text-input');
  const optionsContainer = fragment.querySelector('.options-container');
  const requiredCheckbox = fragment.querySelector('.required-checkbox');
  const duplicateBtn = fragment.querySelector('.duplicate-question-btn');
  const deleteBtn = fragment.querySelector('.delete-question-btn');

  duplicateBtn.classList.add('duplicate-question-btn');
  deleteBtn.classList.add('delete-question-btn');

  questionItem.dataset.questionId = question.questionId;
  const qTypeLabel = t('questionTypes', question.type, lang) || t('labels', 'unknownType', lang);
  questionTitle.textContent = `Q${index + 1}: ${qTypeLabel}`;

  // Ensure multilingual fields exist
  if (typeof question.text !== 'object' || question.text === null) question.text = { ja: '', en: '' };

  questionTextInput.value = getText(question.text, lang);
  questionTextInput.oninput = (e) => { question.text[lang] = e.target.value; };

  requiredCheckbox.checked = question.required;
  requiredCheckbox.onchange = (e) => { question.required = e.target.checked; };

  if (question.options) {
    question.options.forEach((opt, optIndex) => {
      if (typeof opt.text !== 'object' || opt.text === null) opt.text = { ja: '', en: '' };
      const optionTemplate = document.getElementById('optionTemplate');
      const optionFragment = optionTemplate.content.cloneNode(true);
      const optionItem = optionFragment.querySelector('.option-item');
      const optionInput = optionFragment.querySelector('.option-text-input');

      optionItem.dataset.optionIndex = optIndex;
      optionInput.value = getText(opt.text, lang);
      optionInput.oninput = (e) => { opt.text[lang] = e.target.value; };

      optionsContainer.appendChild(optionFragment);
    });
    const addOptionButton = document.createElement('button');
    addOptionButton.className = 'text-sm text-primary hover:underline mt-2 add-option-btn';
    addOptionButton.textContent = t('labels', 'addOption', lang);
    optionsContainer.appendChild(addOptionButton);
  }

  return questionItem;
}

/**
 * Renders a single question group.
 * @param {object} group - The question group data object.
 * @param {string} lang - The current language code.
 * @returns {HTMLElement} - The rendered question group element.
 */
function renderQuestionGroup(group, lang) {
  const template = document.getElementById('questionGroupTemplate');
  const fragment = template.content.cloneNode(true);
  const groupItem = fragment.querySelector('.question-group');
  const titleInput = fragment.querySelector('.group-title-input');
  const questionsList = fragment.querySelector('.questions-list');
  const duplicateBtn = fragment.querySelector('.duplicate-group-btn');
  const deleteBtn = fragment.querySelector('.delete-group-btn');

  duplicateBtn.classList.add('duplicate-group-btn');
  deleteBtn.classList.add('delete-group-btn');

  groupItem.dataset.groupId = group.groupId;

  if (typeof group.title !== 'object' || group.title === null) group.title = { ja: '', en: '' };

  titleInput.value = getText(group.title, lang);
  titleInput.oninput = (e) => { group.title[lang] = e.target.value; };

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
 * @param {string} lang - The current language code.
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
  // Implement if needed
}

/**
 * Displays a generic error message.
 */
export function displayErrorMessage() {
  const container = document.getElementById('questionGroupsContainer');
  if (!container) return;
  container.innerHTML = '<p class="text-error p-4">アンケートの読み込み時にエラーが発生しました。</p>';
}

