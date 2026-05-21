document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    const isContinuous = params.get('continuous') === 'true';

    const container = document.getElementById('continuous-answer-container');
    const button = document.getElementById('continuous-answer-button');

    if (isContinuous && surveyId && container && button) {
        // 連続回答が有効な場合、ボタンを表示してリンクを設定
        container.classList.remove('hidden');
        button.href = `survey-answer.html?surveyId=${surveyId}`;
    }

});
