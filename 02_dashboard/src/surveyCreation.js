import { handleOpenModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { fetchSurveyData, collectSurveyDataFromDOM } from './services/surveyService.js';
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
        const surveyData = await fetchSurveyData();
        populateBasicInfo(surveyData);
        renderAllQuestionGroups(surveyData.questionGroups);
        renderOutlineMap(); // 初期ロード時にアウトラインマップを生成
    } catch (error) {
        console.error('Failed to initialize page:', error);
        displayErrorMessage();
    }
}

/**
 * イベントリスナーを登録する
 */
function setupEventListeners() {
    // アコーディオンの開閉処理
    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header, .group-header');
        if (header) {
            const contentId = header.dataset.accordionTarget;
            const content = document.getElementById(contentId);
            const icon = header.querySelector('.expand-icon');
            if (content) {
                const isVisible = getComputedStyle(content).display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                icon.textContent = isVisible ? 'expand_more' : 'expand_less';
            }
        }
    });

    // flatpickrの初期化
    flatpickr.localize(flatpickr.l10ns.ja);

    const endDatePicker = flatpickr("#periodEndWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    flatpickr("#periodStartWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr) {
            endDatePicker.set('minDate', dateStr);
        }
    });

    flatpickr("#deadlineWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    // モーダルを開くボタンのイベントリスナー
    document.getElementById('openAccountInfoBtnHeader').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openAccountInfoBtnSidebar').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openContactModalBtn').addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));

    // 「質問グループを追加」ボタンのイベントリスナー (フローティングメニュー内)
    const addQuestionGroupBtn = document.getElementById('addQuestionGroupBtn');
    if (addQuestionGroupBtn) {
        addQuestionGroupBtn.addEventListener('click', () => {
            addNewQuestionGroup();
            questionTypeSelector.classList.add('hidden'); // メニューを閉じる
        });
    }

    // 質問タイプ選択ボタンの表示/非表示
    const openQuestionTypeSelectorBtn = document.getElementById('openQuestionTypeSelectorBtn');
    const questionTypeSelector = document.getElementById('questionTypeSelector');

    if (openQuestionTypeSelectorBtn && questionTypeSelector) {
        openQuestionTypeSelectorBtn.addEventListener('click', () => {
            questionTypeSelector.classList.toggle('hidden');
        });

        // 質問タイプ選択メニュー外をクリックで閉じる
        document.addEventListener('click', (event) => {
            if (!questionTypeSelector.contains(event.target) && !openQuestionTypeSelectorBtn.contains(event.target)) {
                questionTypeSelector.classList.add('hidden');
            }
        });
    }

    // 各質問タイプボタンのイベントリスナー
    document.getElementById('addFreeAnswerBtn').addEventListener('click', () => {
        addNewQuestion('free_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addSingleAnswerBtn').addEventListener('click', () => {
        addNewQuestion('single_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMultiAnswerBtn').addEventListener('click', () => {
        addNewQuestion('multi_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addNumberAnswerBtn').addEventListener('click', () => {
        addNewQuestion('number_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMatrixSABtn').addEventListener('click', () => {
        addNewQuestion('matrix_sa');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMatrixMABtn').addEventListener('click', () => {
        addNewQuestion('matrix_ma');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addDateTimeBtn').addEventListener('click', () => {
        addNewQuestion('date_time');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addHandwritingBtn').addEventListener('click', () => {
        addNewQuestion('handwriting');
        questionTypeSelector.classList.add('hidden');
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

    // Sortable.jsの初期化
    const questionGroupsContainer = document.getElementById('questionGroupsContainer');

    // 質問グループの並べ替え
    new Sortable(questionGroupsContainer, {
        animation: 150,
        handle: '.group-header .handle', // ドラッグハンドル
        ghostClass: 'blue-background-class', // ドラッグ中のスタイル
        onEnd: function (evt) {
            // 並べ替え後の処理（必要であれば）
            console.log('Group moved:', evt.oldIndex, evt.newIndex);
        },
    });

    // 各質問グループ内の質問項目の並べ替え
    // MutationObserverを使って、動的に追加される質問グループにもSortableを適用
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('question-group')) {
                        const questionsList = node.querySelector('.questions-list');
                        if (questionsList) {
                            new Sortable(questionsList, {
                                animation: 150,
                                handle: '.question-item .handle', // ドラッグハンドル
                                ghostClass: 'blue-background-class', // ドラッグ中のスタイル
                                onEnd: function (evt) {
                                    // 並べ替え後の処理（必要であれば）
                                    console.log('Question moved:', evt.oldIndex, evt.newIndex);
                                    // 質問番号を振り直す
                                    const parentQuestionsList = evt.to;
                                    const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                                    remainingQuestions.forEach((q, i) => {
                                        const questionTitle = q.querySelector('.question-title');
                                        if (questionTitle) {
                                            const currentTitle = questionTitle.textContent;
                                            const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                                            const questionType = typeMatch ? typeMatch[1].trim() : '';
                                            questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                                        }
                                    });
                                },
                            });
                        }
                    }
                });
            }
        });
    });

    observer.observe(questionGroupsContainer, { childList: true });

    // 既存の質問グループにもSortableを適用
    questionGroupsContainer.querySelectorAll('.questions-list').forEach(questionsList => {
        new Sortable(questionsList, {
            animation: 150,
            handle: '.question-item .handle', // ドラッグハンドル
            ghostClass: 'blue-background-class', // ドラッグ中のスタイル
            onEnd: function (evt) {
                // 並べ替え後の処理（必要であれば）
                console.log('Question moved:', evt.oldIndex, evt.newIndex);
                // 質問番号を振り直す
                const parentQuestionsList = evt.to;
                const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                remainingQuestions.forEach((q, i) => {
                    const questionTitle = q.querySelector('.question-title');
                    if (questionTitle) {
                        const currentTitle = questionTitle.textContent;
                        const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                        const questionType = typeMatch ? typeMatch[1].trim() : '';
                        questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                    }
                });
            },
        });
    });

    // フローティングナビゲーションのドラッグ機能
    const floatingNav = document.getElementById('floatingNavContainer');
    const dragHandle = document.getElementById('openQuestionTypeSelectorBtn'); // ドラッグハンドルをメインボタンに設定
    let isDragging = false;
    let offsetX, offsetY;

    // 保存された位置を読み込む
    const savedPosition = localStorage.getItem('floatingNavPosition');
    if (savedPosition) {
        const { top, left } = JSON.parse(savedPosition);
        floatingNav.style.top = `${top}px`;
        floatingNav.style.left = `${left}px`;
        floatingNav.style.right = 'auto'; // bottom/rightを無効化
        floatingNav.style.bottom = 'auto';
    } else {
        // 初期位置を絶対配置に変換
        const rect = floatingNav.getBoundingClientRect();
        floatingNav.style.top = `${rect.top}px`;
        floatingNav.style.left = `${rect.left}px`;
        floatingNav.style.right = 'auto';
        floatingNav.style.bottom = 'auto';
    }

    dragHandle.addEventListener('mousedown', (e) => {
        // メニューが開いている場合はドラッグしない
        if (!questionTypeSelector.classList.contains('hidden')) {
            return;
        }
        isDragging = true;
        offsetX = e.clientX - floatingNav.getBoundingClientRect().left;
        offsetY = e.clientY - floatingNav.getBoundingClientRect().top;
        floatingNav.style.cursor = 'grabbing';
        floatingNav.style.position = 'fixed'; // ドラッグ中はfixedに
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        floatingNav.style.left = `${e.clientX - offsetX}px`;
        floatingNav.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            floatingNav.style.cursor = 'grab';
            // 位置を保存
            const rect = floatingNav.getBoundingClientRect();
            localStorage.setItem('floatingNavPosition', JSON.stringify({ top: rect.top, left: rect.left }));
        }
    });
}

// DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
});