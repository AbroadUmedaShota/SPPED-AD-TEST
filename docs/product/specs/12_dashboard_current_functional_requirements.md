# Dashboard Functional Baseline (Current Implementation)

## Scope
- Captures the behaviours currently implemented under `02_dashboard` as of 2025-10-20.
- Focuses on features reachable from `index.html`, `surveyCreation.html`, `speed-review.html`, and related dashboards that rely on static datasets.
- Login, admin, and other entry points are out of scope unless reused by the dashboard shell.

## Data Sources and Path Resolution
- `02_dashboard/src/utils.js` exposes `resolveDashboardDataPath` and `resolveDemoDataPath` to translate relative requests into `/data/...` and `/data/demo_...`.
- Primary datasets include `data/surveys/surveys-with-details.json` (table view and survey modal), `data/core/surveys.json` (per-survey settings), `data/core/invoices.json` (billing), and `data/core/groups.json` (sidebar context).
- Sample responses and business-card payloads live under `data/demo_answers`, `data/demo_business-cards`, and `data/responses`; CSV paths are also supported by `speedReviewService`.
- Write operations update in-memory arrays or `localStorage`; no server persistence is wired up in this codebase.

## Shell Navigation and Common UI
- `02_dashboard/src/main.js` detects the active page via `document.body.dataset.pageId`, initialises page-specific modules, reloads the survey table on return visits to the index, and injects tutorial resume banners from `localStorage`.
- Partial fragments under `02_dashboard/common/` are fetched through `loadCommonHtml`, which also rewrites relative asset paths.
- Global widgets (sidebar, theme toggle, breadcrumbs, QR modal) are bootstrapped centrally; `showToast` and clipboard helpers are shared via `utils.js`.
- `sidebarHandler.js` fetches groups, persists the selected group (`dashboard.selectedGroupId`), toggles the mobile drawer with scroll locking, and binds navigation items (including the account modal and logout placeholder).

## Survey List (`index.html`, `tableManager.js`)
- Fetches surveys from `data/surveys/surveys-with-details.json`, filters out entries mapped to `USER_STATUSES.DELETED`, and caches the result for reuse.
- Provides keyword search, status dropdown (derived in `statusService.js`), date range filters (flatpickr), items-per-page selection, and group scoping from the sidebar; language changes trigger re-evaluation.
- Table headers support ascending/descending sort with icon feedback, while pagination renders ellipsis buttons and keeps the current page within bounds.
- Row actions include duplication (generates a new ID based on user and fiscal year), opening Speed Review, conditional downloads (disabled until lifecycle permits), launching the survey editor, copying the survey URL, and opening the detail modal.
- `surveyDetailsModal.js` surfaces lifecycle metadata, quick links to Bizcard/thank-you/Speed Review screens, and download eligibility computed by `deriveSurveyLifecycleMeta`.
- `downloadOptionsModal.js` lets operators choose export artefacts (answers, images, business cards) and, when needed, define constrained custom periods.

## Survey Authoring (`surveyCreation.html`, `surveyCreation.js`, `ui/surveyRenderer.js`)
- Initialises from `fetchSurveyData` and optionally `loadSurveyDataFromLocalStorage`; unsaved changes trigger confirmation across in-page links, history navigation, and browser unload.
- Multi-language authoring supports Japanese, English, Traditional/Simplified Chinese, and Vietnamese; up to three languages stay active while placeholders mirror the base language.
- Question groups can be created, duplicated, reordered (Sortable integration), or removed; each question type supports duplication, deletion, and change of type with context-aware controls.
- Supported types span free text, single choice, multiple choice, dropdown, numeric, matrix (single/multi), date/time, handwriting canvas, and explanation cards; metadata editors expose options, matrix rows/columns, numeric ranges, datetime limits, handwriting canvas size, and display toggles.
- Outline sidebar renders an overview with jump links, QR modal hooks, and tutorial entry points (`tutorial.js`, `surveyCreationTutorial.js`).
- Links to Bizcard, thank-you email, and thank-you screen settings carry the current survey ID; saving currently writes to `localStorage` only.

## Analytics and Review Tools
### Speed Review (`speed-review.html`, `speed-review.js`)
- `speedReviewService` parses CSV assets, merges answer rows with business-card data, and enriches them using the survey definition.
- UI exposes search, industry question selector, context-dependent answer filter, date picker, and pagination (25 rows per page).
- Detail modal supports view/edit modes, adapting controls for single-choice, multi-choice, and free-text questions; edits are applied to in-memory state and persisted only for the session.

### Graph Page (`graph-page.html`, `graph-page.js`)
- Loads survey definitions and answers from `/data/demo_surveys` and `/data/demo_answers`.
- Optional date range filtering limits the dataset before aggregation.
- Produces chart-ready data for single and multi-choice questions while ensuring that predefined options with zero responses still appear in the output.

