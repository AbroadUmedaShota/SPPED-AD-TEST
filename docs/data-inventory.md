# Data Inventory (2025-09-17)
## Module Consumers
- `tableManager.js`: fetches `data/dashboard/surveys/surveys-with-details.json` for listing dashboards.
- `surveyCreation.js`: loads `data/dashboard/surveys/surveys.json` and per-survey detail files in `data/dashboard/surveys/enquete/` (fallbacks to `data/dashboard/core/surveys.json`).
- `survey-answer.js`: relies on `data/dashboard/core/surveys.json` and `data/dashboard/surveys/sample_survey.json` for respondent previews.
- `speed-review.js`: combines `data/dashboard/core/surveys.json`, `data/dashboard/responses/answers/<surveyId>.json`, `data/dashboard/responses/business-cards/<surveyId>.json`, and `data/dashboard/surveys/enquete/<surveyId>.json`.
- `services/invoiceService.js` & `invoiceDetail.js`: read `data/dashboard/core/invoices.json`.
- `services/surveyService.js`: now points to `data/dashboard/surveys/sample_survey.json`.
- `groupService.js`: distinguishes between `data/dashboard/core/groups.json` (runtime) and `data/dashboard/core/groups.sample.json` (demo).
- `graph-page.js`: consumes `data/dashboard/demos/sample-3/Enquete/<id>.json` and `.../Answer/<id>.json`.
- `02_dashboard/group-edit/`: mock group-management screen (set `window.__COMMON_BASE_PATH` to `../` before loading common partials).
## Directory Structure
- `data/dashboard/core/`: shared lookups (`surveys.json`, `groups.json`, `groups.sample.json`, `users.json`, `invoices.json`).
- `data/dashboard/surveys/`: survey definitions (`surveys-with-details.json`, `sample_survey.json`, `enquete/`).
- `data/dashboard/responses/`: per-survey responses (`survey-answers.json`, `business-cards.json`, `answers/`, `business-cards/`).
- `data/dashboard/demos/`: sample datasets for charts/response analysis (`sample-3/`).
- `archive/data-dumps/`: archived heavy exports (`0008000154*.json`, CSV dumps).
## Follow-ups
- Unify fetch helpers: `utils.js` now exposes `resolveDashboardDataPath` as the canonical joiner; audit remaining modules for direct string paths.
- Demo data: decide whether to keep `demos/` in the repo or move to `docs/examples/`.
- CSV usage: document when archived CSVs are needed before reintroducing them.
- QA: smoke test `surveyCreation.html`, `speed-review.html`, `graph-page.html` to confirm assets resolve under the new structure.
