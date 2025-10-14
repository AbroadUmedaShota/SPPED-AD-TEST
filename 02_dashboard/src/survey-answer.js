import { resolveDashboardDataPath } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const surveyContainer = document.getElementById('survey-container');
    const surveyHeader = document.getElementById('survey-header');
    const surveyForm = document.getElementById('survey-form');
    const completionMessage = document.getElementById('completion-message');

    // 1. URLからアンケートIDを取得
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('id');

    if (!surveyId) {
        surveyContainer.innerHTML = '<p class="text-red-500">エラー: アンケートIDが指定されていません。</p>';
        return;
    }

    try {
        // 2. 必要なJSONデータを並行して取得
        const [surveysRes, sampleSurveyRes] = await Promise.all([
            fetch(resolveDashboardDataPath('core/surveys.json')),
            fetch(resolveDashboardDataPath('surveys/sample_survey.json'))
        ]);

        if (!surveysRes.ok || !sampleSurveyRes.ok) {
            throw new Error('データの読み込みに失敗しました。');
        }

        const surveys = await surveysRes.json();
        const sampleSurvey = await sampleSurveyRes.json();

        // 3. IDに一致するアンケート情報を検索
        const surveyInfo = surveys.find(s => s.id === surveyId);

        if (!surveyInfo) {
            throw new Error('指定されたアンケートが見つかりません。');
        }

        // 4. アンケートのヘッダー情報を表示
        renderSurveyHeader(surveyInfo);

        // 5. 設問を動的に生成
        renderQuestions(sampleSurvey.questionGroups);

        // 6. 送信ボタンを追加
        renderSubmitButton();

    } catch (error) {
        surveyContainer.innerHTML = `<p class="text-red-500">エラーが発生しました: ${error.message}</p>`;
        console.error(error);
    }

    // --- ヘルパー関数 ---

    function renderSurveyHeader(surveyInfo) {
        const headerHTML = `
            <h1 class="text-2xl sm:text-3xl font-bold text-on-surface mb-4" id="survey-title">${surveyInfo.displayTitle.ja}</h1>
            <p class="text-on-surface-variant">${surveyInfo.description.ja}</p>
            <hr class="my-6 border-outline-variant" aria-hidden="true">
        `;
        surveyHeader.innerHTML = headerHTML;
        document.title = `SpeedAd - ${surveyInfo.displayTitle.ja}`;
    }

    function renderQuestions(questionGroups) {
        let formHTML = '';
        questionGroups.forEach((group, groupIndex) => {
            const groupHeadingId = `question-group-${group.groupId || groupIndex}`;
            formHTML += `
                <section class="mb-10" aria-labelledby="${groupHeadingId}">
                    <h2 id="${groupHeadingId}" class="text-xl font-bold text-on-surface mb-4 border-b-2 border-primary pb-2">${group.title.ja}</h2>
                    <div class="space-y-6">
            `;
            group.questions.forEach((question, questionIndex) => {
                formHTML += renderQuestion(question, groupIndex, questionIndex);
            });
            formHTML += `
                    </div>
                </section>
            `;
        });
        surveyForm.innerHTML = formHTML;
    }

    function renderQuestion(question, groupIndex, questionIndex) {
        const questionNumber = `Q${groupIndex + 1}-${questionIndex + 1}`;
        const questionText = question.text?.ja || question.text || '';
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
                        const optionText = option.text?.ja || option.text || '';
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

    function renderSubmitButton() {
        const button = document.createElement('button');
        button.type = 'submit';
        button.textContent = '回答を送信する';
        button.className = 'w-full button-primary text-on-primary text-lg font-semibold py-3 rounded-full';
        surveyForm.appendChild(button);
    }

    // 7. フォームの送信処理
    surveyForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const formData = new FormData(surveyForm);
        const answers = [];
        for (const [name, value] of formData.entries()) {
            answers.push({ questionId: name, answer: value });
        }

        const submission = {
            surveyId: surveyId,
            submittedAt: new Date().toISOString(),
            answers: answers
        };

        // 8. ローカルストレージに保存
        try {
            localStorage.setItem(`survey_answer_${surveyId}`, JSON.stringify(submission));
            
            // 9. 完了メッセージを表示
            surveyForm.classList.add('hidden');
            surveyHeader.classList.add('hidden');
            completionMessage.classList.remove('hidden');
            window.scrollTo(0, 0); // ページトップにスクロール

        } catch (error) {
            alert('回答の保存に失敗しました。');
            console.error('Failed to save to localStorage:', error);
        }
    });
});
