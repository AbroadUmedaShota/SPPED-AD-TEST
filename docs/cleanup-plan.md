# Repository Cleanup Plan

## Current Status
- [2025-09-17] Archived legacy `src/` tree under `archive/legacy-src/` and relocated `tableManager.js.bak` out of `02_dashboard/src/`.
- [2025-09-17] Consolidated modal HTML by moving legacy `modals/` into `archive/legacy-modals/` alongside the active `02_dashboard/modals/` source.
- [2025-09-17] Migrated dashboard data fixtures into `data/dashboard/` (core/responses/surveys/demos) and moved large dumps to `archive/data-dumps/`.
- [2025-09-17] Manual smoke test: index/surveyCreation/speed-review/invoice pages load with `/data/dashboard/` paths, no console errors observed.
- [2025-09-17] Survey list actions now expose SPEED Review and analytics demo shortcuts.
- [2025-09-17] Moved group-edit demo under `02_dashboard/group-edit/` and linked it from the sidebar.
- [2025-09-17] Added back-navigation guard (`pageshow`) to refresh survey list after bfcache restore.

## Objectives
- Consolidate duplicated source trees so the dashboard uses a single module set.
- Co-locate shared HTML partials, assets, and JSON fixtures to remove ambiguity.
- Separate product assets from temporary scripts, archives, and documentation for clarity.
- Establish phased work so refactors stay reviewable and verifiable in the browser.

## Current Pain Points
- `src/` replicates older versions of files that also exist in `02_dashboard/src/`; timestamps show the `02_dashboard` copies are newer and include additional modules (`graph-page.js`, `indexPage.js`, etc.).
- HTML fragments live in both `modals/` and `02_dashboard/modals/`, plus shared layout pieces under `02_dashboard/common/`; it is unclear which directory is authoritative.
- Mock data recently migrated to `data/dashboard/`; audit for lingering hard-coded paths and ensure large dumps stay archived.
- Project root contains helper scripts (`add_question_types.py`, `csv_to_json.*`), temp issue templates, and archives (`siryou/`, `06_other/`, `temp/`) alongside application code.

## Canonical Directories (target)
- Dashboard app: keep everything under `02_dashboard/` (`index.html`, `src/`, `assets/`, `data/`).
- Login flow: keep under `01_login/`.
- Shared mock data: move to a unified `data/` tree with subfolders per feature (e.g., `data/dashboard/`, `data/login/`).
- Documentation and non-runtime references: keep in `docs/` with subfolders for architecture, specs, and imported resources.
- Utilities & scripts: create `tools/` (Python/PowerShell) and `templates/` (issue/pr bodies) to keep automation separate from app code.
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
2. Move them under `data/dashboard/<feature>/` and document consumers within the service modules.
3. Large archival CSV/XLSX files move to `archive/data-dumps/` with a README describing origin and usage.
4. Ensure `fetch` calls in services use the new structure; keep relative paths stable by introducing central constants in `utils.js` if necessary.

## Phase 4 - Tools, Templates, and Temp Files
1. Create `tools/` for automation scripts (`add_question_types.py`, `csv_to_json.*`). Add short README for usage.
2. Move issue/PR body markdown to `docs/templates/` (or similar) and update any documentation references.
3. Gather temporary staging files (`temp/`, `temp_issue_body.txt`, `temp_review_comment.txt`) and either delete if obsolete or move to `archive/temp/`.
4. Relocate client-provided reference materials currently under `siryou/` and `06_other/` into `docs/resources/` (or `archive/`) with descriptive filenames.

## Verification Checklist
- Browser smoke tests: load `/02_dashboard/index.html`, `/02_dashboard/bizcardSettings.html`, `/02_dashboard/surveyCreation.html`, ensuring no 404s or console errors.
- Confirm `python -m http.server` still serves both login and dashboard flows without broken paths.
- Run `rg` after each phase to catch stale imports (e.g., `rg "../src/" 02_dashboard -g"*.html"`).
- Update `docs/00_PROJECT_OVERVIEW.md` and `docs/01_ARCHITECTURE.md` with the new structure once moves are complete.

## Open Questions / Decisions Needed
- Do we need to keep the legacy `src/` around for external dependencies? If yes, archive rather than delete.
- Which team maintains the large survey datasets? Determine retention policy before archiving.
- Are `.bak` files safe to drop once Git history is confirmed?

Track progress by converting the phases into issues or tasks, closing each once verified in the browser.


## Next Steps
- [2025-09-17] Run smoke tests on key dashboard pages to confirm new `/data/dashboard/` fetch paths resolve (survey creation, speed review, graph page, invoice detail).
- [2025-09-17] Decide final home for demo datasets (`data/dashboard/demos/`) and document expected usage.

