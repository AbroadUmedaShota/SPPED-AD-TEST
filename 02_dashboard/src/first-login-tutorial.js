(function() {
    // --- グローバル変数 ---
    let currentStepIndex = 0;
    let currentPageSteps = [];
    let highlighter = null;
    let overlay = null;
    let disabledButtons = []; // Keep track of disabled buttons

    // --- チュートリアル定義 ---
    const tutorialSteps = {
        'survey-list': [
            {
                element: '#openNewSurveyModalBtn',
                title: 'アンケート作成の開始',
                content: 'SPEED ADへようこそ！まずは、新しいアンケートを作成する流れを体験してみましょう。このボタンをクリックしてください。',
                placement: 'bottom',
                on: 'click',
            },
            {
                element: '#newSurveyModal',
                title: 'アンケート情報の入力',
                content: 'ここでアンケートの基本的な情報を設定します。',
                placement: 'center',
                highlight: false,
            },
            {
                element: '#newSurveyModal #surveyName',
                title: 'アンケート名（管理用）',
                content: 'これは社内で管理するための名前です。回答者には表示されません。今回は練習のため、<b>こちらで「初めてのアンケート」と自動入力します。</b>',
                placement: 'bottom',
                needsFocus: true,
                action: (el) => {
                    el.value = '初めてのアンケート';
                    el.dispatchEvent(new Event('input'));
                }
            },
            {
                element: '#newSurveyModal #displayTitle',
                title: 'アンケートタイトル',
                content: 'こちらが回答者に表示されるタイトルです。今回は練習のため、<b>こちらで「製品Aに関する満足度調査」と自動入力します。</b>',
                placement: 'bottom',
                needsFocus: true,
                action: (el) => {
                    el.value = '製品Aに関する満足度調査';
                    el.dispatchEvent(new Event('input'));
                }
            },
            {
                element: '#newSurveyModal #newSurveyPeriodRange',
                title: '回答期間',
                content: 'アンケートの回答を受け付ける期間です。今回は練習のため、<b>こちらで翌日を開始日、その3日後を終了日として自動で設定します。</b>',
                placement: 'top',
                needsFocus: true,
                action: (el) => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const end = new Date(tomorrow);
                    end.setDate(end.getDate() + 3);
                    const formatDate = (date) => date.toISOString().split('T')[0];
                    el.value = `${formatDate(tomorrow)} to ${formatDate(end)}`;
                    el.dispatchEvent(new Event('input'));
                }
            },
            {
                element: '#newSurveyModal #createSurveyFromModalBtn',
                title: 'アンケートを作成',
                content: 'これでアンケートのひな形が作成されます。クリックして、設問を作成する画面へ進みましょう。',
                placement: 'top',
                on: 'click',
                isNavigation: true,
            }
        ],
        'survey-creation': [
            {
                element: '#surveyName_ja',
                title: '基本情報の確認',
                content: 'ダッシュボードで入力した「アンケート名」がここに反映されます。',
                placement: 'bottom',
            },
            {
                element: '#displayTitle_ja',
                title: '基本情報の確認',
                content: '同様に「表示タイトル」も反映されています。',
                placement: 'bottom',
            },
            {
                element: '#periodRange',
                title: '基本情報の確認',
                content: '「アンケート期間」も設定されています。これらの基本情報はいつでも編集可能です。',
                placement: 'top',
            },
            {
                element: '#openBizcardSettingsBtn',
                title: '名刺データ設定',
                content: 'ここでは名刺の情報をどのようにデータ化するかなど、詳細な設定ができます。',
                placement: 'top',
            },
            {
                element: '#openThankYouEmailSettingsBtn',
                title: 'お礼メール設定',
                content: '回答者へ自動で送信されるお礼メールの内容を編集できます。',
                placement: 'top',
            },
            {
                element: '#openThankYouScreenSettingsBtn',
                title: 'サンクス画面設定',
                content: '回答完了後に表示されるサンクス画面をカスタマイズできます。',
                placement: 'top',
            },
            {
                element: '#addNewGroupBtn',
                title: '設問グループの追加',
                content: 'アンケートの設問は「グループ」という単位で管理します。まず、このボタンをクリックして最初のグループを追加しましょう。',
                placement: 'left',
                on: 'click',
            },
            {
                element: '#fab-main-button',
                title: '設問の追加 (1/3)',
                content: 'それでは、設問を追加していきましょう。右下の「＋」ボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
                action: async () => {
                    // FABメニューが表示されるのを少し待つ
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            },
            {
                element: 'button[data-question-type="single_answer"]',
                title: 'シングルアンサーの追加',
                content: '「シングルアンサー」（一つだけ選べる選択肢）を追加します。このボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
            },
            {
                element: '.question-item:last-of-type',
                title: 'シングルアンサー',
                content: 'これは、複数の選択肢から一つだけを選んでもらう形式の設問です。<br>練習のため、<b>こちらで設問のタイトルと選択肢を自動入力します。</b>',
                placement: 'top',
                action: async (el) => {
                    const titleInput = el.querySelector('.question-text-input');
                    if (titleInput) {
                        titleInput.value = 'Q1. 貴社の業種を教えてください。';
                        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    const optionInputs = el.querySelector('.options-container');
                    const options = ['製造業', 'IT・通信', 'サービス業', 'その他'];
                    const addOptionBtn = el.querySelector('.add-option-btn');

                    if (addOptionBtn) {
                        for (let i = optionInputs.children.length; i < options.length; i++) {
                            addOptionBtn.click();
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }
                    
                    const finalOptionInputs = el.querySelectorAll('.option-text-input');
                    finalOptionInputs.forEach((input, index) => {
                        if (options[index]) {
                            input.value = options[index];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                },
            },
            {
                element: '#fab-main-button',
                title: '設問の追加 (2/3)',
                content: '続けて、他の種類の設問も追加してみましょう。もう一度「＋」ボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
                action: async () => {
                    // FABメニューが表示されるのを少し待つ
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            },
            {
                element: 'button[data-question-type="multi_answer"]',
                title: 'マルチアンサーの追加',
                content: '「マルチアンサー」（複数選べる選択肢）を追加します。このボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
            },
            {
                element: '.question-item:last-of-type',
                title: 'マルチアンサー',
                content: 'これは、複数の選択肢から当てはまるものをすべて選んでもらう形式の設問です。<br>同様に、<b>タイトルと選択肢を自動入力します。</b>',
                placement: 'top',
                action: async (el) => {
                    const titleInput = el.querySelector('.question-text-input');
                    if (titleInput) {
                        titleInput.value = 'Q2. 興味のある製品カテゴリはどれですか？（複数回答可）';
                        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    const optionInputs = el.querySelector('.options-container');
                    const options = ['製品A', '製品B', '製品C', '製品D'];
                    const addOptionBtn = el.querySelector('.add-option-btn');

                    if (addOptionBtn) {
                        for (let i = optionInputs.children.length; i < options.length; i++) {
                            addOptionBtn.click();
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }
                    
                    const finalOptionInputs = el.querySelectorAll('.option-text-input');
                    finalOptionInputs.forEach((input, index) => {
                        if (options[index]) {
                            input.value = options[index];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                },
            },
            {
                element: '#fab-main-button',
                title: '設問の追加 (3/3)',
                content: '最後に、ドロップダウン形式の設問を追加します。「＋」ボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
                action: async () => {
                    // FABメニューが表示されるのを少し待つ
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            },
            {
                element: 'button[data-question-type="dropdown"]',
                title: 'ドロップダウンの追加',
                content: '「ドロップダウン」を追加します。このボタンをクリックしてください。',
                placement: 'left',
                on: 'click',
            },
            {
                element: '.question-item:last-of-type',
                title: 'ドロップダウン回答',
                content: 'これは、ドロップダウンリストから一つだけを選んでもらう形式の設問です。選択肢が多い場合に便利です。<br><b>タイトルと選択肢を自動入力します。</b>',
                placement: 'top',
                action: async (el) => {
                    const titleInput = el.querySelector('.question-text-input');
                    if (titleInput) {
                        titleInput.value = 'Q3. ご担当の役職をお聞かせください。';
                        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    const optionInputs = el.querySelector('.options-container');
                    const options = ['経営層・役員', '部長クラス', '課長・係長クラス', '一般社員'];
                    const addOptionBtn = el.querySelector('.add-option-btn');

                    if (addOptionBtn) {
                        for (let i = optionInputs.children.length; i < options.length; i++) {
                            addOptionBtn.click();
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }
                    
                    const finalOptionInputs = el.querySelectorAll('.option-text-input');
                    finalOptionInputs.forEach((input, index) => {
                        if (options[index]) {
                            input.value = options[index];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                },
            },
            {
                element: '#showPreviewBtn',
                title: 'プレビューの確認',
                content: '作成したアンケートが回答者にどう見えるか確認してみましょう。このボタンをクリックしてください。',
                placement: 'bottom',
                on: 'click',
            },
            {
                element: '#surveyPreviewModal .modal-content',
                title: 'プレビュー画面',
                content: 'プレビューを確認したら、「次へ」ボタンを押してアンケートの保存に進みましょう。',
                placement: 'top',
                on: 'manual',
            },
            {
                element: '#createSurveyBtn',
                title: 'アンケートを保存',
                content: '最後に、このボタンを押してアンケートを保存します。これでアンケート作成の一連の流れは完了です！',
                placement: 'top',
                on: 'click',
                preventsDefault: true,
            },
            {
                title: 'チュートリアル完了！',
                content: 'お疲れ様でした！これで基本的なアンケート作成の流れは完了です。他の機能もぜひ試してみてください。',
                isFinal: true,
            }
        ]
    };

    // --- DOM操作とメインロジック ---

    window.addEventListener('load', () => {
        const pageId = document.body.dataset.pageId;
        const startTutorial = localStorage.getItem('startFirstLoginTutorial');
        const tutorialState = JSON.parse(sessionStorage.getItem('firstLoginTutorialState'));

        if (startTutorial) {
            localStorage.removeItem('startFirstLoginTutorial');
            sessionStorage.setItem('firstLoginTutorialState', JSON.stringify({ page: pageId, step: 0 }));
            setTimeout(() => initializeTutorial(pageId, 0), 500);
        } else if (tutorialState && tutorialState.page === pageId) {
            setTimeout(() => initializeTutorial(pageId, tutorialState.step), 500);
        }
    });

    function initializeTutorial(pageId, stepIndex) {
        currentPageSteps = tutorialSteps[pageId] || [];
        currentStepIndex = stepIndex;

        if (currentPageSteps.length > 0 && currentStepIndex < currentPageSteps.length) {
            createOverlayElements();
            showStep(currentStepIndex);
        } else {
            cleanUp();
        }
    }

    function createOverlayElements() {
        if (!document.querySelector('.tutorial-overlay')) {
            overlay = document.createElement('div');
            overlay.className = 'tutorial-overlay';
            document.body.appendChild(overlay);
            
            // Allow clicks only on the highlighted element
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
            }, true);
        }
    }

    function updateOverlayClipPath(targetElement) {
        if (!overlay) createOverlayElements();

        if (!targetElement) {
            overlay.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
            overlay.style.pointerEvents = 'auto';
            return;
        }
        
        overlay.style.pointerEvents = 'auto';
        const rect = targetElement.getBoundingClientRect();
        const margin = 10;

        const top = rect.top - margin;
        const bottom = rect.bottom + margin;
        const left = rect.left - margin;
        const right = rect.right + margin;
        
        const w = window.innerWidth;
        const h = window.innerHeight;

        overlay.style.clipPath = `polygon(
            0 0, 0 ${h}px, ${w}px ${h}px, ${w}px 0, 0 0,
            ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px
        )`;
    }

    async function showStep(index) {
        console.log(`%c--- showStep START for index: ${index}, element: ${currentPageSteps[index]?.element} ---`, 'color: blue; font-weight: bold;');
        const step = currentPageSteps[index];
        if (!step) {
            cleanUp();
            return;
        }

        if (step.isFinal) {
            cleanUp(true); // Clean up tutorial elements but keep session state for now

            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'tutorial-complete-overlay';
            Object.assign(modalOverlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: '10005',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '0', transition: 'opacity 0.3s ease'
            });

            const modalContent = document.createElement('div');
            Object.assign(modalContent.style, {
                background: 'white', padding: '40px', borderRadius: '12px',
                textAlign: 'center', maxWidth: '450px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                transform: 'scale(0.95)', transition: 'transform 0.3s ease'
            });

            modalContent.innerHTML = `
                <h2 style="margin-top: 0; font-size: 1.75em; color: #333;">${step.title}</h2>
                <p style="font-size: 1.1em; color: #666; margin: 20px 0 30px;">${step.content}</p>
                <button id="tutorial-complete-btn" style="padding: 12px 30px; border: none; border-radius: 50px; background-color: #0d6efd; color: white; font-size: 1.1em; cursor: pointer; transition: background-color 0.2s;">ダッシュボードに戻る</button>
            `;

            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);

            // Animate modal in
            setTimeout(() => {
                modalOverlay.style.opacity = '1';
                modalContent.style.transform = 'scale(1)';
            }, 10);

            document.getElementById('tutorial-complete-btn').addEventListener('click', () => {
                // Call the globally exposed function to remove the listener
                if (typeof window.disableUnloadConfirmation === 'function') {
                    window.disableUnloadConfirmation();
                }
                
                sessionStorage.removeItem('firstLoginTutorialState');
                localStorage.removeItem('startFirstLoginTutorial');
                window.location.href = 'index.html';
            });
            return;
        }

        if (!step.element) {
            updateOverlayClipPath(null);
            if (step.action) await step.action();
            createTooltip(document.body, step);
            if (step.on !== 'manual') {
                const nextButton = document.getElementById('next-step');
                if (!nextButton) {
                    setTimeout(() => proceedToNextStep(step), 1000);
                }
            }
            return;
        }

        let targetElement = await waitForElement(step.element);
        if (!targetElement) {
            console.warn('Tutorial element not found on initial search:', step.element);
            cleanUp();
            return;
        }

        if (step.action) {
            await step.action(targetElement);
        }

        targetElement = await waitForElement(step.element);
        if (!targetElement) {
            console.error('TUTORIAL FATAL: Element lost after action and could not be found again:', step.element);
            cleanUp();
            return;
        }

        if (step.element === '#surveyPreviewModal .modal-content') {
            const closeButtons = document.querySelectorAll('#surveyPreviewModal [data-modal-close="surveyPreviewModal"]');
            closeButtons.forEach(btn => {
                btn.style.pointerEvents = 'none';
                disabledButtons.push(btn);
            });
        }

        if (!targetElement.closest('.modal-overlay')) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    
        createTooltip(targetElement, step);

        if (step.highlight !== false) {
            updateOverlayClipPath(targetElement);
        } else {
            updateOverlayClipPath(null);
        }

        if (step.needsFocus) {
            setTimeout(() => targetElement.focus(), 150);
        }

        if (step.on === 'click') {
            const clickHandler = (e) => {
                // Prevent default action for navigation or if explicitly requested
                if (step.isNavigation || step.preventsDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }

                // クリックされた要素からフォーカスを外す
                targetElement.blur();

                // For navigation, proceed immediately. For others, wait for the action to complete.
                if (step.isNavigation) {
                    proceedToNextStep(step);
                    return;
                }
                
                setTimeout(() => {
                    proceedToNextStep(step);
                }, 200);
            };
            targetElement.addEventListener('click', clickHandler, { once: true });
        }
        console.log(`%c--- showStep END for index: ${index} ---`, 'color: blue; font-weight: bold;');
    }

    function proceedToNextStep(currentStep) {
        console.log(`%c--- proceedToNextStep called from step ${currentStepIndex} ---`, 'color: green; font-weight: bold;');
        currentStepIndex++;
        cleanUp(true);
        if (currentStep.isNavigation) {
            sessionStorage.setItem('firstLoginTutorialState', JSON.stringify({ page: 'survey-creation', step: 0 }));
            const surveyName = document.querySelector('#newSurveyModal #surveyName').value.trim();
            const displayTitle = document.querySelector('#newSurveyModal #displayTitle').value.trim();
            const periodRangeValue = document.querySelector('#newSurveyModal #newSurveyPeriodRange').value;
            const dateValues = periodRangeValue.split(' to ');
            const params = new URLSearchParams();
            params.set('surveyName', surveyName || 'チュートリアルアンケート');
            params.set('displayTitle', displayTitle || 'チュートリアルタイトル');
            if (dateValues.length === 2) {
                params.set('periodStart', dateValues[0]);
                params.set('periodEnd', dateValues[1]);
            }
            params.set('isTutorial', 'true');
            window.location.href = `surveyCreation.html?${params.toString()}`;
        } else {
            sessionStorage.setItem('firstLoginTutorialState', JSON.stringify({ page: document.body.dataset.pageId, step: currentStepIndex }));
            showStep(currentStepIndex);
        }
    }

    function createTooltip(target, step) {
        removeTooltip();
        const tooltip = document.createElement('div');
        tooltip.className = 'tutorial-tooltip';
        const showNextButton = step.on === 'manual' || (step.on !== 'click' && !step.isFinal);
        
        console.log(`Creating tooltip for step ${currentStepIndex}. Show next button: ${showNextButton}`);

        tooltip.innerHTML = `<h3>${step.title}</h3><p>${step.content}</p><div class="tutorial-tooltip-nav"><span class="tutorial-step-counter">${currentStepIndex + 1} / ${currentPageSteps.length}</span><div>${showNextButton ? '<button class="tutorial-tooltip-button primary" id="next-step">次へ</button>' : ''}</div></div>`;
        tooltip.style.visibility = 'hidden';
        document.body.appendChild(tooltip);
        
        const tooltipRect = tooltip.getBoundingClientRect();
        let targetRect = target.getBoundingClientRect();
        let placement = step.placement;

        // Fallback for elements that might not have a valid rect
        if (targetRect.width === 0 || targetRect.height === 0) {
            placement = 'center';
            targetRect = {
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
                width: 0,
                height: 0,
                bottom: window.innerHeight / 2,
                right: window.innerWidth / 2,
            };
        }

        const margin = 12;
        let top, left;

        switch (placement) {
            case 'top':
                top = targetRect.top - tooltipRect.height - margin;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + margin;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left - tooltipRect.width - margin;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.right + margin;
                break;
            case 'center':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            default:
                top = targetRect.bottom + margin;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        }

        if (left < margin) left = margin;
        if ((left + tooltipRect.width) > window.innerWidth) left = window.innerWidth - tooltipRect.width - margin;
        if (top < margin) top = margin;
        if ((top + tooltipRect.height) > window.innerHeight) top = window.innerHeight - tooltipRect.height - margin;

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.visibility = 'visible';
        setTimeout(() => tooltip.classList.add('visible'), 50);

        const nextButton = document.getElementById('next-step');
        if (nextButton) {
            console.log('Adding "click" listener to "Next" button.');
            nextButton.addEventListener('click', () => {
                // Special handling for the preview modal step
                if (step.element === '#surveyPreviewModal .modal-content') {
                    const closeButton = document.querySelector('#surveyPreviewModal [data-modal-close="surveyPreviewModal"]');
                    if (closeButton) {
                        // Re-enable pointer events to click it, then proceed.
                        // The full re-enabling is handled in cleanUp.
                        closeButton.style.pointerEvents = 'auto';
                        closeButton.click();
                    }
                }
                proceedToNextStep(step);
            });
        }
    }

    function removeTooltip() {
        const tooltip = document.querySelector('.tutorial-tooltip');
        if (tooltip) tooltip.remove();
    }

    function cleanUp(isStepChange = false) {
        removeTooltip();

        // Re-enable any disabled buttons
        disabledButtons.forEach(btn => {
            btn.style.pointerEvents = '';
        });
        disabledButtons = []; // Clear the array
        
        if (overlay) {
            // Reset clip-path to cover the screen before hiding
            overlay.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
        }
        
        if (!isStepChange) {
            if (overlay) {
                overlay.remove();
                overlay = null;
            }
            const completeModal = document.getElementById('tutorial-complete-overlay');
            if (completeModal) {
                completeModal.remove();
            }
            sessionStorage.removeItem('firstLoginTutorialState');
        }
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise(resolve => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }, timeout);
        });
    }

    async function fillQuestion(questionType) {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const lastGroup = document.querySelector('.question-group:last-of-type');
        if (!lastGroup) return;
        const lastQuestion = lastGroup.querySelector('.question-item:last-of-type');
        if (!lastQuestion) return;

        let title = '', options = [];
        switch (questionType) {
            case 'single_answer':
                title = 'Q1. 貴社の業種を教えてください。';
                options = ['製造業', 'IT・通信', 'サービス業', 'その他'];
                break;
            case 'multi_answer':
                title = 'Q2. 興味のある製品カテゴリはどれですか？（複数回答可）';
                options = ['製品A', '製品B', '製品C', '製品D'];
                break;
            case 'dropdown':
                title = 'Q3. ご担当の役職をお聞かせください。';
                options = ['経営層・役員', '部長クラス', '課長・係長クラス', '一般社員'];
                break;
        }

        const titleInput = lastQuestion.querySelector('.question-text-input');
        if (titleInput) {
            titleInput.value = title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const addOptionBtn = lastQuestion.querySelector('.add-option-btn');
        if (addOptionBtn) {
            let currentOptionInputs = lastQuestion.querySelectorAll('.option-text-input');
            for (let i = currentOptionInputs.length; i < options.length; i++) {
                addOptionBtn.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            currentOptionInputs = lastQuestion.querySelectorAll('.option-text-input');
            currentOptionInputs.forEach((input, index) => {
                if (options[index]) {
                    input.value = options[index];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
    }
})();
