# CONTRIBUTING.md

## 1. 貢献の仕方

-   典型的なフローは **Issue起票 → フィーチャーブランチ作成 → 実装 & ドキュメント更新 → 手動テスト → Pull Request提出 → レビュー対応 → マージ** の順に進めます。
-   作業を始める前に、リポジトリ全体の方針を `AGENTS.md` と [プロジェクト概要](README.md) で確認し、該当機能の仕様・設計ドキュメントを最新化してください。
-   コードやUIに変更が入る場合は、[コーディング規約](product/standards/02_CODING_STANDARDS.md) と各種設計資料（例: `docs/product/`、`docs/画面設計/specs/`）を参照し、整合性を保つようにします。
-   ドキュメント更新やテンプレート調整などのプロセス変更は、実装と同じブランチ内で行い、関連するテンプレート（[docs/references/templates](references/templates)）も忘れずに更新します。

## 2. Issueの作成

-   課題や改善点を議論する際は、`main` ブランチでの最新状態を確認したうえで Issue を起票し、重複タスクを避けます。
-   背景・目的・期待結果・確認観点を網羅するため、[Issue テンプレート](references/templates/issue_body.md) を基に必要項目を記入し、関連する仕様リンク（例: `docs/画面設計/specs/`）やスクリーンショットを添付します。
-   緊急度や影響範囲をラベルで明示し、質問や補足は [Issue コメントテンプレート](references/templates/issue_comment_body.md) を参考に追記します。
-   ブランチ作成前に、担当者と着手条件（要件確定・デザイン有無・レビュー観点など）を Issue 内で合意し、レビュー完了まで参照できるソースオブトゥルースとして維持します。

## 3. Pull Requestの作成

-   実装は `main` から派生したフィーチャーブランチで行い、`feature/<概要>`、`fix/<概要>` など GitHub Flow に沿った命名を徹底します。詳細は [HOWTO_GET_STARTED.md](handbook/setup/HOWTO_GET_STARTED.md) を参照してください。
-   PR 説明は [PR テンプレート](references/templates/pr_body.md) をコピーして使用し、Issue 番号、変更概要、影響範囲、スクリーンショット（UI 変更時）を具体的に記載します。
-   変更内容に合わせて関連ドキュメントやテンプレートを更新し、差分に含めます。未更新の場合は理由を明記してください。
-   [テストガイドライン](handbook/testing/03_TESTING_GUIDELINES.md) に沿った手動テスト結果を PR に列挙し、ブラウザ別の確認状況や主要なユーザーフローの成否を示します。
-   自動テストがないため、最低限コンソールエラーがないことを確認し、必要に応じて動画・GIF で動作を共有します。

## 4. コードレビュープロセス

-   レビューアは、PR 説明と添付資料を確認したうえで、[コーディング規約](product/standards/02_CODING_STANDARDS.md)・UI ガイドライン・データモデルと実装の整合性を重点的にチェックします。
-   手動テスト結果を再現し、[テストガイドライン](handbook/testing/03_TESTING_GUIDELINES.md) の観点（UI/UX、レスポンシブ、データ整合性など）に不足がないかを評価します。
-   指摘は根拠となるファイル・行番号を引用し、必要に応じて [PR コメントテンプレート](references/templates/pr_comment_body.md) を利用して構造化します。
-   修正が完了したら、最新差分で再確認し、必要な場合は Issue/PR を更新して知見を共有します。承認後は `main` へマージし、関連 Issue をクローズします。

