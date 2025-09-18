# グループ管理デモ

このフォルダにはグループ編集モック画面 (HTML/JS) が配置されています。

- `group-edit.html` : 共通ヘッダー/サイドバー/フッターを `loadCommonHtml` で読み込むページ本体。読み込み前に `window.__COMMON_BASE_PATH = '../';` を設定します。
- `group-edit.js` : グループ編成ロジックとモックデータ。`main.js` から `initGroupEditPage()` が呼び出されます。
- `member-detail-modal.html` などの部分テンプレートも同階層に配置。

`main.js` 側では `import { initGroupEditPage } from './group-edit/group-edit.js';` として取り込んでいます。
