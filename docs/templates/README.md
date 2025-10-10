# Templates

This directory stores the canonical GitHub templates referenced by automation scripts and contributor docs.

## Contents
- `issue_body.md`: Canonical feature/task issue template used by the dashboard team.
- `issue_comment_body.md`: Response template for follow-up questions or status updates.
- `pr_body.md`: Pull Request description scaffold. Copy into new PRs before editing.
- `pr_comment_body.md`: Short acknowledgement/comment template for code reviews.

## Maintenance
- Update templates here whenever workflow guidance changes, and adjust helpers in `tools/` (for example `create_issue.sh`) so they continue to resolve files from `docs/templates/`.
- After edits, run `rg "docs/templates"` or similar checks to confirm no callers still reference the old root-level paths.
- When a template is superseded, move the previous copy to `archive/templates/` instead of leaving duplicates in the repository root. This keeps Phase 4 of the `docs/cleanup-plan.md` effort on track by separating active assets from archived references.
