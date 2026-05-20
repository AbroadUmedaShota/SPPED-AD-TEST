let questionTypeSelector;
let openQuestionTypeSelectorBtn;

export function initFloatingActionButton(addNewQuestionGroupCallback, addNewQuestionCallback) {
    openQuestionTypeSelectorBtn = document.getElementById('openQuestionTypeSelectorBtn');
    questionTypeSelector = document.getElementById('questionTypeSelector');

    if (openQuestionTypeSelectorBtn) {
        openQuestionTypeSelectorBtn.addEventListener('click', () => {
            toggleQuestionTypeSelector();
        });
    }

    // 各質問タイプボタンのイベントリスナー
    document.getElementById('addFreeAnswerBtn').addEventListener('click', () => {
        addNewQuestionCallback('free_answer');
        toggleQuestionTypeSelector(false); // 選択後閉じる
    });
    document.getElementById('addSingleAnswerBtn').addEventListener('click', () => {
        addNewQuestionCallback('single_answer');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addMultiAnswerBtn').addEventListener('click', () => {
        addNewQuestionCallback('multi_answer');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addNumberAnswerBtn').addEventListener('click', () => {
        addNewQuestionCallback('number_answer');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addMatrixSABtn').addEventListener('click', () => {
        addNewQuestionCallback('matrix_sa');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addMatrixMABtn').addEventListener('click', () => {
        addNewQuestionCallback('matrix_ma');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addDateTimeBtn').addEventListener('click', () => {
        addNewQuestionCallback('date_time');
        toggleQuestionTypeSelector(false);
    });
    document.getElementById('addHandwritingBtn').addEventListener('click', () => {
        addNewQuestionCallback('handwriting');
        toggleQuestionTypeSelector(false);
    });

    // 「質問グループを追加」ボタンのイベントリスナー
    const addQuestionGroupBtn = document.getElementById('addQuestionGroupBtn');
    if (addQuestionGroupBtn) {
        addQuestionGroupBtn.addEventListener('click', () => {
            addNewQuestionGroupCallback();
            toggleQuestionTypeSelector(false);
        });
    }

    // 外部クリックでセレクターを閉じる
    document.addEventListener('click', (event) => {
        if (questionTypeSelector && !questionTypeSelector.classList.contains('opacity-0')) {
            const isClickInsideFab = openQuestionTypeSelectorBtn.contains(event.target);
            const isClickInsideSelector = questionTypeSelector.contains(event.target);
            if (!isClickInsideFab && !isClickInsideSelector) {
                toggleQuestionTypeSelector(false);
            }
        }
    });

    // ウィンドウのリサイズ時にセレクターを閉じる
    window.addEventListener('resize', () => {
        toggleQuestionTypeSelector(false);
    });
}

function toggleQuestionTypeSelector(forceClose = null) {
    if (!questionTypeSelector) return;

    const isHidden = questionTypeSelector.classList.contains('opacity-0');

    if (forceClose === true) {
        questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
    } else if (forceClose === false) {
        questionTypeSelector.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
        updateQuestionTypeSelectorPosition();
    } else {
        if (isHidden) {
            questionTypeSelector.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            updateQuestionTypeSelectorPosition();
        } else {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    }
}

function updateQuestionTypeSelectorPosition() {
    if (!openQuestionTypeSelectorBtn || !questionTypeSelector) return;

    const fabRect = openQuestionTypeSelectorBtn.getBoundingClientRect();
    const selectorWidth = questionTypeSelector.offsetWidth;
    const selectorHeight = questionTypeSelector.offsetHeight;

    // FABの左上に配置
    let left = fabRect.left;
    let top = fabRect.top - selectorHeight - 10; // FABの上10pxに配置

    // 画面右端からはみ出さないように調整
    if (left + selectorWidth > window.innerWidth - 20) {
        left = window.innerWidth - selectorWidth - 20;
    }
    // 画面左端からはみ出さないように調整
    if (left < 20) {
        left = 20;
    }
    // 画面上端からはみ出さないように調整
    if (top < 20) {
        top = fabRect.bottom + 10; // FABの下10pxに配置
    }

    questionTypeSelector.style.left = `${left}px`;
    questionTypeSelector.style.top = `${top}px`;
}
