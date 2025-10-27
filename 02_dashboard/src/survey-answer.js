import { resolveDashboardDataPath } from './utils.js';

// --- DOM要素の取得 ---
const surveyContainer = document.getElementById('survey-container');
const surveyHeader = document.getElementById('survey-header');
const surveyForm = document.getElementById('survey-form');
const completionMessage = document.getElementById('completion-message');
const completionContent = document.getElementById('completion-content');
const errorContainer = document.getElementById('error-container');
const bizcardSection = document.getElementById('bizcard-section');
const bizcardUpload = document.getElementById('bizcard-upload');
const bizcardPreviewContainer = document.getElementById('bizcard-preview-container');
const bizcardPreview = document.getElementById('bizcard-preview');
const bizcardRemove = document.getElementById('bizcard-remove');

/**
 * 初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('id');

    if (!surveyId) {
        displayError('アンケートIDが指定されていません。');
        return;
    }

    try {
        // アンケートIDに対応するJSONデータを取得
        const surveyRes = await fetch(resolveDashboardDataPath(`surveys/${surveyId}.json`));
        if (!surveyRes.ok) {
            throw new Error(`アンケート定義ファイルが見つかりません (ID: ${surveyId})`);
        }
        const surveyData = await surveyRes.json();
        const questionGroups = normalizeSurveyQuestionGroups(surveyData);
        if (!questionGroups.length) {
            displayError('No questions available for this survey.');
            return;
        }

        // UIの描画
        renderSurveyHeader(surveyData);
        renderQuestions(questionGroups);
        renderSubmitButton();

        // 機能のセットアップ
        setupBizcardFeature(surveyData);
        setupFormSubmission(surveyId, surveyData.thankYouScreenSettings);

    } catch (error) {
        console.error(error);
        displayError(error.message);
    }
});

/**
 * エラーメッセージを表示する
 * @param {string} message - 表示するエラーメッセージ
 */
function displayError(message) {
    surveyContainer.classList.add('hidden');
    const errorMessageElement = document.getElementById('error-message');
    if (errorMessageElement) {
        const paragraph = document.createElement('p');
        paragraph.textContent = message;
        errorMessageElement.replaceChildren(paragraph);
    }
    errorContainer.classList.remove('hidden');
}

/**
 * 多言語テキストから表示用の文字列を取得する
 * @param {string|object} value - 多言語テキストまたはプレーンテキスト
 * @param {string} [defaultValue=''] - フォールバックテキスト
 * @returns {string} 表示に利用する文字列
 */
function resolveLocalizedText(value, defaultValue = '') {
    if (!value) {
        return defaultValue;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        return trimmedValue || defaultValue;
    }

    if (typeof value === 'object') {
        if (typeof value.ja === 'string' && value.ja.trim()) {
            return value.ja.trim();
        }

        for (const localeValue of Object.values(value)) {
            if (typeof localeValue === 'string' && localeValue.trim()) {
                return localeValue.trim();
            }
        }
    }

    return defaultValue;
}

/**
 * アンケートのヘッダーを描画する
 * @param {object} surveyData - アンケートデータ
 */
function normalizeSurveyQuestionGroups(surveyData) {
    const hasGroups = Array.isArray(surveyData?.questionGroups) && surveyData.questionGroups.length > 0;
    if (hasGroups) {
        return surveyData.questionGroups.map((group, groupIndex) => ({
            ...group,
            groupId: group.groupId || `group-${groupIndex + 1}`,
            questions: (group.questions || []).map((question, questionIndex) =>
                normalizeQuestion(question, questionIndex, group.groupId || `group-${groupIndex + 1}`)
            )
        }));
    }

    const hasDetails = Array.isArray(surveyData?.details) && surveyData.details.length > 0;
    if (hasDetails) {
        return [
            {
                groupId: 'default-group',
                title: resolveLocalizedText(surveyData.displayTitle, 'Survey'),
                questions: surveyData.details.map((question, questionIndex) =>
                    normalizeQuestion(question, questionIndex, 'default-group')
                )
            }
        ];
    }

    return [];
}

function normalizeQuestion(rawQuestion, questionIndex, groupId) {
    const fallbackId = `${groupId || 'group'}-q${questionIndex + 1}`;
    const questionId = rawQuestion.questionId || rawQuestion.id || fallbackId;
    const normalizedType = normalizeQuestionType(rawQuestion.type);
    const questionText = resolveLocalizedText(rawQuestion.text || rawQuestion.title || '');
    const required =
        rawQuestion.required === true ||
        rawQuestion.isRequired === true ||
        rawQuestion.mandatory === true;
    const optionsSource = rawQuestion.options || rawQuestion.choices || [];
    const options = (normalizedType === 'single_answer' || normalizedType === 'multi_choice')
        ? normalizeOptions(optionsSource, questionId)
        : [];

    return {
        ...rawQuestion,
        questionId,
        type: normalizedType,
        text: questionText,
        required,
        options
    };
}

