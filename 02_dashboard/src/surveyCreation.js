import { handleOpenModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { fetchSurveyData, collectSurveyDataFromDOM, saveSurveyDataToLocalStorage, loadSurveyDataFromLocalStorage } from './services/surveyService.js';
import { 
    populateBasicInfo, 
    renderAllQuestionGroups, 
    displayErrorMessage, 
    addNewQuestionGroup, 
    addNewQuestion, 
    deleteQuestionGroup, 
    deleteQuestion, 
    duplicateQuestionGroup, 
    duplicateQuestion, 
    addOptionToQuestion, 
    renderOutlineMap 
} from './ui/surveyRenderer.js';
import { initializeFab } from './ui/fab.js';
import { loadCommonHtml } from './utils.js';



// ダミーユーザーデータ (本来はAPIから取得)
window.dummyUserData = {
    email: "user@example.com",
    companyName: "株式会社SpeedAd",
    departmentName: "開発部",
    positionName: "エンジニア",
    lastName: "田中",
    firstName: "太郎",
    phoneNumber: "09012345678",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    buildingFloor: "皇居ビルディング 1F",
    billingAddressType: "same",
    billingCompanyName: "",
    billingDepartmentName: "",
    billingLastName: "",
    billingFirstName: "",
    billingPhoneNumber: "",
    billingPostalCode: "",
    billingAddress: "",
    billingBuildingFloor: "",
};

/**
 * ページの初期化処理
 */
async function initializePage() {
    try {
        await Promise.all([
            loadCommonHtml('main-header', 'common/header.html'),
            loadCommonHtml('sidebar', 'common/sidebar.html'),
            loadCommonHtml('main-footer', 'common/footer.html', () => {
                document.getElementById('openContactModalBtn').addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));
            })
        ]);

        let surveyData = loadSurveyDataFromLocalStorage();
        if (surveyData) {
            console.log('Loaded survey data from localStorage:', surveyData);
            populateBasicInfo(surveyData);
            renderAllQuestionGroups(surveyData.questionGroups);
        } else {
            console.log('No survey data in localStorage. Fetching initial data...');
            surveyData = await fetchSurveyData();
            populateBasicInfo(surveyData);
            renderAllQuestionGroups(surveyData.questionGroups);
        }
        restoreAccordionState(); // アコーディオンの状態を復元
        renderOutlineMap(); // 初期ロード時にアウトラインマップを生成

        // FABの初期化
        initializeFab('fab-container', 'components/fab.html');

    } catch (error) {
        console.error('Failed to initialize page:', error);
        displayErrorMessage();
    }
}

/**
 * アコーディオンの開閉状態をlocalStorageに保存する
 * @param {string} id - アコーディオンコンテンツのID
 * @param {boolean} isOpen - 開いているかどうか
 */
function saveAccordionState(id, isOpen) {
    localStorage.setItem(`accordionState_${id}`, isOpen);
}

/**
 * localStorageからアコーディオンの開閉状態を復元する
 */
function restoreAccordionState() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const contentId = header.dataset.accordionTarget;
        const content = document.getElementById(contentId);
        const icon = header.querySelector('.expand-icon');
        if (content && localStorage.getItem(`accordionState_${contentId}`) === 'false') {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        } else if (content) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        }
    });
}

/**
 * アコーディオンの初期化処理
 */
function initializeAccordion() {
    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header');
        if (!header) return;

        const contentId = header.dataset.accordionTarget;
        const content = document.getElementById(contentId);
        const icon = header.querySelector('.expand-icon');

        if (content) {
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            icon.textContent = isOpen ? 'expand_more' : 'expand_less';
            saveAccordionState(contentId, !isOpen);
        }
    });
}

/**
 * イベントリスナーを登録する
 */
