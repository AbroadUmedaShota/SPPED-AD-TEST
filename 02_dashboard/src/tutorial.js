
/**
 * チュートリアルを開始するメイン関数
 * この関数はグローバルスコープに定義されます
 */
function startTutorial() {
    // グローバルスコープから driver と handleOpenModal を取得
    const driver = window.driver.js.driver;
    const handleOpenModal = window.handleOpenModal;

    if (!driver || !handleOpenModal) {
        console.error("Tutorial dependencies (driver.js or handleOpenModal) not found.");
        localStorage.setItem('speedad-tutorial-status', 'completed');
        return;
    }

    const tutorialState = {
        setStatus: (status) => localStorage.setItem('speedad-tutorial-status', status),
    };

    /**
     * 新規アンケート作成モーダル内のチュートリアルを開始します。
     */
    function startNewSurveyModalTutorial() {
        // モーダル内のコンポーネントが初期化されるのを少し待つ
        setTimeout(() => {
            const modalDriver = driver({
                showProgress: false, // 進捗表記を非表示に
                animate: true,
                showButtons: ['next', 'previous', 'close'],
                onDestroyed: () => {
                    tutorialState.setStatus('completed');
                    const modal = document.getElementById('newSurveyModal');
                    if(modal) modal.remove();
                },
                steps: [
                    {
                        element: '#surveyName',
                        popover: {
                            title: 'アンケート名',
                            description: '社内でアンケートを識別・管理するための名称です。管理しやすい名称をご入力ください。'
                        }
                    },
                    {
                        element: '#displayTitle',
                        popover: {
                            title: '表示タイトル',
                            description: 'こちらが、アンケート画面で回答者様に表示される正式なタイトルとなります。'
                        }
                    },
                    {
                        element: '#newSurveyPeriodRange',
                        popover: {
                            title: '回答期間',
                            description: 'アンケートを実施する期間をカレンダーより設定します。展示会の会期などをご指定ください。'
                        }
                    },
                    {
                        element: '#createSurveyFromModalBtn',
                        popover: {
                            title: '作成の実行',
                            description: '基本情報の入力は以上です。これでチュートリアルは完了です。 (このトレーニングでは実際の作成は行われません)'
                        }
                    }
                ]
            });
            modalDriver.drive();
        }, 200);
    }

    // メインのチュートリアル定義
    const mainDriver = driver({
        showProgress: false, // 進捗表記を非表示に
        animate: true,
        showButtons: ['next', 'close'],
        onDestroyed: () => {
            tutorialState.setStatus('completed');
        },
        steps: [
            {
                element: '#openNewSurveyModalBtn',
                popover: {
                    title: 'アンケートの新規作成',
                    description: '新しいアンケートを作成するには、こちらのボタンをクリックします。'
                },
                onNextClick: (element, step, { moving, destroy }) => {
                    moving.prevent(); // 自動で次のステップに進むのを防ぐ
                    
                    // モーダルを開き、そのコールバックでモーダル用チュートリアルを開始
                    handleOpenModal('newSurveyModal', 'modals/newSurveyModal.html', () => {
                        // メインのチュートリアルは役目を終えたので破棄
                        destroy();
                        // モーダル用のチュートリアルを開始
                        startNewSurveyModalTutorial();
                    });
                }
            }
        ]
    });

    mainDriver.drive();
}
