### Pre-investigation Summary
- `bizcardSettings.html` 100行目に過去に削除されたはずの「プリセット」という文言がコメントで残存していることを確認。
- `bizcardSettings.html` 256行目にて、適用中クーポンのソース表示が `<p id="appliedCouponSourceDisplay">※お礼メール設定より適用</p>` とハードコーディングされている。
- `src/bizcardSettings.js` の `updateCouponSectionUI` 内にて、上記テキストを動的に切り替えるロジックが存在しないため、自画面で適用しても常に「お礼メール設定より適用」と表示されてしまう状態を確認。

### Contribution to Project Goals
- UIの正確な状態反映によるユーザー体験（UX）の向上
- コメントの適正化によるコードの保守性（メンテナンス性）の向上

### Overview of Changes
- クーポンの適用元の動的表示ロジックの追加
- HTMLの古いコメントの除去

### Specific Work Content for Each File
- `02_dashboard/bizcardSettings.html`:
  - `<!-- 見込み枚数（スライダー＋プリセット＋ステッパー） -->` を `<!-- 見込み枚数（スライダー＋ステッパー） -->` に修正。
  - `id="appliedCouponSourceDisplay"` の初期テキストを削除し、必要に応じて非表示クラスを付与する。
- `02_dashboard/src/bizcardSettings.js`:
  - `updateCouponSectionUI` 等で、クーポンが本画面で新規適用されたのか、LocalStorage (Shared) 経由で他画面から適用されたのかを判定。
  - その判定に基づき、`appliedCouponSourceDisplay` の文言や表示/非表示を動的に切り替えるロジックを追加する。

### Definition of Done
- [ ] HTMLの不要なコメントが削除されている。
- [ ] クーポンが自画面で適用された場合と、他画面から適用された場合で、表示文言が正しく制御される（自画面適用時は非表示にするなど）。
- [ ] 手動テストでの動作確認が完了し、エラーログが出ていないことを確認。

※User approval confirmed on the CLI
