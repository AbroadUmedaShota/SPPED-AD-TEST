function startSurveyCreationTutorial() {
    const initTutorial = () => {
        // --- DOM Elements ---
        let highlightBox;
        let popover, popoverTitle, popoverDescription, nextButton, closeButton;
        let currentHighlightedElement = null;
        let isTransitioning = false;
        let dynamicStyle;

        // --- State ---
        let currentStepIndex = 0;
        let tutorialCompleted = false;
        const steps = [
            { selector: '#surveyName_ja', title: 'アンケート名の入力', description: 'まず、管理用のアンケート名を入力します。この名前は回答者には表示されません。', position: 'bottom', showButtons: true },
            { selector: '#displayTitle_ja', title: '表示タイトルの入力', description: '次に、回答者に表示されるアンケートのタイトルを入力します。', position: 'bottom', showButtons: true },
            { selector: '#periodRange', title: '回答期間の設定', description: 'アンケートの回答期間を設定します。本日から3日間の日程を自動で設定します。', position: 'bottom', showButtons: true },
            { selector: '#addNewGroupBtn', title: '設問グループ作成', description: 'こちらは設問を編集する画面です。まず、関連する質問をまとめる『グループ』を作成します。内容を確認後、「次へ」ボタンをクリックしてください。', position: 'bottom', showButtons: true },
            { selector: '#fab-main-button', title: '設問の追加', description: 'グループが作成されました。次に、画面右下の『+』ボタンをクリックして、最初の質問を追加してください。', position: 'left', showButtons: true },
            { selector: 'button[data-question-type="free_answer"]', title: '設問形式の選択', description: '追加する設問の形式を選択します。まず、自由に文章で回答してもらう「フリーアンサー」を追加してみましょう。', position: 'left', showButtons: true },
            { selector: '.question-item:last-child .question-text-input[data-lang="ja"]', title: '設問の作成（記述式）', description: '質問が追加されました。こちらに質問文をご入力ください。この『記述式』は、回答者が文章で自由に回答する形式の設問です。（例：弊社サービスを何でお知りになりましたか？）', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .question-type-select', title: '設問形式の変更', description: '次に、設問形式を「単一選択」に変更します。ドロップダウンをクリックして「単一選択」を選んでください。', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .question-type-select', title: '設問形式の自動変更', description: '設問形式を「単一選択」に自動で変更します。', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .question-text-input[data-lang="ja"]', title: '設問の作成（単一選択）', description: '設問形式が「単一選択」になりました。こちらに質問文をご入力ください。（例：最も満足している点をお選びください）', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .option-item:nth-child(1) .option-text-input[data-lang="ja"]', title: '選択肢の入力', description: '最初の選択肢を入力します。（例：価格）', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .option-item:nth-child(2) .option-text-input[data-lang="ja"]', title: '選択肢の入力', description: '二番目の選択肢を入力します。（例：機能）', position: 'bottom', showButtons: true },
            { selector: '#fab-main-button', title: '設問の追加（マルチアンサー）', description: '次に、複数の選択肢から複数を選んでいただく『マルチアンサー』形式の設問を追加します。画面右下の『+』ボタンをクリックしてください。', position: 'left', showButtons: true },
            { selector: 'button[data-question-type="multi_answer"]', title: '設問形式の選択（マルチアンサー）', description: '「マルチアンサー」を選択してください。', position: 'left', showButtons: true },
            { selector: '.question-item:last-child .question-text-input[data-lang="ja"]', title: '設問の作成（マルチアンサー）', description: '設問形式が「マルチアンサー」になりました。こちらに質問文をご入力ください。（例：改善してほしい点をお選びください）', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .option-item:nth-child(1) .option-text-input[data-lang="ja"]', title: '選択肢の入力', description: '最初の選択肢を入力します。（例：UIデザイン）', position: 'bottom', showButtons: true },
            { selector: '.question-item:last-child .option-item:nth-child(2) .option-text-input[data-lang="ja"]', title: '選択肢の入力', description: '二番目の選択肢を入力します。（例：機能の豊富さ）', position: 'bottom', showButtons: true },
            { 
                selector: '#showPreviewBtn', 
                title: 'プレビュー機能の確認', 
                description: '設問が作成できました。回答者からどのように見えるかは、いつでも『プレビュー』機能でご確認いただけます。こちらをクリックしてご確認ください。', 
                position: 'bottom', 
                showButtons: false,
                awaitClick: true
            },
            { 
                selector: '.modal-content', 
                title: 'プレビュー画面', 
                description: 'こちらが回答者に表示されるプレビュー画面です。右上の「×」ボタンでプレビューを閉じてから、トレーニングを完了してください。', 
                position: 'top', 
                showButtons: true 
            },
            { selector: '#createSurveyBtn', title: 'トレーニング完了', description: '以上で、アンケート作成の一連の流れは完了となります。『アンケートを保存』をクリックして、このトレーニングを終了してください。', position: 'bottom', showButtons: true }
        ];

        function createTutorialUI() {
            // --- Highlight Box ---
            highlightBox = document.createElement('div');
            highlightBox.id = 'custom-tutorial-highlight-box';
            document.body.appendChild(highlightBox);

            // --- Dynamic Styles ---
            dynamicStyle = document.createElement('style');
            dynamicStyle.textContent = `
                #custom-tutorial-highlight-box {
                    position: fixed;
                    border-radius: 8px;
                    box-shadow: 0 0 0 5000px rgba(0, 0, 0, 0.7);
                    z-index: 10001;
                    pointer-events: none;
                    transition: top 0.3s ease-in-out, left 0.3s ease-in-out, width 0.3s ease-in-out, height 0.3s ease-in-out;
                }
                .custom-tutorial-highlight-target {
                    position: relative;
                    z-index: 10001;
                    pointer-events: auto;
                }
                /* Popover base styles */
                #custom-tutorial-popover {
                    position: fixed;
                    background-color: #fff;
                    color: #333;
                    border-radius: 8px;
                    padding: 15px 20px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    max-width: 350px;
                    z-index: 10002;
                    transition: opacity 0.3s ease;
                    opacity: 1;
                }
                #custom-tutorial-popover h3 {
                    margin-top: 0;
                    font-size: 1.2em;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                #custom-tutorial-popover p {
                    margin-bottom: 15px;
                    line-height: 1.6;
                    font-size: 0.95em;
                }
                .tutorial-footer {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 8px;
                    margin-top: 10px;
                }
                #custom-tutorial-next-btn {
                    background-color: #1a73e8;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    padding: 8px 15px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                .tutorial-close-btn {
                    background-color: transparent;
                    color: #5f6368;
                    border: none;
                    padding: 8px 15px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(dynamicStyle);

            // --- Popover ---
            popover = document.createElement('div');
            popover.id = 'custom-tutorial-popover';
            popover.innerHTML = `
                <h3 id="custom-tutorial-title"></h3>
                <p id="custom-tutorial-description"></p>
                <div class="tutorial-footer">
                    <button id="custom-tutorial-close-btn" class="tutorial-close-btn">閉じる</button>
                    <button id="custom-tutorial-next-btn">次へ</button>
                </div>
            `;
            document.body.appendChild(popover);

            popoverTitle = document.getElementById('custom-tutorial-title');
            popoverDescription = document.getElementById('custom-tutorial-description');
            nextButton = document.getElementById('custom-tutorial-next-btn');
            closeButton = document.getElementById('custom-tutorial-close-btn');

            nextButton.addEventListener('click', showNextStep);
            closeButton.addEventListener('click', destroyTutorial);
        }

        function destroyTutorial() {
            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('custom-tutorial-highlight-target');
            }
            if (highlightBox) highlightBox.remove();
            if (popover) popover.remove();
            if (dynamicStyle) dynamicStyle.remove();

            const nextStatus = tutorialCompleted ? 'completed' : 'pending';
            localStorage.setItem('speedad-tutorial-status', nextStatus);
            if (tutorialCompleted) {
                localStorage.removeItem('speedad-tutorial-last-survey-params');
            }
        }

        function showNextStep() {
            if (isTransitioning) return;

            if (currentStepIndex >= steps.length) {
                tutorialCompleted = true;
                destroyTutorial();
                return;
            }
            showStep(currentStepIndex);
            currentStepIndex++;
        }

        function showStep(index) {
            if (isTransitioning) return;
            isTransitioning = true;

            // --- Previous step cleanup ---
            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('custom-tutorial-highlight-target');
            }
            highlightBox.style.width = '0px';
            highlightBox.style.height = '0px';
            highlightBox.style.top = '50%';
            highlightBox.style.left = '50%';


            const fabButton = document.getElementById('fab-main-button');
            if (fabButton) {
                fabButton.blur();
            }

            const step = steps[index];
            const element = document.querySelector(step.selector);

            if (!element) {
                console.warn(`Tutorial element not found: ${step.selector}`);
                isTransitioning = false;
                showNextStep();
                return;
            }
            
            element.scrollIntoView({ behavior: 'auto', block: 'center' });

            setTimeout(() => {
                // Tutorial actions
                if (step.selector === '#surveyName_ja') {
                    element.focus();
                    element.value = '（自動入力）新製品満足度調査';
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (step.selector === '#displayTitle_ja') {
                    element.focus();
                    element.value = '（自動入力）新製品に関する満足度アンケート';
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (step.selector === '#periodRange') {
                    if (element._flatpickr) {
                        element.focus();
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const threeDaysAfterTomorrow = new Date();
                        threeDaysAfterTomorrow.setDate(tomorrow.getDate() + 3);
                        element._flatpickr.setDate([tomorrow, threeDaysAfterTomorrow], true);
                        setTimeout(() => element._flatpickr.open(), 100);
                    }
                }
    
                currentHighlightedElement = element;
                
                // --- Highlight with box-shadow ---
                element.classList.add('custom-tutorial-highlight-target');
                const rect = element.getBoundingClientRect();
                const padding = 4;
                highlightBox.style.top = `${rect.top - padding}px`;
                highlightBox.style.left = `${rect.left - padding}px`;
                highlightBox.style.width = `${rect.width + (padding * 2)}px`;
                highlightBox.style.height = `${rect.height + (padding * 2)}px`;

                // --- Position Popover ---
                popoverTitle.textContent = step.title;
                popoverDescription.textContent = step.description;
                
                const popoverRect = popover.getBoundingClientRect();
                popover.className = `position-${step.position}`;

                let top, left;
                const offset = 15;

                switch (step.position) {
                    case 'top':
                        top = rect.top - popoverRect.height - offset;
                        left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
                        break;
                    case 'left':
                        top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                        left = rect.left - popoverRect.width - offset;
                        break;
                    case 'right':
                        top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                        left = rect.right + offset;
                        break;
                    case 'bottom':
                    default:
                        top = rect.bottom + offset;
                        left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
                        break;
                }

                const margin = 10;
                if (top < margin) top = margin;
                if (left < margin) left = margin;
                if (left + popoverRect.width > window.innerWidth - margin) {
                    left = window.innerWidth - popoverRect.width - margin;
                }
                if (top + popoverRect.height > window.innerHeight - margin) {
                    top = window.innerHeight - popoverRect.height - margin;
                }

                popover.style.position = 'fixed';
                popover.style.top = `${top}px`;
                popover.style.left = `${left}px`;
                
                const footer = popover.querySelector('.tutorial-footer');
                footer.style.display = step.showButtons === false ? 'none' : 'flex';

                if (index === steps.length - 1) {
                    nextButton.textContent = '完了';
                } else {
                    nextButton.textContent = '次へ';
                }

                if (step.awaitClick) {
                    const clickHandler = (e) => {
                        if (e.target.closest('#custom-tutorial-popover')) return;
                        element.removeEventListener('click', clickHandler, true);

                        const nextStepSelector = steps[index + 1]?.selector;
                        if (!nextStepSelector) {
                            showNextStep();
                            return;
                        }

                        const interval = 100;
                        const timeout = 5000;
                        let elapsedTime = 0;

                        const pollForElement = setInterval(() => {
                            const nextElement = document.querySelector(nextStepSelector);
                            if (nextElement && nextElement.getBoundingClientRect().width > 0) {
                                clearInterval(pollForElement);
                                showNextStep();
                            }

                            elapsedTime += interval;
                            if (elapsedTime >= timeout) {
                                clearInterval(pollForElement);
                                console.warn(`Tutorial timed out waiting for element: ${nextStepSelector}`);
                                showNextStep();
                            }
                        }, interval);
                    };
                    element.addEventListener('click', clickHandler, { once: true, capture: true });
                }

                isTransitioning = false;
            }, 300);
        }

        // --- Initialization ---
        createTutorialUI();
        showNextStep();
    };

    // メインスクリプトの初期化完了を待ってからチュートリアルを開始
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initTutorial, 100);
    } else {
        document.addEventListener('pageInitialized', initTutorial, { once: true });
    }
}
