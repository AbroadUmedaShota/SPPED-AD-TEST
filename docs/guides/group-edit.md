# グループエディット

ダッシュボード直下に配置されたグループ編集デモのファイル構成です。

- `02_dashboard/group-edit.html`: 共通ヘッダー／サイドバーを `loadCommonHtml` で読み込むページ本体。トップレベルに配置されているため追加のベースパス指定は不要です。
- `02_dashboard/src/groupEdit.js`: グループ編成ロジックとモーダル操作をまとめたエントリーモジュールで、`main.js` が `initGroupEditPage()` を呼び出します。
- `02_dashboard/modals/memberDetailModal.html`: メンバー詳細モーダルのテンプレート。`handleOpenModal` から `modals/memberDetailModal.html` として読み込みます。

`main.js` 側では `import { initGroupEditPage } from './groupEdit.js';` として取り込み、`group-edit.html` にアクセスした際に初期化が実行されます。
