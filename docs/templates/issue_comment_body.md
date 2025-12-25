### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
`speed-review.html` の回答詳細モーダルにおいて、フッター部分に「名刺画像」ボタンが表示されています。
調査の結果、`02_dashboard/src/speed-review.js` 内の `updateModalFooter` 関数でこのボタンが動的に追加されており、同ファイル内のイベントリスナーでクリック処理が行われていることが分かりました。

**Files to be changed:**
- `02_dashboard/src/speed-review.js`

#### 2. **Contribution to Project Goals**
不要なボタンを削除することでUIをシンプルにし、ユーザーが主要なアクション（編集・保存）に集中できるように改善します。

#### 3. **Overview of Changes**
回答詳細モーダルのフッターから「名刺画像」ボタンを完全に削除し、関連するコードをクリーンアップします。

#### 4. **Specific Work Content for Each File**
- `02_dashboard/src/speed-review.js`:
    - `updateModalFooter` 関数内の `footer.innerHTML` 代入箇所から `showCardImagesBtn` ボタンのHTML記述を削除します（通常時および編集時の両方）。
    - モーダル初期化処理内の `footer.addEventListener` 内にある `showCardImagesBtn` のクリック処理（`else if` ブロック）を削除します。

#### 5. **Definition of Done**
- [x] All necessary code changes have been implemented.
- [ ] New tests have been added to cover the changes. (N/A for this UI change)
- [ ] All existing and new tests pass.
- [ ] The documentation has been updated to reflect the changes.
- [ ] `WEEKLY_CHANGELOG.md` has been updated with the changes.
- [ ] The implementation has been manually verified.

---
If you approve, please reply to this comment with "Approve".