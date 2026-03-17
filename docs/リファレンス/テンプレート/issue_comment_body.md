### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- `02_dashboard/thankYouEmailSettings.html` の現状を確認したところ、「アンケート名」にはすでに `info` アイコンが存在しますが、`title` 属性がありません。
- 「会期期間」および「送信しない」セクションにはヘルプ用のアイコンが存在しません。
- プロジェクトの仕様（`docs/画面設計/仕様/tooltip_spec.md`）に基づき、`help_outline` アイコンを使用し、標準の `title` 属性でツールチップを実現します。

**Files to be changed:**
- `02_dashboard/thankYouEmailSettings.html`
- `docs/画面設計/仕様/tooltip_spec.md` (仕様書の更新)

#### 2. **Contribution to Project Goals**
- ユーザーが各設定項目の意味や制約を正しく理解できるようになり、誤設定の防止と操作性の向上に寄与します。

#### 3. **Overview of Changes**
- `thankYouEmailSettings.html` 内の3箇所にヘルプアイコン（`help_outline`）を追加または更新し、ユーザーの要望に基づいた説明文を `title` 属性として設定します。

#### 4. **Specific Work Content for Each File**
- `02_dashboard/thankYouEmailSettings.html`:
    - 「アンケート名」の `info` アイコンを `help_outline` に変更し、要望通りの説明文を `title` に設定。
    - 「会期期間」の見出し横に `help_outline` アイコンを追加し、改行を含めた詳細な説明を `title` に設定。
    - 「送信しない」のラベル内、見出し横に `help_outline` アイコンを追加し、説明文を `title` に設定。
- `docs/画面設計/仕様/tooltip_spec.md`:
    - 「送信しない」のツールチップ仕様をドキュメントに追加。

#### 5. **Definition of Done**
- [x] All necessary code changes have been implemented.
- [ ] New tests have been added to cover the changes. (UI/HTML変更のため、目視確認を主とする)
- [ ] All existing and new tests pass.
- [ ] The documentation has been updated to reflect the changes.
- [ ] `WEEKLY_CHANGELOG.md` has been updated with the changes.
- [ ] The implementation has been manually verified.

---
If you approve, please reply to this comment with "Approve".
