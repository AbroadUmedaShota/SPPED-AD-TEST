
/**
 * チュートリアルの driver.js インスタンスを保持するための変数
 */
let mainTutorialDriver = null;

/**
 * チュートリアルを開始するメイン関数
 */
function startTutorial() {
    const driverFactory = window.driver && window.driver.js && window.driver.js.driver;
    const handleOpenModal = window.handleOpenModal;

    const openModalWithSetup = (typeof window.openNewSurveyModalWithSetup === 'function')
        ? window.openNewSurveyModalWithSetup
        : (afterOpen) => {
            if (typeof handleOpenModal !== 'function') {
                return;
            }
            handleOpenModal('newSurveyModal', 'modals/newSurveyModal.html', () => {
                if (typeof afterOpen === 'function') {
                    afterOpen({ periodRangePicker: null, createSurveyBtn: null });
                }
            });
        };

    if (typeof driverFactory !== 'function' || typeof openModalWithSetup !== 'function') {
        console.error('Tutorial dependencies not found.');
        return;
    }

    const tutorialState = {
        setStatus: (status) => localStorage.setItem('speedad-tutorial-status', status),
        getStatus: () => localStorage.getItem('speedad-tutorial-status'),
    };

    tutorialState.setStatus('main-running');

    const proceedToNextTutorial = () => {
        tutorialState.setStatus('modal-running');
        if (mainTutorialDriver) {
            mainTutorialDriver.destroy();
        }
        openModalWithSetup(() => {
            startNewSurveyModalTutorial();
        });
    };

    mainTutorialDriver = driverFactory({
        showProgress: false,
        animate: true,
        allowClose: false,
        showButtons: ['close'],
        nextBtnText: '次へ',
        prevBtnText: '戻る',
        doneBtnText: '完了',
        closeBtnText: '閉じる',
        onDestroyed: () => {
            const status = tutorialState.getStatus();
            if (status === 'main-running') {
                tutorialState.setStatus('pending');
            }
            mainTutorialDriver = null;
        },
        steps: [
            {
                element: '#openNewSurveyModalBtn',
                popover: {
                    title: 'アンケートの新規作成',
                    description: '新しいアンケートを作成するには、こちらのボタンをクリックします。'
                },
                onHighlightStarted: (element) => {
                    element.addEventListener('click', () => {
                        proceedToNextTutorial();
                    }, { once: true });
                }
            }
        ]
    });

    mainTutorialDriver.drive();
}


/**
 * 新規アンケート作成モーダル内のチュートリアル
 */
function startNewSurveyModalTutorial() {
    const driver = window.driver.js.driver;
    const tutorialState = {
        setStatus: (status) => localStorage.setItem('speedad-tutorial-status', status),
        getStatus: () => localStorage.getItem('speedad-tutorial-status'),
    };

    setTimeout(() => {
        let modalDriver;

        const surveyModalSteps = [
            { // Step 0: アンケート名
                element: '#surveyName',
                popover: {
                    title: 'アンケート名',
                    description: '社内でアンケートを識別・管理するための名称です。管理しやすい名称をご入力ください。'
                },
                showButtons: ['next', 'close'],
            },
            { // Step 1: 表示タイトル
                element: '#displayTitle',
                popover: {
                    title: '表示タイトル',
                    description: 'こちらが、アンケート画面で回答者様に表示される正式なタイトルとなります。'
                },
                showButtons: ['next', 'previous', 'close'],
            },
            { // Step 2: 回答期間の設定
                element: '#newSurveyPeriodRange',
                popover: {
                    title: '回答期間の設定',
                    description: '回答期間はこのように設定します。例として、本日から3日間の期間をカレンダー上で確認してみましょう。',
                    side: 'top',
                    align: 'start'
                },
                showButtons: ['next', 'previous', 'close'],
                onHighlightStarted: (element) => {
                    const flatpickrInstance = element._flatpickr;
                    if (!flatpickrInstance) return;

                    const today = new Date();
                    const threeDaysLater = new Date();
                    threeDaysLater.setDate(today.getDate() + 3);
                    flatpickrInstance.setDate([today, threeDaysLater], true);

                    setTimeout(() => {
                        flatpickrInstance.open();

                        const nextBtn = document.querySelector('.driver-popover-next-btn');
                        if (nextBtn) {
                            const newNextBtn = nextBtn.cloneNode(true);
                            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

                            newNextBtn.addEventListener('click', () => {
                                const currentFlatpickr = document.getElementById('newSurveyPeriodRange')._flatpickr;
                                if (currentFlatpickr) {
                                    currentFlatpickr.close();
                                }
                                setTimeout(() => {
                                    modalDriver.moveNext();
                                }, 50);
                            });
                        }
                    }, 100);
                },
            },
                {
                    element: '#createSurveyFromModalBtn',
                    popover: {
                        title: '設問設定へ',
                        description: 'それでは「作成の実行」ボタンをクリックし、設問設定へお進みください。'
                    },
                    showButtons: [], // ボタン非表示
                    onHighlightStarted: (element) => {
                        const periodInput = document.getElementById('newSurveyPeriodRange');
                        if (periodInput && periodInput._flatpickr) {
                            periodInput._flatpickr.close();
                        }
                        const surveyNameInput = document.getElementById('surveyName');
                        const displayTitleInput = document.getElementById('displayTitle');
                        if (surveyNameInput && !surveyNameInput.value.trim()) {
                            surveyNameInput.value = 'チュートリアル・アンケート';
                            surveyNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        if (displayTitleInput && !displayTitleInput.value.trim()) {
                            displayTitleInput.value = 'チュートリアル・表示タイトル';
                            displayTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        element.addEventListener('click', () => {
                            tutorialState.setStatus('survey-creation-started');
                        }, { once: true });
                    }
                }
        ];

        modalDriver = driver({
            showProgress: false,
            animate: true,
            allowClose: false,
            nextBtnText: '次へ',
            prevBtnText: '戻る',
            doneBtnText: '完了',
            closeBtnText: '閉じる',
            onDestroyed: () => {
                const status = tutorialState.getStatus();
                if (status === 'modal-running') {
                    tutorialState.setStatus('pending');
                }
                const periodInput = document.getElementById('newSurveyPeriodRange');
                if (periodInput && periodInput._flatpickr) {
                    periodInput._flatpickr.close();
                }
            },
            steps: surveyModalSteps
        });

        modalDriver.drive();
    }, 200);
}
