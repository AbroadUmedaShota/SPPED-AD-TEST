# Repository Cleanup Plan

## Current Status
- [2025-09-17] Archived legacy `src/` tree under `archive/legacy-src/` and relocated `tableManager.js.bak` out of `02_dashboard/src/`.
- [2025-09-17] Consolidated modal HTML by moving legacy `modals/` into `archive/legacy-modals/` alongside the active `02_dashboard/modals/` source.
- [2025-09-17] Migrated dashboard data fixtures into `data/` (core/responses/surveys/demos) and moved large dumps to `archive/data-dumps/`.
- [2025-09-17] Manual smoke test: index/surveyCreation/speed-review/invoice pages load with `/data/` paths, no console errors observed.
- [2025-09-17] Survey list actions now expose SPEED Review and analytics demo shortcuts.
- [2025-09-17] Moved group-edit demo under `02_dashboard/group-edit/` and linked it from the sidebar.
- [2025-09-17] Added back-navigation guard (`pageshow`) to refresh survey list after bfcache restore.
- [2025-09-18] Created `tools/` with a README and relocated automation helpers (`add_question_types.py`, `csv_to_json.*`, GitHub CLI scripts).
- [2025-09-18] Moved issue/PR templates into `docs/references/templates/` and updated automation scripts to consume canonical templates.
- [2025-09-18] Consolidated reference artefacts under `docs/requirements/resources/` (現 `docs/references/resources/`) and triaged temporary files into `archive/temp/`.
- [2025-10-27] Restructured `docs/` into `product/`, `handbook/`, `references/`, `changelog/`, `archive/`, and `ja/`; archived legacy form submissions under `docs/archive/forms/`.
- [2026-02-18] Standardized docs navigation and template ownership: canonical templates are in `docs/references/templates/`, while historical samples moved to `docs/templates/examples/`.
- [2026-02-18] Consolidated duplicate survey-answer specifications; canonical moved to `docs/product/specs/13_survey_answer_screen.md` and legacy file redirected.
- [2026-02-18] Migrated premium requirements to `docs/product/specs/premium/` and converted legacy `docs/requirements/premium_*` files into redirects.
- [2026-02-18] Consolidated first-login/performance requirements into canonical specs and converted legacy requirement files into redirects.
- [2026-02-18] Migrated help-center requirements to `docs/product/specs/15_help_center_requirements.md` and converted legacy requirement file into redirect.

## Objectives
- Consolidate duplicated source trees so the dashboard uses a single module set.
- Co-locate shared HTML partials, assets, and JSON fixtures to remove ambiguity.
- Separate product assets from temporary scripts, archives, and documentation for clarity.
- Establish phased work so refactors stay reviewable and verifiable in the browser.

## Current Pain Points
- `src/` replicates older versions of files that also exist in `02_dashboard/src/`; timestamps show the `02_dashboard` copies are newer and include additional modules (`graph-page.js`, `indexPage.js`, etc.).
- HTML fragments live in both `modals/` and `02_dashboard/modals/`, plus shared layout pieces under `02_dashboard/common/`; it is unclear which directory is authoritative.
- Mock data recently migrated to `data/`; audit for lingering hard-coded paths and ensure large dumps stay archived.
- [Follow-up 2025-10-27] Update internal references (README, specs, scripts) to the new `docs/product/` and `docs/handbook/` paths, and schedule UTF-8 re-encoding for legacy Japanese markdown.

## Canonical Directories (target)
- Dashboard app: keep everything under `02_dashboard/` (`index.html`, `src/`, `assets/`, `data/`).
- Login flow: keep under `01_login/`.
- Shared mock data: move to a unified `data/` tree with subfolders per feature (e.g., `data/`, `data/login/`).
- Documentation and non-runtime references: keep in `docs/product/` (specs/process/architecture), `docs/handbook/` (runbooks), `docs/references/` (templates/resources), `docs/changelog/` (logs), and isolate attachments under `docs/archive/`.
- Utilities & scripts: keep automation in `tools/` and use `docs/references/templates/` as the only Issue/PR template source.
- Archives or reference material: create `archive/` for ZIPs, legacy datasets, and `.bak` snapshots that we want to keep but not ship.

## Phase 1 - Source Of Truth Alignment
1. Confirm `02_dashboard/src/` modules match or supersede `src/`.
   - Diff representative pairs (`main.js`, `surveyCreation.js`, `utils.js`).
   - Copy over any missing functionality from `src/` if required, otherwise retire `src/`.
   - Remove stray backups (`tableManager.js.bak`) after verifying history.
2. Update HTML entry points (`02_dashboard/index.html`, others) to reference only the canonical `02_dashboard/src/` paths.
3. Communicate the change (docs update + release notes) so future work targets the canonical tree.

## Phase 2 - HTML Partials Consolidation
1. Create `02_dashboard/src/ui/modals/` (or reuse existing `02_dashboard/modals/`) as the single source.
2. Grep HTML pages for modal includes/imports to ensure paths update correctly.
3. Remove root-level `modals/` after verification in the browser.
4. Relocate shared layout components (`header.html`, `footer.html`, `sidebar.html`) under a clearly named folder (`02_dashboard/components/layout/`) if needed, updating fetch paths.

## Phase 3 - Data & Assets Cleanup
1. Classify JSON/CSV assets by feature (see docs/data-inventory.md for current mapping):
   - Surveys (`surveys.json`, `survey-answers.json`, etc.).
   - Business cards (`business-cards.json`).
   - Groups/users.
2. Move them under `data/<feature>/` and document consumers within the service modules.
3. Large archival CSV/XLSX files move to `archive/data-dumps/` with a README describing origin and usage.
4. Ensure `fetch` calls in services use the new structure; keep relative paths stable by introducing central constants in `utils.js` if necessary.

## Phase 4 - Tools, Templates, and Temp Files
1. Create `tools/` for automation scripts (`add_question_types.py`, `csv_to_json.*`). Add short README for usage.
2. Move issue/PR body markdown to `docs/references/templates/` and update any documentation references. **(Completed 2025-10-27)**
3. Gather temporary staging files (`temp/`, `temp_issue_body.txt`, `temp_review_comment.txt`) and either delete if obsolete or move to `archive/temp/`.
4. Relocate client-provided reference materials currently under `siryou/` and `06_other/` into `docs/references/resources/` (or `docs/archive/`) with descriptive filenames.

## Verification Checklist
- Browser smoke tests: load `/02_dashboard/index.html`, `/02_dashboard/bizcardSettings.html`, `/02_dashboard/surveyCreation.html`, ensuring no 404s or console errors.
- Confirm `python -m http.server` still serves both login and dashboard flows without broken paths.
- Run `rg` after each phase to catch stale imports (e.g., `rg "../src/" 02_dashboard -g"*.html"`).
- Update `docs/product/overview/00_PROJECT_OVERVIEW.md` and `docs/product/architecture/01_ARCHITECTURE.md` with the new structure once moves are complete.

## Open Questions / Decisions Needed
- Do we need to keep the legacy `src/` around for external dependencies? If yes, archive rather than delete.
- Which team maintains the large survey datasets? Determine retention policy before archiving.
- Are `.bak` files safe to drop once Git history is confirmed?

Track progress by converting the phases into issues or tasks, closing each once verified in the browser.


## Next Steps
- [2025-09-17] Run smoke tests on key dashboard pages to confirm new `/data/` fetch paths resolve (survey creation, speed review, graph page, invoice detail).
- [2025-09-17] Demo datasets moved to `docs/examples/demo_*` (surveys/answers/business-cards); document usage and adjust remaining references.
