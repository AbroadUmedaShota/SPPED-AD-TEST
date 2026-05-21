import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';

/**
 * ドラッグ＆ドロップ機能を初期化する
 */
export function initializeDraggable() {
    const questionGroupsContainer = document.getElementById('questionGroupsContainer');

    // 質問グループの並べ替え
    new Sortable(questionGroupsContainer, {
        animation: 150,
        handle: '.group-header .handle', // ドラッグハンドル
        ghostClass: 'blue-background-class', // ドラッグ中のスタイル
        onEnd: function (evt) {
            // 並べ替え後の処理（必要であれば）
            console.log('Group moved:', evt.oldIndex, evt.newIndex);
        },
    });

    // 各質問グループ内の質問項目の並べ替え
    // MutationObserverを使って、動的に追加される質問グループにもSortableを適用
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('question-group')) {
                        const questionsList = node.querySelector('.questions-list');
                        if (questionsList) {
                            new Sortable(questionsList, {
                                animation: 150,
                                handle: '.question-item .handle', // ドラッグハンドル
                                ghostClass: 'blue-background-class', // ドラッグ中のスタイル
                                onEnd: function (evt) {
                                    // 並べ替え後の処理（必要であれば）
                                    console.log('Question moved:', evt.oldIndex, evt.newIndex);
                                    // 質問番号を振り直す
                                    const parentQuestionsList = evt.to;
                                    const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                                    remainingQuestions.forEach((q, i) => {
                                        const questionTitle = q.querySelector('.question-title');
                                        if (questionTitle) {
                                            const currentTitle = questionTitle.textContent;
                                            const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                                            const questionType = typeMatch ? typeMatch[1].trim() : '';
                                            questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                                        }
                                    });
                                },
                            });
                        }
                    }
                });
            }
        });
    });

    observer.observe(questionGroupsContainer, { childList: true });

    // 既存の質問グループにもSortableを適用
    questionGroupsContainer.querySelectorAll('.questions-list').forEach(questionsList => {
        new Sortable(questionsList, {
            animation: 150,
            handle: '.question-item .handle', // ドラッグハンドル
            ghostClass: 'blue-background-class', // ドラッグ中のスタイル
            onEnd: function (evt) {
                // 並べ替え後の処理（必要であれば）
                console.log('Question moved:', evt.oldIndex, evt.newIndex);
                // 質問番号を振り直す
                const parentQuestionsList = evt.to;
                const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                remainingQuestions.forEach((q, i) => {
                    const questionTitle = q.querySelector('.question-title');
                    if (questionTitle) {
                        const currentTitle = questionTitle.textContent;
                        const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                        const questionType = typeMatch ? typeMatch[1].trim() : '';
                        questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                    }
                });
            },
        });
    });
}