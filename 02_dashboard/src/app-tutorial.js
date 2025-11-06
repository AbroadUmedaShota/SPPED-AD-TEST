    const initTutorial = () => {
        if (window.isTutorialActive !== undefined) {
            window.isTutorialActive = true; // Set global flag when tutorial starts
        }
        // --- DOM Elements ---
        let svgOverlay, maskRect;
        let popover, popoverTitle, popoverDescription, nextButton, closeButton;
        let currentHighlightedElement = null;
        let isTransitioning = false;

        // --- State ---
        let currentStepIndex = parseInt(localStorage.getItem('speedad-tutorial-step') || '0', 10);
        let tutorialCompleted = false;

        const steps = [
            { page: '/02_dashboard/index.html', selector: '#openNewSurveyModalBtn', title: 'ようこそ！', description: 'SPEED ADへようこそ！まず、アンケートを新規作成してみましょう。', position: 'bottom', advanceOnClick: true },
            { page: '/02_dashboard/index.html', selector: '#surveyName', title: 'アンケート名の入力', description: '管理用のアンケート名（例: 初めてのアンケート）を自動入力します。', position: 'bottom', action: 'autoInput', text: '初めてのアンケート' },
            { page: '/02_dashboard/index.html', selector: '#displayTitle', title: '表示タイトルの入力', description: '回答者に表示されるタイトル（例: 製品Aに関する満足度調査）を自動入力します。', position: 'bottom', action: 'autoInput', text: '製品Aに関する満足度調査' },
            { page: '/02_dashboard/index.html', selector: '#newSurveyPeriodRange', title: '回答期間の設定', description: 'アンケートの回答期間を、本日から3日後まで自動で設定します。', position: 'top', action: 'autoDate' },
            { page: '/02_dashboard/index.html', selector: '#createSurveyFromModalBtn', title: '作成', description: '「作成する」ボタンを押して、アンケート作成画面に移動しましょう。', position: 'top', advanceOnClick: true },
            { page: '/02_dashboard/surveyCreation.html', selector: '#section-basic-info', title: '基本情報の確認', description: '先ほど入力したアンケート名や期間が反映されています。', position: 'bottom' },
            { page: '/02_dashboard/surveyCreation.html', selector: '#section-additional-settings', title: '追加設定', description: 'ここでは名刺データ設定、お礼メール、サンクス画面の設定ができます。今回は説明を省略します。', position: 'bottom' },
            { page: '/02_dashboard/surveyCreation.html', selector: '#addNewGroupBtn', title: '設問グループ作成', description: '「次へ」を押すと、関連する質問をまとめる「グループ」が自動で作成されます。', position: 'bottom', actionOnNext: 'autoClick' },
            { page: '/02_dashboard/surveyCreation.html', selector: '#fab-main-button', title: '設問の追加', description: '「次へ」を押すと、「+」ボタンが押され、設問メニューが展開されます。', position: 'left', actionOnNext: 'autoClick' },
            { page: '/02_dashboard/surveyCreation.html', selector: 'button[data-question-type="single_answer"]', title: '設問の追加 (1/3)', description: '「次へ」を押すと「シングル選択」の設問が追加され、内容が自動入力されます。', position: 'left', actionOnNext: 'addAndExplain', data: { questionType: 'single_answer', questionText: 'Q. 本製品の満足度を教えてください', options: ['非常に満足', '満足', '普通', '不満', '非常に不満'], explanation: 'シングル選択は、複数の選択肢から1つだけを選んでもらう設問です。' } },
            { page: '/02_dashboard/surveyCreation.html', selector: '#fab-main-button', title: '設問の追加 (2/3)', description: '「次へ」を押すと、続けて次の設問を追加するため、メニューが展開されます。', position: 'left', actionOnNext: 'autoClick' },
            { page: '/02_dashboard/surveyCreation.html', selector: 'button[data-question-type="multi_answer"]', title: '設問の追加 (2/3)', description: '「次へ」を押すと「マルチ選択」の設問が追加され、内容が自動入力されます。', position: 'left', actionOnNext: 'addAndExplain', data: { questionType: 'multi_answer', questionText: 'Q. 本製品でよく利用する機能を全て選択してください', options: ['機能A', '機能B', '機能C', '機能D', 'その他'], explanation: 'マルチ選択は、複数の選択肢から複数を選んでもらう設問です。' } },
            { page: '/02_dashboard/surveyCreation.html', selector: '#fab-main-button', title: '設問の追加 (3/3)', description: '「次へ」を押すと、最後に3つ目の設問を追加するため、メニューが展開されます。', position: 'left', actionOnNext: 'autoClick' },
            { page: '/02_dashboard/surveyCreation.html', selector: 'button[data-question-type="dropdown"]', title: '設問の追加 (3/3)', description: '「次へ」を押すと「ドロップダウン」の設問が追加され、内容が自動入力されます。', position: 'left', actionOnNext: 'addAndExplain', data: { questionType: 'dropdown', questionText: 'Q. 本製品をどこで知りましたか？', options: ['インターネット検索', 'SNS', '広告', '知人の紹介', 'その他'], explanation: 'ドロップダウンは、選択肢が多い場合にリストから選んでもらう設問です。' } },
            { page: '/02_dashboard/surveyCreation.html', selector: '#showPreviewBtn', title: 'プレビュー機能の確認', description: '「次へ」を押すと、作成したアンケートのプレビューが開きます。', position: 'top', actionOnNext: 'autoClick' },
            { page: '/02_dashboard/surveyCreation.html', selector: '#surveyPreviewModal', title: 'プレビューの確認', description: '作成したアンケートはこのように表示されます。内容を確認後、「次へ」ボタンを押してください。', position: 'top' },
            { page: '/02_dashboard/surveyCreation.html', selector: '#createSurveyBtn', title: 'トレーニング完了', description: '以上でアンケート作成は完了です。「アンケート保存」を押してチュートリアルを終了します。（実際には保存されません）', position: 'top', advanceOnClick: true }
        ];

        function waitForElement(selector, timeout = 5000, interval = 100) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const checkElement = () => {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) {
                        resolve(element);
                    } else if (Date.now() - startTime < timeout) {
                        setTimeout(checkElement, interval);
                    } else {
                        reject(new Error(`Element not found or not visible within timeout: ${selector}`));
                    }
                };
                checkElement();
            });
        }

        async function handleStepAction(step, element) {
            if (!step.actionOnNext) return;

            nextButton.disabled = true;
            
            if (step.actionOnNext === 'autoClick') {
                element.click();
                await new Promise(resolve => setTimeout(resolve, 800)); 
            } else if (step.actionOnNext === 'addAndExplain') {
                if (typeof window.handleAddNewQuestion !== 'function' || typeof window.getSurveyData !== 'function' || typeof window.updateAndRenderAll !== 'function') {
                    console.error('Tutorial Error: Required surveyCreation functions are not available.');
                    return;
                }
                const surveyData = window.getSurveyData();
                const lastGroup = surveyData.questionGroups[surveyData.questionGroups.length - 1];
                if (!lastGroup) {
                    console.error('Tutorial Error: No question group found.');
                    return;
                }
                
                const stepData = step.data || {};
                window.handleAddNewQuestion(lastGroup.groupId, stepData.questionType);
                const newQuestion = lastGroup.questions[lastGroup.questions.length - 1];
                
                if (newQuestion) {
                    newQuestion.text = { ja: stepData.questionText };
                    if (stepData.options && Array.isArray(stepData.options)) {
                        newQuestion.options = stepData.options.map(optText => ({ text: { ja: optText } }));
                    }
                }
                
                window.updateAndRenderAll();
                
                await new Promise(resolve => setTimeout(resolve, 500)); 
                
                const newQuestionElement = await waitForElement(`.question-item[data-question-id="${newQuestion.questionId}"]`);
                
                // This becomes the next step's target
                steps[currentStepIndex] = {
                    page: step.page,
                    selector: `.question-item[data-question-id="${newQuestion.questionId}"]`,
                    title: `設問の確認 (${step.title.split('(')[1]} `,
                    description: stepData.explanation,
                    position: 'top'
                };
            }
            nextButton.disabled = false;
        }


        function createTutorialUI() {
            if (document.getElementById('custom-tutorial-svg-overlay')) return;
            
            svgOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgOverlay.id = 'custom-tutorial-svg-overlay';
            // ... (rest of SVG creation is fine)
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
            mask.id = 'tutorial-mask';
            const maskBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            maskBg.setAttribute('x', '0');
            maskBg.setAttribute('y', '0');
            maskBg.setAttribute('width', '100%');
            maskBg.setAttribute('height', '100%');
            maskBg.setAttribute('fill', 'white');
            maskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            maskRect.setAttribute('fill', 'black');
            maskRect.setAttribute('rx', '8');
            maskRect.setAttribute('ry', '8');
            maskRect.style.transition = 'all 0.4s ease-in-out';
            mask.appendChild(maskBg);
            mask.appendChild(maskRect);
            defs.appendChild(mask);
            svgOverlay.appendChild(defs);
            const overlayRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            overlayRect.setAttribute('x', '0');
            overlayRect.setAttribute('y', '0');
            overlayRect.setAttribute('width', '100%');
            overlayRect.setAttribute('height', '100%');
            overlayRect.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
            overlayRect.setAttribute('mask', 'url(#tutorial-mask)');
            svgOverlay.appendChild(overlayRect);
            document.body.appendChild(svgOverlay);


            popover = document.createElement('div');
            popover.id = 'custom-tutorial-popover';
            popover.innerHTML = `
                <h3 id="custom-tutorial-title"></h3>
                <p id="custom-tutorial-description"></p>
                <div class="tutorial-footer">
                    <button id="custom-tutorial-close-btn">閉じる</button>
                    <button id="custom-tutorial-next-btn">次へ</button>
                </div>
            `;
            document.body.appendChild(popover);

            popoverTitle = document.getElementById('custom-tutorial-title');
            popoverDescription = document.getElementById('custom-tutorial-description');
            nextButton = document.getElementById('custom-tutorial-next-btn');
            closeButton = document.getElementById('custom-tutorial-close-btn');

            // This listener is now smarter
            nextButton.addEventListener('click', async () => {
                const lastStep = steps[currentStepIndex - 1];
                if (lastStep && lastStep.actionOnNext) {
                    await handleStepAction(lastStep, currentHighlightedElement);
                }
                showNextStep();
            });
            closeButton.addEventListener('click', () => destroyTutorial(false));
        }

        function destroyTutorial(completed = false) {
            if (window.isTutorialActive !== undefined) {
                window.isTutorialActive = false;
            }
            if (svgOverlay) svgOverlay.remove();
            if (popover) popover.remove();
            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('custom-tutorial-highlight');
            }
            localStorage.setItem('speedad-tutorial-status', completed ? 'completed' : 'skipped');
            localStorage.removeItem('speedad-tutorial-step');
            if(completed) {
                 alert('チュートリアルが完了しました。ダッシュボードに戻ります。');
                 window.location.href = '/02_dashboard/index.html';
            }
        }

        async function showNextStep() {
            if (isTransitioning) return;

            const step = steps[currentStepIndex];
            if (!step) {
                destroyTutorial(true);
                return;
            }

            if (!window.location.pathname.endsWith(step.page)) {
                currentStepIndex++;
                showNextStep();
                return;
            }
            
            try {
                // If the current step targets an element within the newSurveyModal,
                // wait until the modal is fully open.
                if (step.selector === '#surveyName' || step.selector === '#displayTitle' || step.selector === '#newSurveyPeriodRange' || step.selector === '#createSurveyFromModalBtn') {
                    await waitForElement('#newSurveyModal[data-state="open"]', 10000); // Wait up to 10 seconds for the modal to be open
                }
                const element = await waitForElement(step.selector);
                localStorage.setItem('speedad-tutorial-step', currentStepIndex);
                showStep(step, element);
                currentStepIndex++;
            } catch (error) {
                console.warn(`Tutorial element not found: ${step.selector}. Skipping to next step.`, error);
                currentStepIndex++;
                showNextStep();
            }
        }

        function showStep(step, element) {
            if (isTransitioning) return;
            isTransitioning = true;

            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('custom-tutorial-highlight');
            }
            currentHighlightedElement = element;
            element.classList.add('custom-tutorial-highlight');
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

            // --- Handle immediate actions ---
            if (step.action === 'autoInput') {
                element.value = step.text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                setTimeout(() => showNextStep(), 400);
                return; 
            } else if (step.action === 'autoDate') {
                const el = document.querySelector('#newSurveyPeriodRange');
                if (el) {
                    const formatDate = (date) => {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    };
                    const start = new Date();
                    start.setDate(start.getDate() + 1);
                    const end = new Date(start.getTime());
                    end.setDate(start.getDate() + 2);
                    el.value = `${formatDate(start)} から ${formatDate(end)}`;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                setTimeout(() => showNextStep(), 400);
                return;
            }

            // --- Position UI and Attach Handlers (with delay) ---
            setTimeout(() => {
                const rect = element.getBoundingClientRect();
                const padding = 4;
                maskRect.setAttribute('x', rect.left - padding);
                maskRect.setAttribute('y', rect.top - padding);
                maskRect.setAttribute('width', rect.width + (padding * 2));
                maskRect.setAttribute('height', rect.height + (padding * 2));

                popoverTitle.textContent = step.title;
                popoverDescription.innerHTML = step.description;
                popover.classList.add('visible');

                const popoverRect = popover.getBoundingClientRect();
                let top, left;
                const offset = 15;
                switch (step.position) {
                    case 'top': top = rect.top - popoverRect.height - offset; left = rect.left + (rect.width / 2) - (popoverRect.width / 2); break;
                    case 'left': top = rect.top + (rect.height / 2) - (popoverRect.height / 2); left = rect.left - popoverRect.width - offset; break;
                    case 'right': top = rect.top + (rect.height / 2) - (popoverRect.height / 2); left = rect.right + offset; break;
                    default: top = rect.bottom + offset; left = rect.left + (rect.width / 2) - (popoverRect.width / 2); break;
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

                popover.style.top = `${top}px`;
                popover.style.left = `${left}px`;
                popover.setAttribute('tabindex', '-1');
                popover.focus();

                if (step.advanceOnClick && step.selector !== '#openNewSurveyModalBtn') {
                    nextButton.style.display = 'none';
                    const handler = (event) => {
                        if (step.selector === '#createSurveyFromModalBtn') {
                            return; 
                        }
                        showNextStep();
                    };
                    element.addEventListener('click', handler, { once: true });
                } else {
                    nextButton.style.display = 'inline-block';
                }

            }, 600);

            isTransitioning = false;
        }

        setTimeout(() => {
            createTutorialUI();
            showNextStep();
        }, 500);
    };

    window.startAppTutorial = initTutorial;
    window.advanceTutorialStep = () => {
        showNextStep();
    };