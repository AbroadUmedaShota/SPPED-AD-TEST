### Issue Proposal

1月27日の会議方針に基づき、プレミアムプランの機能制限、UIの拡張、およびオフィス移転に伴う基本情報の更新を実装しました。

#### 1. **Pre-investigation Summary**
調査の結果、現状のコードベースにはプランごとの機能制限ロジックが未実装であり、住所情報も旧オフィスのままとなっていました。また、コンプライアンス対応としてログイン時の規約同意が必要であることが確認されました。

**Files to be changed:**
- `index.html`
- `02_dashboard/common/footer.html`
- `02_dashboard/specified-commercial-transactions.html`
- `02_dashboard/src/accountInfoModal.js`
- `02_dashboard/src/services/surveyService.js`
- `02_dashboard/src/sidebarHandler.js`
- `02_dashboard/src/surveyCreation.js`
- `02_dashboard/src/ui/surveyRenderer.js`
- `02_dashboard/surveyCreation.html`
- `data/surveys/sample_survey.json`
- `docs/service-consideration/2026-01-23_premium-plan_feature-list.md`
- `docs/service-consideration/2026-01-23_service-feature-inventory.md`
- `docs/service-consideration/2026-01-24_premium-feature-breakdown.md`
- `docs/service-consideration/README.md`
- `docs/templates/email/invoice-notification-email-template_jp.txt`
- `02_dashboard/src/services/planCapabilityService.js` (新規)
- `data/core/plan-capabilities.json` (新規)
- `docs/notes/meetings/2026-01-27_speed-ad_rework_policy_meeting.txt` (新規)

#### 2. **Contribution to Project Goals**
- 収益化に向けたプレミアムプランの基盤構築。
- 会社情報の最新化による信頼性の維持。
- 法的要件（規約同意）の遵守。

#### 3. **Overview of Changes**
- プレミアムプラン向けの機能制限（多言語、設問数上限）とUIの追加。
- 住所情報の更新（秋葉原クロスサイド → 秋葉原IT2ビル）。
- ログイン時の規約同意チェックボックスの実装。

#### 4. **Specific Work Content for Each File**
- `index.html`: ログインフォームに規約同意チェックボックスを追加。
- `02_dashboard/src/surveyCreation.js`: 多言語トグル制御とプラン別のバリデーションを実装。
- `02_dashboard/specified-commercial-transactions.html`: 住所を更新。
- `02_dashboard/src/services/planCapabilityService.js`: プラン別の権限データを取得するサービスを作成。

#### 5. **Definition of Done**
- [x] All necessary code changes have been implemented.
- [ ] New tests have been added to cover the changes.
- [ ] All existing and new tests pass.
- [x] The documentation has been updated to reflect the changes.
- [ ] `WEEKLY_CHANGELOG.md` has been updated with the changes.
- [x] The implementation has been manually verified.

---
If you approve, please reply to this comment with "Approve".