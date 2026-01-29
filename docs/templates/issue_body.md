### Issue Proposal

プレミアムプランの月額固定課金および個別請求仕様の反映、顧客機密情報の保護（「モニター企業」への置換）、およびフッターUIの改善（4カラム・サービス幅広化）を実装しました。

#### 1. **Pre-investigation Summary**
- プレミアムプランの課金体系が「従量課金なしの月額固定」かつ「個人請求（グループ請求外）」となる方針に基づき、既存ドキュメントの整合性を確認し修正。
- 特定の顧客名が含まれていた箇所を機密保持のため「モニター企業」に置換。
- フッターのレイアウトを4カラム構成（サービス紹介を2カラム分使用）に変更し、左寄せに統一。

**Files to be changed:**
- `02_dashboard/common/footer.html`
- `docs/service-consideration/README.md`
- `docs/service-consideration/2026-01-23_プレミアムプラン_機能選別一覧.md`
- `docs/service-consideration/2026-01-23_サービス機能_全体棚卸し表.md`
- `docs/service-consideration/2026-01-24_プレミアム機能_詳細分解一覧.md`
- `00_Abroad⇔Rep/2026-01-16_請求書関連ページ_仕様共有資料.md`
- `docs/notes/meetings/2026-01-24_premium-plan_scope-and-apr-release.txt`
- `docs/notes/meetings/2026-01-27_speed-ad_rework_policy_meeting.txt`

#### 2. **Contribution to Project Goals**
- ビジネス方針（課金・請求）の正確なドキュメント化。
- セキュリティ・コンプライアンス（機密保持）の徹底。
- UI/UXの改善によるブランドイメージの向上。

#### 3. **Overview of Changes**
- プレミアムプランの説明から「従量課金」を削除し「月額固定」に統一。
- 請求が「ユーザー個人」宛であり「グループ請求」に含まれない旨を明記。
- 「THK」などの特定名称を「モニター企業」に置換。
- フッターを視覚的4カラム（グリッド5分割、1列目スパン2）に変更。

#### 4. **Specific Work Content for Each File**
- `footer.html`: グリッド定義を変更し、サービスセクションを幅広化。
- `2026-01-23_プレミアムプラン_機能選別一覧.md`: 料金体系と請求仕様を更新。
- 各ドキュメント: 特定社名の置換とファイル名の日本語化対応。

#### 5. **Definition of Done**
- [x] All necessary code changes have been implemented.
- [x] The documentation has been updated to reflect the changes.
- [x] Specific client names have been removed.
- [x] Footer UI aligns with the new specification.
- [x] The implementation has been manually verified.

---
If you approve, please reply to this comment with "Approve".