function normalizeQuestionType(type) {
    switch (type) {
        case 'free_answer':
        case 'free_text':
        case 'text':
            return 'free_answer';
        case 'single_answer':
        case 'single_choice':
        case 'radio':
            return 'single_answer';
        case 'multi_choice':
        case 'multi_answer':
        case 'multiple_choice':
        case 'checkbox':
            return 'multi_choice';
        default:
            return 'free_answer';
    }
}

function normalizeOptions(options, questionId) {
    return (options || []).map((option, index) => {
        if (typeof option === 'string') {
            const trimmed = option.trim();
            const fallbackId = `${questionId}-option-${index + 1}`;
            return {
                optionId: fallbackId,
                value: fallbackId,
                text: trimmed || `Option ${index + 1}`
            };
        }

        const optionId = option.optionId || option.id || `${questionId}-option-${index + 1}`;
        const optionText = resolveLocalizedText(option.text || option.label || option.name || '');
        const optionValue = option.value || optionId || optionText || `${questionId}-option-${index + 1}`;

        return {
            ...option,
            optionId,
            value: optionValue,
            text: optionText || `Option ${index + 1}`
        };
    });
}

function renderSurveyHeader(surveyData) {
    const title = resolveLocalizedText(surveyData.displayTitle, 'アンケート');
    const description = resolveLocalizedText(surveyData.description);
    const headerHTML = `
        <h1 class="text-2xl sm:text-3xl font-bold text-on-surface mb-4" id="survey-title">${title}</h1>
        <p class="text-on-surface-variant">${description}</p>
        <hr class="my-6 border-outline-variant" aria-hidden="true">
    `;
    surveyHeader.innerHTML = headerHTML;
    document.title = `SpeedAd - ${title}`;
}

/**
 * 設問を動的に生成する
 * @param {Array} questionGroups - 設問グループの配列
 */
function renderQuestions(questionGroups) {
    let formHTML = '';
    (questionGroups || []).forEach((group, groupIndex) => {
        const groupHeadingId = `question-group-${group.groupId || groupIndex}`;
        const groupTitle = resolveLocalizedText(group.title);
        const sectionTitle = groupTitle || `Section ${groupIndex + 1}`;
        formHTML += `
            <section class="mb-10" aria-labelledby="${groupHeadingId}">
                <h2 id="${groupHeadingId}" class="text-xl font-bold text-on-surface mb-4 border-b-2 border-primary pb-2">${sectionTitle}</h2>
                <div class="space-y-6">
        `;
        (group.questions || []).forEach((question, questionIndex) => {
            formHTML += renderQuestion(question, groupIndex, questionIndex);
        });
        formHTML += `
                </div>
            </section>
        `;
    });
    surveyForm.insertAdjacentHTML('afterbegin', formHTML);
}

function renderQuestion(question, groupIndex, questionIndex) {
    const questionNumber = `Q${groupIndex + 1}-${questionIndex + 1}`;
    const questionText = resolveLocalizedText(question.text);
    const requirementHintId = `${question.questionId}-requirement`;
    const ariaAttributes = [];
    const dataAttributes = [`data-question-type="${question.type}"`];
    if (question.required) {
        ariaAttributes.push('aria-required="true"');
        ariaAttributes.push(`aria-describedby="${requirementHintId}"`);
        dataAttributes.push('data-required="true"');
    }
    const fieldsetAttributesParts = [...ariaAttributes, ...dataAttributes];
    const fieldsetAttributes = fieldsetAttributesParts.length ? ` ${fieldsetAttributesParts.join(' ')}` : '';
    const requiredBadge = question.required
        ? '<span class="ml-2 text-sm font-medium text-error" aria-hidden="true">�K�{</span>'
        : '';
    const requirementHint = question.required
        ? `<p id="${requirementHintId}" class="sr-only">${questionNumber} ${questionText}�͕K�{�̐ݖ�ł��B</p>`
        : '';

    let questionHTML = `
        <fieldset class="space-y-3 rounded-lg border border-outline-variant p-4"${fieldsetAttributes}>
            <legend class="text-base font-semibold text-on-surface-variant">
                <span>${questionNumber}. ${questionText}</span>
                ${requiredBadge}
            </legend>
            ${requirementHint}
            <div class="space-y-3">
    `;

    const controlIdBase = `${question.questionId}`;

    switch (question.type) {
        case 'free_answer':
            {
                const textareaId = `${controlIdBase}-input`;
                const requirementAttrs = question.required
                    ? ` required aria-required="true" aria-describedby="${requirementHintId}"`
                    : '';
                questionHTML += `
                    <label for="${textareaId}" class="sr-only">${questionText}�ւ̉�</label>
                    <textarea id="${textareaId}" name="${question.questionId}" class="input-field w-full" rows="4"${requirementAttrs}></textarea>
                `;
            }
            break;
        case 'single_answer':
            {
                const options = question.options || [];
                options.forEach((option, optionIndex) => {
                    const optionText = resolveLocalizedText(option.text);
                    const optionId = `${controlIdBase}-${option.optionId || optionIndex}`;
                    const requiredAttribute = question.required && optionIndex === 0 ? 'required' : '';
                    questionHTML += `
                        <div class="flex items-center gap-3">
                            <input type="radio" id="${optionId}" name="${question.questionId}" value="${option.value}" class="form-radio text-primary focus:ring-primary" ${requiredAttribute}>
                            <label for="${optionId}" class="text-on-surface">${optionText}</label>
                        </div>
                    `;
                });
            }
            break;
        case 'multi_choice':
            {
                const options = question.options || [];
                options.forEach((option, optionIndex) => {
                    const optionText = resolveLocalizedText(option.text);
                    const optionId = `${controlIdBase}-${option.optionId || optionIndex}`;
                    questionHTML += `
                        <div class="flex items-center gap-3">
                            <input type="checkbox" id="${optionId}" name="${question.questionId}" value="${option.value}" class="form-checkbox text-primary focus:ring-primary">
                            <label for="${optionId}" class="text-on-surface">${optionText}</label>
                        </div>
                    `;
                });
            }
            break;
        default:
            {
                const textareaId = `${controlIdBase}-input`;
                questionHTML += `
                    <label for="${textareaId}" class="sr-only">${questionText}�ւ̉�</label>
                    <textarea id="${textareaId}" name="${question.questionId}" class="input-field w-full" rows="4"></textarea>
                `;
            }
            break;
    }
    questionHTML += `
            </div>
        </fieldset>
    `;
    return questionHTML;
}

