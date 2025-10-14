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

        // UIの描画
        renderSurveyHeader(surveyData);
        renderQuestions(surveyData.questionGroups);
        renderSubmitButton();

        // 機能のセットアップ
        setupBizcardFeature(surveyData.settings);
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
        formHTML += `
            <section class="mb-10" aria-labelledby="${groupHeadingId}">
                <h2 id="${groupHeadingId}" class="text-xl font-bold text-on-surface mb-4 border-b-2 border-primary pb-2">${groupTitle}</h2>
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

/**
 * 個別の設問HTMLを生成する
 * @param {object} question - 設問データ
 * @param {number} groupIndex - グループのインデックス
 * @param {number} questionIndex - 質問のインデックス
 * @returns {string} 生成されたHTML文字列
 */
function renderQuestion(question, groupIndex, questionIndex) {
    const questionNumber = `Q${groupIndex + 1}-${questionIndex + 1}`;
    const questionText = resolveLocalizedText(question.text);
    const requirementHintId = `${question.questionId}-requirement`;
    const ariaAttributes = [];
    if (question.required) {
        ariaAttributes.push('aria-required="true"');
        ariaAttributes.push(`aria-describedby="${requirementHintId}"`);
    }
    const fieldsetAttributes = ariaAttributes.length ? ` ${ariaAttributes.join(' ')}` : '';
    const requiredBadge = question.required
        ? '<span class="ml-2 text-sm font-medium text-error" aria-hidden="true">必須</span>'
        : '';
    const requirementHint = question.required
        ? `<p id="${requirementHintId}" class="sr-only">${questionNumber} ${questionText}は必須の設問です。</p>`
        : '';

    let questionHTML = `
        <fieldset class="space-y-3 rounded-lg border border-outline-variant p-4"${fieldsetAttributes}>
            <legend class="text-base font-semibold text-on-surface-variant">
                <span>${questionNumber}. ${questionText}</span>
                ${requiredBadge}
            </legend>
            ${requirementHint}
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
                    <label for="${textareaId}" class="sr-only">${questionText}への回答</label>
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
                    const requiredAttribute = question.required ? 'required' : '';
                    questionHTML += `
                        <div class="flex items-center gap-3">
                            <input type="radio" id="${optionId}" name="${question.questionId}" value="${optionText}" class="form-radio text-primary focus:ring-primary" ${requiredAttribute}>
                            <label for="${optionId}" class="text-on-surface">${optionText}</label>
                        </div>
                    `;
                });
            }
            break;
        // 他の質問タイプ（multiple_answerなど）のケースもここに追加可能
    }
    questionHTML += `
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
function setupBizcardFeature(settings) {
    if (!settings?.bizcardEnabled) return;

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

/**
 * フォーム送信処理をセットアップする
 * @param {string} surveyId - アンケートID
 * @param {object} thankYouSettings - お礼画面の設定
 */
function setupFormSubmission(surveyId, thankYouSettings) {
    surveyForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(surveyForm);
        const answers = [];
        for (const [name, value] of formData.entries()) {
            answers.push({ questionId: name, answer: value });
        }

        // 名刺画像をFormDataに追加
        const bizcardFile = bizcardUpload.files[0];
        if (bizcardFile) {
            formData.append('bizcardImage', bizcardFile);
        }

        const submission = {
            surveyId: surveyId,
            submittedAt: new Date().toISOString(),
            answers: answers
        };

        console.log('Submission Data:', submission);
        // ここでAPIにデータを送信する処理を将来的に実装
        // 例: await fetch('/api/submit', { method: 'POST', body: formData });

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