function setupEventListeners() {
    initializeAccordion();

    initializeDatepickers();

    // モーダルを開くボタンのイベントリスナー
    document.getElementById('openAccountInfoBtnHeader').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openAccountInfoBtnSidebar').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openContactModalBtn').addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));
    document.getElementById('openBizcardSettingsBtn').addEventListener('click', () => handleOpenModal('bizcardSettingsModal', 'bizcardSettings.html'));
    document.getElementById('openThankYouEmailSettingsBtn').addEventListener('click', () => handleOpenModal('thankYouEmailSettingsModal', 'thankYouEmailSettings.html'));

    // 「質問グループを追加」ボタンのイベントリスナー (フローティングメニュー内)
    

    

    // 各質問タイプボタンのイベントリスナー
    document.getElementById('addFreeAnswerBtn').addEventListener('click', () => {
        addNewQuestion('free_answer');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addSingleAnswerBtn').addEventListener('click', () => {
        addNewQuestion('single_answer');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addMultiAnswerBtn').addEventListener('click', () => {
        addNewQuestion('multi_answer');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addNumberAnswerBtn').addEventListener('click', () => {
        addNewQuestion('number_answer');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addMatrixSABtn').addEventListener('click', () => {
        addNewQuestion('matrix_sa');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addMatrixMABtn').addEventListener('click', () => {
        addNewQuestion('matrix_ma');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addDateTimeBtn').addEventListener('click', () => {
        addNewQuestion('date_time');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
    document.getElementById('addHandwritingBtn').addEventListener('click', () => {
        addNewQuestion('handwriting');
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });

    // 削除ボタンのイベントリスナー (イベントデリゲーション)
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        // 質問グループの削除ボタン
        const deleteGroupBtn = target.closest('.group-header .icon-button .material-icons');
        if (deleteGroupBtn && deleteGroupBtn.textContent === 'delete') {
            const groupElement = deleteGroupBtn.closest('.question-group');
            if (groupElement) {
                deleteQuestionGroup(groupElement);
            }
        }

        // 質問項目の削除ボタン
        const deleteQuestionBtn = target.closest('.question-item .icon-button .material-icons');
        if (deleteQuestionBtn && deleteQuestionBtn.textContent === 'delete') {
            const questionElement = deleteQuestionBtn.closest('.question-item');
            if (questionElement) {
                deleteQuestion(questionElement);
            }
        }

        // 質問グループの複製ボタン
        const duplicateGroupBtn = target.closest('.group-header .icon-button .material-icons');
        if (duplicateGroupBtn && duplicateGroupBtn.textContent === 'content_copy') {
            const groupElement = duplicateGroupBtn.closest('.question-group');
            if (groupElement) {
                duplicateQuestionGroup(groupElement);
            }
        }

        // 質問項目の複製ボタン
        const duplicateQuestionBtn = target.closest('.question-item .icon-button .material-icons');
        if (duplicateQuestionBtn && duplicateQuestionBtn.textContent === 'content_copy') {
            const questionElement = duplicateQuestionBtn.closest('.question-item');
            if (questionElement) {
                duplicateQuestion(questionElement);
            }
        }

        // 選択肢追加ボタン
        const addOptionBtn = target.closest('.options-container .text-sm.text-primary');
        if (addOptionBtn && addOptionBtn.textContent.includes('+ 選択肢を追加')) {
            const questionElement = addOptionBtn.closest('.question-item');
            if (questionElement) {
                addOptionToQuestion(questionElement);
            }
        }
    });

    // アンケートを保存ボタンのイベントリスナー
    const createSurveyBtn = document.getElementById('createSurveyBtn');
    if (createSurveyBtn) {
        createSurveyBtn.addEventListener('click', () => {
            const surveyData = collectSurveyDataFromDOM();
            saveSurveyDataToLocalStorage(surveyData); // localStorageに保存
            console.log('Collected Survey Data and saved to localStorage:', surveyData);
            alert('アンケートデータがlocalStorageに保存されました！');
        });
    }

    initializeDraggable();

    
}



/**
 * フォームの必須項目を検証し、保存ボタンの有効/無効を切り替える。
 */
function validateFormForSaveButton() {
    const saveButton = document.getElementById('createSurveyBtn');
    const requiredFields = [
        document.getElementById('surveyName'),
        document.getElementById('displayTitle'),
        document.getElementById('periodStart'),
        document.getElementById('periodEnd'),
    ];

    function checkValidation() {
        let allValid = true;
        requiredFields.forEach(field => {
            const errorMessage = field.closest('.input-group').querySelector('.error-message');
            if (field.value.trim() === '') {
                field.classList.add('is-invalid');
                if (errorMessage) errorMessage.classList.remove('hidden');
                allValid = false;
            } else {
                field.classList.remove('is-invalid');
                if (errorMessage) errorMessage.classList.add('hidden');
            }
        });
        saveButton.disabled = !allValid;
    }

    requiredFields.forEach(field => {
        field.addEventListener('input', checkValidation);
    });

    // 日付ピッカーの変更も監視する
    const observer = new MutationObserver(checkValidation);
    requiredFields.forEach(field => {
        if (field.id.includes('period')) {
            observer.observe(field, { attributes: true, attributeFilter: ['value'] });
        }
    });

    checkValidation(); // 初期チェック
}

/**
 * スクロールに合わせてアウトラインマップのアクティブ状態を更新する。
 */
function setupScrollSpy() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // --- スクロールスパイ機能 ---
    const outlineLinks = document.querySelectorAll('#outline-map-container a');
    const sections = Array.from(outlineLinks).map(link => {
        const id = link.getAttribute('href').substring(1);
        return document.getElementById(id);
    }).filter(section => section !== null);

    if (outlineLinks.length > 0 && sections.length > 0) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const correspondingLink = document.querySelector(`#outline-map-container a[href="#${id}"]`);
                if (entry.isIntersecting) {
                    outlineLinks.forEach(link => link.classList.remove('active'));
                    if (correspondingLink) {
                        correspondingLink.classList.add('active');
                    }
                }
            });
        }, { root: mainContent, threshold: 0.5 });

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    
}

    // DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得をDOMContentLoadedイベント内で行う
    let openQuestionTypeSelectorBtn = document.getElementById('openQuestionTypeSelectorBtn');
    let questionTypeSelector = document.getElementById('questionTypeSelector');
    let addQuestionGroupBtn = document.getElementById('addQuestionGroupBtn');

    console.log('DOMContentLoaded: openQuestionTypeSelectorBtn', openQuestionTypeSelectorBtn);
    console.log('DOMContentLoaded: questionTypeSelector', questionTypeSelector);
    console.log('DOMContentLoaded: addQuestionGroupBtn', addQuestionGroupBtn);

    initializePage();
    setupEventListeners();
    setupScrollSpy();

    // ウィンドウのリサイズ時にフローティングボタンの位置を更新
    window.addEventListener('resize', () => {
        if (questionTypeSelector) {
            questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    }, true);
});