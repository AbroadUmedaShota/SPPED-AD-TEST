# Repository Guidelines

## Project Structure & Module Organization
- Entry points: `02_dashboard/index.html`, `01_login/login-top.html`.
- Source code: ES modules in `02_dashboard/src/` and `src/`.
  - Services: `.../src/services/` (e.g., `invoiceService.js`, `surveyService.js`).
  - UI renderers: `.../src/ui/` (e.g., `invoiceRenderer.js`, `surveyRenderer.js`).
- Data fixtures: `data/*.json` (no secrets; mock data only).
- Docs: `docs/` (architecture, standards, testing). Start with `docs/README.md`.

## Build, Test, and Development Commands
- No build step; static HTML/JS/CSS.
- Serve locally (any static server):
  - Python: `python -m http.server 8000` then open `http://localhost:8000/02_dashboard/index.html`.
  - Node (optional): `npx serve .` then navigate to `/02_dashboard`.
- Lint/format: follow Coding Style below and `docs/02_CODING_STANDARDS.md`.

## Coding Style & Naming Conventions
- JavaScript: ES modules, 2‑space indent, semicolons, single quotes, camelCase for variables/functions; PascalCase for classes.
- Files: JS in lowerCamelCase (e.g., `tableManager.js`); HTML descriptive (e.g., `invoice-detail.html`, `bizcardSettings.html`).
- Folder roles: keep logic in `services/`, DOM/renderers in `ui/`, shared helpers in `utils.js`.
- Avoid framework dependencies; prefer small, composable functions.

## Testing Guidelines
- No formal automated tests yet. Validate by:
  - Loading pages without console errors.
  - Verifying data flows with `data/*.json`.
  - Cross‑browser sanity (Chromium/Firefox) for interactive components.
- See `docs/03_TESTING_GUIDELINES.md` for evolving policy.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Keep subject concise; add bullet points for key changes.
- Link issues: `Closes #123`.
- PRs must include: clear description, affected paths (e.g., `02_dashboard/src/ui/...`), screenshots for UI changes, and manual test notes.
- Prefer small, scoped PRs aligned to a single feature or fix.

## Security & Configuration Tips
- Do not commit secrets; keep credentials out of source and `data/`.
- Treat `data/*.json` as mock data only; production endpoints must be configurable (see `docs/01_ARCHITECTURE.md`).
- When adding third‑party libs, justify in PR and keep them scoped.

