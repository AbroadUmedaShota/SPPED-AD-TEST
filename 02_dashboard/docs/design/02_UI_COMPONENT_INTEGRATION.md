# 02_UI_COMPONENT_INTEGRATION.md: UIコンポーネント統合ガイド

このドキュメントは、SPEED AD プロジェクトにおける共通UIコンポーネント（ヘッダー、サイドバー、フッター、モーダルなど）を新しいページや既存のページに統合するためのガイドラインを提供します。

## 1. 共通UIコンポーネントの原則

本プロジェクトでは、UIの一貫性、再利用性、保守性を高めるため、以下の原則に基づき共通UIコンポーネントを扱います。

-   **単一ソース**: 各共通UIコンポーネントのHTMLは、`02_dashboard/common/` または `02_dashboard/modals/` ディレクトリ内の単一のファイルで管理されます。
-   **動的読み込み**: 各ページは、JavaScriptを使用してこれらの共通コンポーネントを動的に読み込みます。これにより、HTMLの重複を排除し、変更管理を容易にします。
-   **関心の分離**: 各コンポーネントは、自身の表示と基本的なインタラクションに責任を持ちます。ページ固有のロジックやデータ処理は、各ページのJavaScriptファイルで管理されます。

## 2. 共通UIコンポーネントの統合方法

新しいページを作成する場合、または既存のページに共通UIコンポーネントを統合する場合、以下の手順に従ってください。

### 2.1. HTMLファイルの準備

共通UIコンポーネントを組み込みたいHTMLファイル（例: `02_dashboard/your_new_page.html`）に、以下のプレースホルダー要素を追加します。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <!-- ... 省略 ... -->
</head>
<body>

<!-- 1. アプリケーション全体構造 -->
<div class="relative flex min-h-screen flex-col overflow-x-hidden">

    <!-- サイドバー用オーバーレイ (モバイル用) -->
    <div id="mobileSidebarOverlay" class="mobile-sidebar-overlay lg:hidden"></div>

    <!-- 2. ヘッダーのプレースホルダー -->
    <div id="header-placeholder"></div>

    <div class="flex flex-1 pt-16 bg-background">
        <!-- 3. サイドバーのプレースホルダー -->
        <div id="sidebar-placeholder"></div>

        <!-- 4. メインコンテンツ -->
        <main class="flex flex-1 flex-col py-8 px-4 sm:px-6 lg:px-8" id="main-content">
            <!-- ここにページ固有のコンテンツを記述します -->
            <div id="breadcrumb-container" class="mb-4"></div>
            <h1>あなたのページのタイトル</h1>
            <!-- ... その他のコンテンツ ... -->
        </main>
    </div>

    <!-- 5. フッターのプレースホルダー -->
    <div id="footer-placeholder"></div>

</div>

<!-- ページ固有のJavaScriptファイル -->
<script type="module" src="src/main.js"></script>
</body>
</html>
```

**ポイント:**
-   `<header>`, `<aside>`, `<footer>` タグを直接記述する代わりに、対応する `div` 要素と `id` を使用します。
-   `src/main.js` を `</body>` タグの直前で `type="module"` を指定して読み込みます。これにより、`main.js` がDOMの読み込み完了後に共通コンポーネントを挿入します。

### 2.2. `src/main.js` の設定

`src/main.js` は、アプリケーションの共通初期化ロジックを管理するメインファイルです。新しいページで共通コンポーネントが正しく読み込まれるように、以下の修正を行います。

1.  **共通HTMLの読み込み:**
    `DOMContentLoaded` イベントリスナー内で、`loadCommonHtml` 関数を使用して各プレースホルダーに共通HTMLを挿入します。

    ```javascript
    // src/main.js
    import { loadCommonHtml } from './utils.js';
    import { initSidebarHandler, adjustLayout } from './sidebarHandler.js';
    // ... その他のimport ...

    document.addEventListener('DOMContentLoaded', async () => {
        // 共通要素の読み込み
        await loadCommonHtml('header-placeholder', 'common/header.html');
        await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler); // サイドバーは初期化関数を渡す
        await loadCommonHtml('footer-placeholder', 'common/footer.html');

        // ... その他の共通初期化 ...

        // ページ固有の初期化
        const page = window.location.pathname.split('/').pop();
        switch (page) {
            case 'index.html':
            case '': // ルートパス
                // ... index.html 固有の初期化 ...
                break;
            case 'your_new_page.html': // 新しいページのエントリを追加
                // ここに your_new_page.html 固有の初期化関数を呼び出します
                // 例: initYourNewPage();
                break;
            // ... その他のページ ...
        }

        // ... レイアウト調整など ...
    });
    ```

2.  **ページ固有の初期化関数の追加:**
    新しいページに固有のJavaScriptロジックがある場合、その初期化関数を `src/main.js` の `switch` 文に追加します。これにより、ページがロードされたときに適切なロジックが実行されます。

### 2.3. モーダルの統合

モーダルは、`02_dashboard/modals/` ディレクトリに個別のHTMLファイルとして存在します。これらをページから開くには、`src/modalHandler.js` の `handleOpenModal` 関数を使用します。

```javascript
// 例: ボタンクリックでモーダルを開く
document.getElementById('yourButtonId').addEventListener('click', () => {
    handleOpenModal('yourModalId', 'modals/yourModal.html');
});
```

-   `yourModalId`: モーダルのHTMLファイル内で定義されている `div` 要素の `id`。
-   `modals/yourModal.html`: モーダルのHTMLファイルへのパス。

`handleOpenModal` は、モーダルがまだDOMに存在しない場合は自動的に読み込み、表示します。

## 3. 関連するJavaScriptモジュール

共通UIコンポーネントの動作を支える主要なJavaScriptモジュールは以下の通りです。

-   `src/main.js`: アプリケーションのエントリーポイント。共通HTMLの読み込みとページ固有の初期化を調整します。
-   `src/utils.js`: `loadCommonHtml` 関数を含む、汎用的なユーティリティ関数を提供します。
-   `src/sidebarHandler.js`: サイドバーの開閉ロジック、グループ選択、テーマ切り替えなど、サイドバー固有のインタラクションを管理します。
-   `src/modalHandler.js`: モーダルの動的読み込み、表示、非表示、スクロールロックなどのモーダル関連のロジックを一元的に管理します。
-   `src/themeToggle.js`: テーマ切り替えのロジックを管理します。
-   `src/breadcrumb.js`: パンくずリストの生成と表示を管理します。

これらのモジュールを理解することで、共通UIコンポーネントがどのように機能し、新しい開発にどのように組み込むべきかを把握できます。