### Survey Details and Downloads
- `surveyDetailsModal.js` aggregates lifecycle metadata from `statusService` (download deadlines, conversion completion, bizcard requirements) and exposes direct navigation to related workflows.
- `statusService.js` normalises raw status strings into user-facing states (`PRE_PERIOD`, `IN_PERIOD`, `POST_PERIOD`, `DATA_PROCESSING`, `DATA_READY`, `DOWNLOAD_CLOSED`), associates badge styling, and provides sort/filter helpers for the table.

## Business Card Conversion (`bizcardSettings.html`, `bizcardSettings.js`)
- Loads survey context and stored settings from `data/core/surveys.json`; defaults enable conversion with a 100-card request.
- Plan and premium option catalogues come from `services/bizcardPlans.js`; UI updates dependent controls and memo sections accordingly.
- Coupon validation uses a mocked dictionary; applying a coupon influences estimation and completion timing.
- `calculateEstimate` returns amount, premium add-ons, minimum charge, and completion dates (survey end plus turnaround or coupon boost); summary cards reflect the computed values.
- Saving relies on a mocked `saveBizcardSettings` promise; no back-end API is called.

## Thank-you Messaging
### Email (`thankYouEmailSettings.html`, `thankYouEmailSettings.js`)
- `getInitialData` fetches survey metadata and previously saved settings from `data/core/surveys.json`, supplementing mock templates and merge variables.
- New configurations default to automatic sending; UI toggles enable/disable sections, update previews, and insert merge variables via `insertTextAtCursor`.
- Save and send actions expose loading states and call mocked service functions (`saveThankYouEmailSettings`, `sendThankYouEmails`).

### Screen (`thankYouScreenSettings.html`, `thankYouScreenSettings.js`)
- Prefills survey title and thank-you message, enforces a 500-character limit, and offers a toggle for allowing continuous answers.
- Persists per-survey settings in `localStorage` (`thankYouScreenSettings_{id}`) and compares against the baseline to determine save and confirmation behaviour.
- Integrates `showConfirmationModal` for destructive actions and adapts headings based on the active language.

## Group Administration (`group-edit.html`, `groupEdit.js`)
- Pulls group metadata via `groupService.js` (static JSON) and exposes toggles between creator billing and group billing views.
- Billing info has view/edit modes with inline validation and change tracking separate from overall form dirtiness.
- Member list renders cards with avatars, role dropdowns, status badges, delete buttons, and drag handles powered by Sortable.js; quick-sort buttons adjust role/status ordering with stateful indicators.
- Confirmation modals guard deletion and navigation when unsaved changes exist; create/update/delete operations update only the in-memory `groups` cache.

## Billing (`invoiceList.html`, `invoiceDetail.html`)
- Invoice list fetches `data/core/invoices.json`, filters by status, and renders cards with plan badges, billing period labels, and summary metadata; empty states surface contextual reload actions.
- Detail view displays invoice metadata, amount breakdown, banking instructions, and status badge, and exposes XLSX downloads (static sample) plus a print view.
- Status-driven logic disables print or download when the invoice is cancelled and ensures total and tax formatting through `Intl.NumberFormat`.

## Account and Security
- Account info modal is lazy-loaded by `modalHandler.js`, populated via `accountInfoModal.js`, and reuses clipboard helpers for field copies.
- Password change (`password_change.js`) implements a three-step wizard: mock validation of the current password, strength feedback with dynamic criteria, and completion messaging; visibility toggles and cancel confirmations are included.
- Reset password (`reset-password.js`) delivers a strength meter powered by `zxcvbn`, visibility toggles, and client-side validation before displaying a success state.

## Shared Utilities and Infrastructure
- `modalHandler.js` lazy-loads modal HTML, tracks scroll locking, registers close behaviours, and wires feature-specific callbacks (account info, survey details, group management, QR code, review detail).
- `utils.js` centralises scroll locking, toast notifications, clipboard copy (with fallbacks), static file downloads, partial HTML loading, loading/message overlays, and a generic `debounce`.
- `sidebarHandler.js` coordinates group selection with `tableManager.setGroupFilter`, manages responsive behaviour, and suppresses background scroll while overlays are open.
- UI widgets such as date pickers, floating action buttons, theme toggles, and tutorial helpers live under `02_dashboard/src/lib` and `02_dashboard/src/ui` and are consumed by the screens above.

## Mocked or Missing Back-end Integration
- Survey duplication, thank-you email save/send, bizcard settings save, coupon validation, group CRUD, password validation, and Speed Review edits operate entirely on client-side state.
- Reloading the page discards changes because no persistence layer is implemented beyond `localStorage`.
- CSV parsing expects static assets; file upload or approval workflows are not present.
- Email delivery, download generation beyond bundled samples, and lifecycle status updates are simulated via toasts and console logging without server communication.
