const breadcrumbPaths = {
    'index.html': [{ name: 'アンケート一覧', link: 'index.html' }],
    'surveyCreation.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集' },
    ],
    'speed-review.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'SPEEDレビュー' },
    ],
    'graph-page.html': [
        { name: 'アンケート一覧', link: '../02_dashboard/index.html' },
        { name: 'SPEEDレビュー', link: '#' }, // 動的リンクのプレースホルダー
        { name: 'グラフ分析' },
    ],
    'bizcardSettings.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集', link: '#' },
        { name: '名刺データ化設定' },
    ],
    'invoiceList.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: '請求書一覧' },
    ],
    'thankYouEmailSettings.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集', link: '#' },
        { name: 'お礼メール設定' },
    ],
};

function generateBreadcrumbs(currentPage, surveyId = null) {
    // graph-page.htmlは別ディレクトリにあるため、キーを正規化
    const pageKey = currentPage.includes('graph-page.html') ? 'graph-page.html' : currentPage;
    const paths = breadcrumbPaths[pageKey];
    if (!paths) return '';

    const breadcrumbItems = paths.map((path, index) => {
        let link = path.link;

        // 動的リンクの処理
        if (link === '#' && surveyId) {
            if (path.name === 'SPEEDレビュー') {
                // graph-page.htmlからの相対パスを考慮
                link = `../02_dashboard/speed-review.html?surveyId=${surveyId}`;
            } else {
                // デフォルトはsurveyCreation.htmlへのリンク
                link = `surveyCreation.html?surveyId=${surveyId}`;
            }
        }

        const isLast = index === paths.length - 1 || !path.link;
        const linkElement = isLast
            ? `<span class="text-on-surface-variant font-medium">${path.name}</span>`
            : `<a href="${link}" class="text-secondary hover:underline">${path.name}</a>`;

        const separator = isLast ? '' : `<span class="material-icons text-on-surface-variant mx-1">chevron_right</span>`;

        return `<li class="flex items-center">${linkElement}${separator}</li>`;
    }).join('');

    return `<nav aria-label="Breadcrumb"><ol class="flex items-center space-x-1 text-sm">${breadcrumbItems}</ol></nav>`;
}

export function initBreadcrumbs() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    const currentPage = window.location.pathname.split('/').pop();
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');

    container.innerHTML = generateBreadcrumbs(currentPage, surveyId);
}