/**
 * 送信ボタンを描画する
 */
function renderSubmitButton() {
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = '回答を送信する';
    button.className = 'w-full button-primary text-on-primary text-lg font-semibold py-3 rounded-full mt-8';
    surveyForm.appendChild(button);
}

/**
 * 名刺添付機能をセットアップする
 * @param {object} settings - アンケート設定
 */
function setupBizcardFeature(surveyData) {
    if (!isBizcardFeatureEnabled(surveyData)) return;

    bizcardSection.classList.remove('hidden');

    bizcardUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                bizcardPreview.src = e.target.result;
                bizcardPreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    bizcardRemove.addEventListener('click', () => {
        bizcardUpload.value = '';
        bizcardPreview.src = '#';
        bizcardPreviewContainer.classList.add('hidden');
    });
}

function isBizcardFeatureEnabled(surveyData) {
    if (!surveyData) return false;
    if (surveyData.settings?.bizcard?.enabled != null) {
        return surveyData.settings.bizcard.enabled === true;
    }
    if (surveyData.settings?.bizcardEnabled != null) {
        return surveyData.settings.bizcardEnabled === true;
    }
    if (surveyData.settings?.bizcard?.isEnabled != null) {
        return surveyData.settings.bizcard.isEnabled === true;
    }
    if (surveyData.bizcardEnabled != null) {
        return surveyData.bizcardEnabled === true;
    }
    return false;
}

/**
 * フォーム送信処理をセットアップする
 * @param {string} surveyId - アンケートID
 * @param {object} thankYouSettings - お礼画面の設定
 */
function setupFormSubmission(surveyId, thankYouSettings) {
    surveyForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(surveyForm);
        const answersMap = new Map();
        for (const [name, value] of formData.entries()) {
            if (!answersMap.has(name)) {
                answersMap.set(name, value);
                continue;
            }
            const current = answersMap.get(name);
            if (Array.isArray(current)) {
                current.push(value);
            } else {
                answersMap.set(name, [current, value]);
            }
        }

        // ���h�摜��FormData�ɒǉ�
        const bizcardFile = bizcardUpload.files[0];
        if (bizcardFile) {
            formData.append('bizcardImage', bizcardFile);
        }

        const answers = Array.from(answersMap.entries()).map(([questionId, answer]) => ({
            questionId,
            answer
        }));

        const submission = {
            surveyId: surveyId,
            submittedAt: new Date().toISOString(),
            answers: answers
        };

        console.log('Submission Data:', submission);
        // ������API�Ƀf�[�^�𑗐M���鏈���������I�Ɏ���
        // ��: await fetch('/api/submit', { method: 'POST', body: formData });

        displayCompletionMessage(thankYouSettings);
    });
}

/**
 * 回答完了メッセージを表示する
 * @param {object} settings - お礼画面の設定
 */
function displayCompletionMessage(settings) {
    const title = settings?.title || 'ご回答ありがとうございます';
    const message = settings?.message || 'ご協力に感謝いたします。';
    const imageUrl = settings?.imageUrl;

    let contentHTML = '';
    if (imageUrl) {
        contentHTML += `<img src="${imageUrl}" alt="Thank you image" class="mx-auto mb-6 max-h-60 rounded-lg">`;
    } else {
        contentHTML += `<span class="material-icons text-6xl text-primary" aria-hidden="true">check_circle</span>`;
    }
    contentHTML += `
        <h2 class="text-2xl font-bold mt-4">${title}</h2>
        <p class="text-on-surface-variant mt-2">${message}</p>
    `;

    surveyContainer.classList.add('hidden');
    completionContent.innerHTML = contentHTML;
    completionMessage.classList.remove('hidden');
    window.scrollTo(0, 0);
}
