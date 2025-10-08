現在のサイドバー実装に対し、保守性とユーザー体験を向上させるため、以下のリファクタリングを実施する。

**実施項目:**

1.  **ナビゲーション項目の動的生成:**
    *   HTMLにハードコードされているナビゲーションリンクを、JavaScriptオブジェクトから動的に生成するように変更する。

2.  **グループ切り替えUXの改善:**
    *   グループ選択用の`<select>`が変更された際に即座に処理が実行されるようにし、不要な「切替」ボタンを削除する。

3.  **アクティブ状態管理の堅牢化:**
    *   URL文字列の比較による不安定なアクティブ判定を止め、各ページに識別子を持たせるなど、より確実な方法に変更する。

4.  **レスポンシブ処理の改善:**
    *   JavaScript内のブレークポイント指定（マジックナンバー）を廃止し、`window.matchMedia` APIを使用してCSSとロジックを同期させる。

**対象ファイル:**
*   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\common\sidebar.html`
*   `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_user\02_dashboard\src\sidebarHandler.js`