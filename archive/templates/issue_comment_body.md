### 実装計画案

#### 1. **事前調査の概要**
-   対象ファイルは `02_dashboard/common/sidebar.html` と `02_dashboard/src/sidebarHandler.js`。
-   アクティブ状態管理の改善のため、関連するHTMLファイル (`index.html`, `invoiceList.html`, `group-edit.html`) にも軽微な修正を加える。

**変更対象ファイル:**
-   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\common\sidebar.html`
-   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\src\sidebarHandler.js`
-   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\index.html`
-   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\invoiceList.html`
-   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\group-edit.html`

---

#### 2. **各タスクの具体的な作業内容**

**タスク1: ナビゲーション項目の動的生成**
1.  **`sidebar.html`**:
    -   `<nav>`内のハードコードされたリンク (`<a>`タグ群) をすべて削除する。
    -   `<nav>`タグに`id="sidebar-nav"`を付与して、JavaScriptから操作できるようにする。
2.  **`sidebarHandler.js`**:
    -   ナビゲーション項目の設定（ID, URL, アイコン, ラベル）を持つ配列を定義する。
    -   この配列を元にHTMLを動的に生成し、`#sidebar-nav`に挿入する関数を実装する。

**タスク2: グループ切り替えのUX改善**
1.  **`sidebar.html`**:
    -   グループ管理ブロック内の「切替」ボタン (`<button>`) を削除する。
2.  **`sidebarHandler.js`**:
    -   「切替」ボタンのイベントリスナーに関する記述を削除する。
    -   グループ選択 (`<select id="user_select">`) に`change`イベントリスナーを追加し、選択と同時にグループが切り替わるように処理を実装する。

**タスク3: アクティブ状態管理の堅牢化**
1.  **各HTMLファイル (`index.html`など)**:
    -   `<body>`タグに、ページを識別するための`data-page-id`属性を追加する (例: `<body data-page-id="survey-list">`)。
2.  **`sidebarHandler.js`**:
    -   現在のURLパス名で判定しているロジックを削除する。
    -   ナビゲーションを動的に生成する際に、`document.body.dataset.pageId`とナビゲーション項目のIDを比較し、一致するものに`active`クラスを付与するロジックを追加する。

**タスク4: レスポンシブ処理の改善**
1.  **`sidebarHandler.js`**:
    -   `window.innerWidth >= 1024`という記述を`window.matchMedia('(min-width: 1024px)')`を使用する方式に置き換える。
    -   `resize`イベントリスナーを廃止し、`matchMedia`オブジェクトの`change`イベントリスナーで、PC/モバイル表示の切り替えをハンドルするように変更する。

---

#### 3. **完了の定義**
-   [ ] 上記のすべてのコード変更が実装されている。
-   [ ] サイドバーが正しく表示され、すべてのリンクが機能する。
-   [ ] グループ切り替えがボタンなしで動作する。
-   [ ] 現在表示しているページに対応するメニューが正しくハイライトされる。
-   [ ] PC/モバイル表示の切り替えが正常に動作する。