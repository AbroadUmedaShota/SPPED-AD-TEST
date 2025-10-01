function startSurveyCreationTutorial() {
    // --- DOM Elements ---
    let svgOverlay, maskRect; // maskRectはくり抜き用の矩形
    let popover, popoverTitle, popoverDescription, nextButton, closeButton;
    let currentHighlightedElement = null;
    let isTransitioning = false;

    // --- State ---
    let currentStepIndex = 0;
    let tutorialCompleted = false;
    const steps = [
        { selector: '#addNewGroupBtn', title: '設問グループ作成', description: 'こちらは設問を編集する画面です。まず、関連する質問をまとめる『グループ』を作成します。内容を確認後、「次へ」ボタンをクリックしてください。', position: 'bottom', showButtons: true, advanceOnClick: false },
        { selector: '#fab-main-button', title: '設問の追加', description: 'グループが作成されました。次に、画面右下の『+』ボタンをクリックして、最初の質問を追加してください。', position: 'left', advanceOnClick: true },
        { selector: 'button[data-question-type="free_answer"]', title: '設問形式の選択', description: '追加する設問の形式を選択します。まず、自由に文章で回答してもらう「フリーアンサー」を追加してみましょう。', position: 'left', advanceOnClick: true },
        { selector: '.question-item:last-child .question-text-input[data-lang="ja"]', title: '設問の作成（記述式）', description: '質問が追加されました。こちらに質問文をご入力ください。この『記述式』は、回答者が文章で自由に回答する形式の設問です。（例：弊社サービスを何でお知りになりましたか？）', position: 'bottom', showButtons: true },
        { selector: '.question-item:last-child .question-type-select', title: '設問の作成（単一選択）', description: '次にもう一つ、別の形式の質問を追加します。複数の選択肢から一つを選んでいただく『単一選択』です。質問文と、いくつかの選択肢をご入力ください。', position: 'bottom', showButtons: true },
        { selector: '#showPreviewBtn', title: 'プレビュー機能の確認', description: '設問が作成できました。回答者からどのように見えるかは、いつでも『プレビュー』機能でご確認いただけます。こちらをクリックしてご確認ください。', position: 'bottom', advanceOnClick: true },
        { selector: '#createSurveyBtn', title: 'トレーニング完了', description: '以上で、アンケート作成の一連の流れは完了となります。『アンケートを保存』をクリックして、このトレーニングを終了してください。', position: 'bottom', advanceOnClick: true }
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
            if (footer) {
                footer.style.display = step.showButtons === false ? 'none' : 'flex';
            }

            if (step.advanceOnClick) {
                const advanceHandler = () => { // e.preventDefault/stopPropagationを削除
                    showNextStep();
                };
                element.addEventListener('click', advanceHandler, { once: true });
                if (index === steps.length - 1) {
                    nextButton.style.display = 'none';
                    element.addEventListener('click', () => {
                        tutorialCompleted = true;
                        destroyTutorial();
                    }, { once: true });
                }
            }

            if (index === steps.length - 1) {
                nextButton.textContent = '完了';
            }

            isTransitioning = false;
        }, 300); // FABメニューのアニメーション完了を待つための遅延
    }

    // --- Initialization ---
    createTutorialUI();
    showNextStep();
}
