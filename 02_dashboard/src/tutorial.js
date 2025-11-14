//
// ============== tutorial.js ==============
// Rebuilt from scratch to fix logic flow and correctly use the application's architecture.
//

function startSpeedAdTutorial() {
    // --- Prevent multiple executions ---
    if (document.getElementById('custom-tutorial-overlay')) {
        return;
    }

    // --- State ---
    let currentStepIndex = 0;
    let isTransitioning = false;
    let currentHighlightedElement = null;

    // --- UI Elements ---
    let popover, popoverTitle, popoverDescription, nextButton, closeButton, overlayContainer;

    // --- Step Definitions ---
    const steps = [
        { selector: '#openNewSurveyModalBtn', title: 'ようこそ！', description: 'SPEED ADへようこそ！まず、アンケートを新規作成してみましょう。', position: 'bottom', advanceOnClick: true },
        { selector: '#surveyName', title: 'アンケート名の入力', description: '管理用のアンケート名（例: 初めてのアンケート）を自動入力します。', position: 'bottom', action: { type: 'autoInput', text: '初めてのアンケート' } },
        { selector: '#displayTitle', title: '表示タイトルの入力', description: '回答者に表示されるタイトル（例: 製品Aに関する満足度調査）を自動入力します。', position: 'bottom', action: { type: 'autoInput', text: '製品Aに関する満足度調査' } },
        { selector: '#newSurveyPeriodRange', title: '回答期間の設定', description: 'アンケートの回答期間を、本日から3日後まで自動で設定します。', position: 'top', action: { type: 'autoDate' } },
        { selector: '#createSurveyFromModalBtn', title: '作成', description: '「作成する」ボタンを押して、アンケート作成画面に移動しましょう。', position: 'top', advanceOnClick: true },
    ];

    // --- Core Functions ---

    function createTutorialUI() {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'tutorial-svg-overlay'; // CRITICAL ID for main.js interop
        Object.assign(overlayContainer.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '9998', pointerEvents: 'none'
        });

        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const div = document.createElement('div');
            div.id = `custom-tutorial-overlay-${side}`;
            div.style.position = 'absolute';
            div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            overlayContainer.appendChild(div);
        });
        document.body.appendChild(overlayContainer);

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

        nextButton.addEventListener('click', () => showStep(++currentStepIndex));
        closeButton.addEventListener('click', destroyTutorial);
    }

    function destroyTutorial() {
        overlayContainer?.remove();
        popover?.remove();
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.remove('tutorial-highlight-active');
        }
        const modal = document.getElementById('newSurveyModal');
        if (modal) modal.remove();
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            let intervalId;
            let timeoutId;
            const find = () => {
                const element = document.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    clearInterval(intervalId);
                    resolve(element);
                }
            };
            intervalId = setInterval(find, 100);
            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                console.error(`Tutorial Error: Element not found: ${selector}`);
                reject(new Error(`Element not found: ${selector}`));
                destroyTutorial();
            }, timeout);
        });
    }

    async function showStep(index) {
        if (isTransitioning || index >= steps.length) {
            destroyTutorial();
            return;
        }
        isTransitioning = true;

        const step = steps[index];

        try {
            if (step.action) {
                popover.classList.remove('visible');
                const { type, text } = step.action;
                const input = await waitForElement(step.selector);
                if (type === 'autoInput') {
                    input.value = text;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (type === 'autoDate') {
                    const el = input._flatpickr ? input : await waitForElement('#newSurveyPeriodRange');
                    const start = new Date();
                    const end = new Date();
                    end.setDate(start.getDate() + 3);
                    if (el._flatpickr) {
                        el._flatpickr.setDate([start, end], true);
                    } else {
                        const formatDate = d => d.toISOString().split('T')[0];
                        el.value = `${formatDate(start)} から ${formatDate(end)}`;
                    }
                }
                currentStepIndex++;
                await showStep(currentStepIndex);
                return;
            }

            const element = await waitForElement(step.selector);
            const rect = element.getBoundingClientRect();

            const padding = 4;
            document.getElementById('custom-tutorial-overlay-top').style.height = `${rect.top - padding}px`;
            document.getElementById('custom-tutorial-overlay-bottom').style.top = `${rect.bottom + padding}px`;
            document.getElementById('custom-tutorial-overlay-left').style.cssText += `top: ${rect.top - padding}px; height: ${rect.height + padding * 2}px; width: ${rect.left - padding}px;`;
            document.getElementById('custom-tutorial-overlay-right').style.cssText += `top: ${rect.top - padding}px; height: ${rect.height + padding * 2}px; left: ${rect.right + padding}px;`;

            if (currentHighlightedElement) {
                currentHighlightedElement.classList.remove('tutorial-highlight-active');
            }
            currentHighlightedElement = element;
            element.classList.add('tutorial-highlight-active');

            popoverTitle.textContent = step.title;
            popoverDescription.textContent = step.description;
            popover.classList.add('visible');
            
            const popoverRect = popover.getBoundingClientRect();
            const offset = 15;
            let top, left;
            switch (step.position) {
                case 'top': top = rect.top - popoverRect.height - offset; left = rect.left + rect.width / 2 - popoverRect.width / 2; break;
                case 'left': top = rect.top + rect.height / 2 - popoverRect.height / 2; left = rect.left - popoverRect.width - offset; break;
                default: top = rect.bottom + offset; left = rect.left + rect.width / 2 - popoverRect.width / 2; break;
            }
            popover.style.top = `${Math.max(10, top)}px`;
            popover.style.left = `${Math.max(10, left)}px`;

            if (step.advanceOnClick) {
                nextButton.style.display = 'none';
                const advanceHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    element.classList.remove('tutorial-highlight-active');

                    if (step.selector === '#openNewSurveyModalBtn') {
                        if (typeof window.openNewSurveyModalWithSetup === 'function') {
                            window.openNewSurveyModalWithSetup(() => {
                                currentStepIndex++;
                                showStep(currentStepIndex);
                            });
                        } else {
                            console.error('Modal function not found');
                            destroyTutorial();
                        }
                    } else if (step.selector === '#createSurveyFromModalBtn') {
                        const surveyName = document.getElementById('surveyName').value;
                        const displayTitle = document.getElementById('displayTitle').value;
                        const period = document.getElementById('newSurveyPeriodRange').value.split(' から ');
                        const params = new URLSearchParams({ surveyName, displayTitle, periodStart: period[0], periodEnd: period[1] });
                        window.location.href = `surveyCreation.html?${params.toString()}`;
                    } else {
                        currentStepIndex++;
                        showStep(currentStepIndex);
                    }
                };
                element.addEventListener('click', advanceHandler, { once: true });
            } else {
                nextButton.style.display = 'block';
            }

        } catch (error) {
            console.error(error);
        } finally {
            isTransitioning = false;
        }
    }

    // --- Start ---
    createTutorialUI();
    showStep(currentStepIndex);
}

// Make the main function globally accessible
window.startSpeedAdTutorial = startSpeedAdTutorial;
