# Data Inventory (2025-09-17)
IDフォーマット: アンケートIDは `sv_YYYYMMDD_###` 形式（JSTの作成日＋連番）で統一し、関連データのキーとして利用します。
## Module Consumers
- `tableManager.js`: fetches `data/core/surveys.json` for listing dashboards (demoフォールバック廃止、core一本化)。
- `surveyCreation.js`: loads `data/surveys/surveys.json` and per-survey detail files in `data/surveys/enquete/` (fallbacks to `data/core/surveys.json`).
- `survey-answer.js`: relies on `data/core/surveys.json` and `data/surveys/sample_survey.json` for respondent previews.
- `speed-review.js`: combines `data/core/surveys.json`, `data/responses/answers/<surveyId>.json`, `data/responses/business-cards/<surveyId>.json`, and demo payloads in `docs/examples/demo_surveys/<surveyId>.json`.
- `services/invoiceService.js` & `invoiceDetail.js`: read `data/core/invoices.json`.
- `services/surveyService.js`: now points to `data/surveys/sample_survey.json`.
- `groupService.js`: distinguishes between `data/core/groups.json` (runtime) and `data/core/groups.sample.json` (demo).
- `graph-page.js`: consumes `docs/examples/demo_surveys/<id>.json` and `.../demo_answers/<id>.json`.
-  `02_dashboard/group-edit/`: mock group-management screen. Base paths are auto-detected; override `window.__COMMON_BASE_PATH` (e.g., set to `../`) only if the assets live outside the standard structure. 
## Directory Structure
- `data/core/`: shared lookups (`surveys.json`, `groups.json`, `groups.sample.json`, `users.json`, `invoices.json`).
- `data/surveys/`: survey definitions (`surveys-with-details.json`, `sample_survey.json`, `enquete/`).
- `data/responses/`: per-survey responses (`survey-answers.json`, `business-cards.json`, `answers/`, `business-cards/`).
- `docs/examples/demo_surveys/`: demo survey definitions for charts and training data（`resolveDemoDataPath('surveys/...')`で解決）。
- `docs/examples/demo_answers/`: sample answer exports tied to demo surveys.
- `docs/examples/demo_business-cards/`: persona data linked to demo answers.
- `archive/data-dumps/`: archived heavy exports (`0008000154*.json`, CSV dumps).
## Follow-ups
- Unify fetch helpers: `utils.js` now exposes `resolveDashboardDataPath` as the canonical joiner; audit remaining modules for direct string paths.
- Demo data: moved to `docs/examples/demo_*` and resolved via `resolveDemoDataPath`; audit remaining modules for direct string paths.
- CSV usage: document when archived CSVs are needed before reintroducing them.
- QA: smoke test `surveyCreation.html`, `speed-review.html`, `graph-page.html` to confirm assets resolve under the new structure.
