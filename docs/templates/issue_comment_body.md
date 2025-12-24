### 実装計画書

このIssueを解決するために、以下の計画に従って実装を進めます。

#### 1. 事前調査のまとめ
`02_dashboard/src/ui/speedReviewRenderer.js` 内の `renderModalContent` 関数において、HTML文字列として生成される名刺画像の `onclick` 属性に `openCardZoom` 関数が割り当てられています。
この `openCardZoom` は `window` オブジェクトに紐付けられていますが、モーダル内のDOM生成とイベントハンドリングのタイミング、あるいはグローバル汚染により競合が発生し、フリーズの原因となっている可能性が高いです。
これを、DOM生成後に `addEventListener` でイベントを設定する方式に変更し、安全かつ確実に動作するようにします。

**変更対象ファイル:**
- `02_dashboard/src/ui/speedReviewRenderer.js`
- `02_dashboard/src/speed-review.js`

#### 2. プロジェクト目標への貢献
ユーザーが名刺情報を確認する際の致命的な不具合（フリーズ）を解消し、スムーズな操作性を提供することで、サービスの信頼性とユーザー体験を向上させます。

#### 3. 変更内容の概要
- **`onclick` 属性の廃止**: HTML文字列内の `onclick` を削除し、データ属性 (`data-zoom-src`) を使用して画像のURLを保持させます。
- **イベントリスナーの適切な設定**: モーダルのコンテンツが描画された直後に、対象の画像要素を取得し、クリックイベントリスナーを設定するロジックを追加します。
- **呼び出し元の修正**: `speed-review.js` において、モーダル描画後にイベントリスナー設定関数を呼び出すように変更します。

#### 4. ファイルごとの具体的な作業内容
- **`02_dashboard/src/ui/speedReviewRenderer.js`**:
    - `renderModalContent` 関数: `img` 親要素の `onclick` を削除し、`data-zoom-src` 属性を追加します。
    - `setupCardZoomListeners` 関数 (新規): 指定されたコンテナ内の `[data-zoom-src]` 要素に対し、クリック時に `openCardZoom` を実行するリスナーを設定します。
    - `openCardZoom` 関数: 内部ロジックは維持しつつ、必要であれば微調整します（現在は `window` に生やしていますが、モジュール内関数として利用するように変更を検討）。

- **`02_dashboard/src/speed-review.js`**:
    - `handleDetailClick` 関数: `renderModalContent` 呼び出し後に `setupCardZoomListeners` を呼び出します。
    - `handleEditToggle` 関数: 再描画後にも `setupCardZoomListeners` を呼び出します。

#### 5. 完了定義
- [ ] SPEEDレビューの詳細モーダルで、名刺（表面・裏面）の画像をクリックすると、拡大表示（オーバーレイ）が表示されること。
- [ ] 拡大表示時にアプリケーションがフリーズしないこと。
- [ ] 拡大表示の「×」ボタンまたは背景クリックで、拡大表示が閉じること。
- [ ] 拡大表示を閉じても、元の詳細モーダルが維持されていること。
- [ ] コンソールにエラーが出力されないこと。

---
承認いただける場合は、このコメントに「Approve」と返信してください。
