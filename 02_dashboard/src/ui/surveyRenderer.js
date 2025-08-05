/**
 * surveyRenderer.js
 * This file is responsible for rendering the survey creation UI based on the surveyData object.
 * It binds the data to the DOM elements and sets up listeners to update the data object on user input.
 */

// --- Helper function to safely get multilingual text ---
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
    surveyNameInput.value = getText(surveyData.name, lang);
    displayTitleInput.value = getText(surveyData.displayTitle, lang);
    descriptionTextarea.value = getText(surveyData.description, lang);
    periodStartInput.value = surveyData.periodStart || '';
    periodEndInput.value = surveyData.periodEnd || '';
    planSelect.value = surveyData.plan || 'Standard';
    deadlineInput.value = surveyData.deadline || '';
    memoTextarea.value = surveyData.memo || '';

    // --- Bind View to Data (Update data object on input) ---
    surveyNameInput.oninput = (e) => { surveyData.name[lang] = e.target.value; };
    displayTitleInput.oninput = (e) => { surveyData.displayTitle[lang] = e.target.value; };
    descriptionTextarea.oninput = (e) => { surveyData.description[lang] = e.target.value; };
    periodStartInput.onchange = (e) => { surveyData.periodStart = e.target.value; };
    periodEndInput.onchange = (e) => { surveyData.periodEnd = e.target.value; };
    planSelect.onchange = (e) => { surveyData.plan = e.target.value; };
    deadlineInput.onchange = (e) => { surveyData.deadline = e.target.value; };
    memoTextarea.oninput = (e) => { surveyData.memo = e.target.value; };
}

/**
 * Renders a single question.
 * @param {object} question - The question data object.
 * @param {string} lang - The current language code.
 * @param {number} index - The index of the question in its group.
 * @returns {HTMLElement} - The rendered question element.
 */
function renderQuestion(question, lang, index) {
    const questionTypes = {
        free_answer: 'フリーアンサー',
        single_answer: 'シングルアンサー',
        multi_answer: 'マルチアンサー',
        // ... other types
    };

    const template = document.getElementById('questionTemplate');
    const fragment = template.content.cloneNode(true);
    const questionItem = fragment.querySelector('.question-item');
    const questionTitle = fragment.querySelector('.question-title');
    const questionTextInput = fragment.querySelector('.question-text-input');
    const optionsContainer = fragment.querySelector('.options-container');
    const requiredCheckbox = fragment.querySelector('.required-checkbox');
    const duplicateBtn = fragment.querySelector('[aria-label="質問を複製"]');
    const deleteBtn = fragment.querySelector('[aria-label="質問を削除"]');

    duplicateBtn.classList.add('duplicate-question-btn');
    deleteBtn.classList.add('delete-question-btn');

    questionItem.dataset.questionId = question.questionId;
    questionTitle.textContent = `Q${index + 1}: ${questionTypes[question.type] || '不明なタイプ'}`;

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
            const deleteOptionBtn = optionFragment.querySelector('.delete-option-btn');
            
            optionItem.dataset.optionIndex = optIndex;
            optionInput.value = getText(opt.text, lang);
            optionInput.oninput = (e) => { opt.text[lang] = e.target.value; };
            optionsContainer.appendChild(optionFragment);
        });
        const addOptionButton = document.createElement('button');
        addOptionButton.className = 'text-sm text-primary hover:underline mt-2 add-option-btn';
        addOptionButton.textContent = '+ 選択肢を追加';
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
    const duplicateBtn = fragment.querySelector('[aria-label="グループを複製"]');
    const deleteBtn = fragment.querySelector('[aria-label="グループを削除"]');

    duplicateBtn.classList.add('duplicate-group-btn');
    deleteBtn.classList.add('delete-group-btn');

    groupItem.dataset.groupId = group.groupId;

    if (typeof group.title !== 'object' || group.title === null) group.title = { ja: '', en: '' };

    titleInput.value = getText(group.title, lang);
    titleInput.oninput = (e) => { group.title[lang] = e.target.value; };

    questionsList.innerHTML = ''; // Clear previous questions
    if (group.questions && group.questions.length > 0) {
        group.questions.forEach((q, i) => {
            questionsList.appendChild(renderQuestion(q, lang, i));
        });
    } else {
        questionsList.innerHTML = '<p class="text-on-surface-variant text-sm p-4">質問がありません。</p>';
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
    container.innerHTML = ''; // Clear the container

    if (groups && groups.length > 0) {
        groups.forEach(group => {
            container.appendChild(renderQuestionGroup(group, lang));
        });
    } else {
        container.innerHTML = '<p class="text-on-surface-variant p-4">質問グループがありません。</p>';
    }
}

/**
 * Renders the outline map for navigation.
 */
export function renderOutlineMap() {
    const outlineMapContainer = document.getElementById('outline-map-container');
    if (!outlineMapContainer) return;
    // This function can remain as is, as it just reads DOM h1/h2/h3 tags.
    // ... (implementation from the old file can be copied here if needed)
}

/**
 * Displays a generic error message.
 */
export function displayErrorMessage() {
    const container = document.getElementById('questionGroupsContainer');
    container.innerHTML = '<p class="text-error p-4">アンケートの読み込み中にエラーが発生しました。</p>';
}
