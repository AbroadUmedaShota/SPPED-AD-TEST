function startSurveyCreationTutorial() {
    const initTutorial = () => {
        // --- DOM Elements ---
        let svgOverlay, maskRect; // maskRectはくり抜き用の矩形
        let popover, popoverTitle, popoverDescription, nextButton, closeButton;
        let currentHighlightedElement = null;
        let isTransitioning = false;

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
            { selector: '#showPreviewBtn', title: 'プレビュー機能の確認', description: '設問が作成できました。回答者からどのように見えるかは、いつでも『プレビュー』機能でご確認いただけます。こちらをクリックしてご確認ください。', position: 'bottom', showButtons: true },
            { selector: '#createSurveyBtn', title: 'トレーニング完了', description: '以上で、アンケート作成の一連の流れは完了となります。『アンケートを保存』をクリックして、このトレーニングを終了してください。', position: 'bottom', showButtons: true }
        ];

        function createTutorialUI() {
            // --- SVG Overlay ---
            svgOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgOverlay.id = 'custom-tutorial-svg-overlay';
            svgOverlay.setAttribute('width', '100%');
            svgOverlay.setAttribute('height', '100%');
            
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
            mask.id = 'tutorial-mask';

            const maskBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            maskBg.setAttribute('x', '0');
            maskBg.setAttribute('y', '0');
            maskBg.setAttribute('width', '100%');
            maskBg.setAttribute('height', '100%');
            maskBg.setAttribute('fill', 'white'); // マスクの背景は白で、全体を覆う

            maskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            maskRect.setAttribute('fill', 'black'); // くり抜き部分は黒
            maskRect.setAttribute('rx', '8'); // 角丸
            maskRect.setAttribute('ry', '8'); // 角丸
            maskRect.style.transition = 'all 0.3s ease-in-out';

            mask.appendChild(maskBg);
            mask.appendChild(maskRect);
            defs.appendChild(mask);
            svgOverlay.appendChild(defs);

            const overlayRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            overlayRect.setAttribute('x', '0');
            overlayRect.setAttribute('y', '0');
            overlayRect.setAttribute('width', '100%');
            overlayRect.setAttribute('height', '100%');
            overlayRect.setAttribute('fill', 'rgba(0, 0, 0, 0.7)'); // オーバーレイの色
            overlayRect.setAttribute('mask', 'url(#tutorial-mask)'); // マスクを適用
            overlayRect.classList.add('overlay-rect'); // クリックイベント用
            svgOverlay.appendChild(overlayRect);
            
            document.body.appendChild(svgOverlay);

            // --- Popover ---
            popover = document.createElement('div');
            popover.id = 'custom-tutorial-popover';
            popover.style.zIndex = '10002'; // SVGオーバーレイより手前
            popover.innerHTML = `
                <div id="custom-tutorial-arrow"></div>
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
                currentHighlightedElement.classList.remove('custom-tutorial-highlight', 'custom-tutorial-highlight-light-bg');
            }
            if (svgOverlay) svgOverlay.remove();
            if (popover) popover.remove();
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

            // --- 前のステップのクリーンアップ ---
            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('custom-tutorial-highlight', 'custom-tutorial-highlight-light-bg');
            }
            // マスクをリセットして、次の描画に備える
            maskRect.setAttribute('x', '0');
            maskRect.setAttribute('y', '0');
            maskRect.setAttribute('width', '0');
            maskRect.setAttribute('height', '0');


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
            
            // スクロールを実行
            element.scrollIntoView({ behavior: 'auto', block: 'center' }); // 即時スクロール

            // DOMの再描画を待ってからハイライトとポップアップ表示
                    setTimeout(() => {
                        // Tutorial actions tied to visual focus
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
                                // Give a brief moment for setDate to process before opening
                                setTimeout(() => {
                                    element._flatpickr.open();
                                }, 100);
                            }
                        }
            
                        currentHighlightedElement = element;                
                // ハイライトクラス適用（枠線やグローのため）
                if (step.selector === 'button[data-question-type="free_answer"]') {
                    element.classList.add('custom-tutorial-highlight-light-bg');
                } else {
                    element.classList.add('custom-tutorial-highlight');
                }

                // SVGマスクの矩形を更新
                const rect = element.getBoundingClientRect();
                const padding = 8; // くり抜く領域の余白 (角丸に合わせて調整)
                maskRect.setAttribute('x', rect.left - padding);
                maskRect.setAttribute('y', rect.top - padding);
                maskRect.setAttribute('width', rect.width + (padding * 2));
                maskRect.setAttribute('height', rect.height + (padding * 2));


                // ポップアップ表示
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
                if (index === steps.length - 1) {
                    nextButton.textContent = '完了';
                }

                isTransitioning = false;
            }, 600); // FABメニューのアニメーション完了を待つための遅延
        }

        // --- Initialization ---
        createTutorialUI();
        showNextStep();
    };

    // メインスクリプトの初期化完了を待ってからチュートリアルを開始
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // 既にページが読み込み済みの場合、少し遅延させて実行
        setTimeout(initTutorial, 100);
    } else {
        document.addEventListener('pageInitialized', initTutorial, { once: true });
    }
}
