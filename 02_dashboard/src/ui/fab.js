import { addNewQuestion, addNewQuestionGroup } from './surveyRenderer.js';

/**
 * FAB (Floating Action Button)をページに読み込んで初期化する
 * @param {string} containerId - FABをマウントするコンテナのID
 * @param {string} htmlPath - FABのHTMLファイルのパス
 */
export async function initializeFab(containerId, htmlPath) {
    try {
        const response = await fetch(htmlPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch FAB HTML: ${response.statusText}`);
        }
        const fabHtml = await response.text();
        const fabContainer = document.getElementById(containerId);
        if (!fabContainer) {
            console.error(`FAB container with id '${containerId}' not found.`);
            return;
        }
        fabContainer.innerHTML = fabHtml;

        setupFabEventListeners();
    } catch (error) {
        console.error('Failed to initialize FAB:', error);
    }
}

/**
 * FABのイベントリスナーをセットアップする
 */
function setupFabEventListeners() {
    const mainButton = document.getElementById('fab-main-button');
    const menu = document.getElementById('fab-menu');
    const icon = mainButton.querySelector('.material-icons');

    if (!mainButton || !menu || !icon) {
        console.error('FAB elements not found. Cannot set up event listeners.');
        return;
    }

    // メインボタンクリックでメニューを開閉
    mainButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isExpanded = mainButton.getAttribute('aria-expanded') === 'true';
        mainButton.setAttribute('aria-expanded', !isExpanded);
        menu.classList.toggle('opacity-0');
        menu.classList.toggle('pointer-events-none');
        menu.classList.toggle('scale-95');
        icon.classList.toggle('rotate-45');
    });

    // メニューの外側をクリックでメニューを閉じる
    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && !mainButton.contains(event.target)) {
            mainButton.setAttribute('aria-expanded', 'false');
            menu.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
            icon.classList.remove('rotate-45');
        }
    });

    // メニュー内のボタンクリックで質問を追加
    menu.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-question-type]');
        if (!button) return;

        const questionType = button.dataset.questionType;

        if (questionType === 'group') {
            addNewQuestionGroup();
        } else {
            addNewQuestion(questionType);
        }

        // メニューを閉じる
        mainButton.setAttribute('aria-expanded', 'false');
        menu.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        icon.classList.remove('rotate-45');
    });
}