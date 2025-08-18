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
            fetch('data/surveys.json'),
            fetch('data/sample_survey.json')
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
            <h1 class="text-2xl sm:text-3xl font-bold text-on-surface mb-2">${surveyInfo.displayTitle.ja}</h1>
            <p class="text-on-surface-variant">${surveyInfo.description.ja}</p>
            <hr class="my-6 border-outline-variant">
        `;
        surveyHeader.innerHTML = headerHTML;
        document.title = `SpeedAd - ${surveyInfo.displayTitle.ja}`;
    }

    function renderQuestions(questionGroups) {
        let formHTML = '';
        questionGroups.forEach((group, groupIndex) => {
            formHTML += `<div class="mb-8">
                           <h2 class="text-xl font-bold text-on-surface mb-4 border-b-2 border-primary pb-2">${group.title.ja}</h2>`;
            group.questions.forEach((question, questionIndex) => {
                formHTML += renderQuestion(question, groupIndex, questionIndex);
            });
            formHTML += `</div>`;
        });
        surveyForm.innerHTML = formHTML;
    }

    function renderQuestion(question, groupIndex, questionIndex) {
        const isRequired = question.required ? '<span class="text-red-500 ml-2 text-sm">*必須</span>' : '';
        let questionHTML = `
            <div class="mb-6 p-4 border border-outline-variant rounded-lg">
                <label class="block text-base font-semibold text-on-surface-variant mb-2">Q${groupIndex + 1}-${questionIndex + 1}. ${question.text.ja}${isRequired}</label>
        `;

        switch (question.type) {
            case 'free_answer':
                questionHTML += `<textarea name="${question.questionId}" class="input-field w-full" rows="4" ${question.required ? 'required' : ''}></textarea>`;
                break;
            case 'single_answer':
                question.options.forEach(option => {
                    questionHTML += `
                        <div class="flex items-center mb-2">
                            <input type="radio" id="${option.optionId}" name="${question.questionId}" value="${option.text.ja}" class="form-radio text-primary focus:ring-primary" ${question.required ? 'required' : ''}>
                            <label for="${option.optionId}" class="ml-3 text-on-surface">${option.text.ja}</label>
                        </div>
                    `;
                });
                break;
            // 他の質問タイプ（multiple_answerなど）のケースもここに追加可能
        }
        questionHTML += `</div>`;
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
