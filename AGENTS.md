# Repository Guidelines

## Project Structure & Module Organization
- Entry points: `02_dashboard/index.html`, `01_login/login-top.html`.
- Source (ES modules): `02_dashboard/src/`, `src/`.
- Services: `.../src/services/` (e.g., `invoiceService.js`, `surveyService.js`).
- UI renderers: `.../src/ui/` (e.g., `invoiceRenderer.js`, `surveyRenderer.js`).
- Shared helpers: `utils.js`. Data fixtures: `data/dashboard/**/*.json` (legacy duplicates live under `archive/`). Docs: `docs/` (start with `docs/README.md`).

## Build, Test, and Development Commands
- Static site; no build step.
- Serve with Python: `python -m http.server 8000` then open `http://localhost:8000/02_dashboard/index.html`.
- Or Node: `npx serve .` then navigate to `/02_dashboard`.
- Validate while developing: keep console clean and verify mock data flows from `data/*.json`.

## Coding Style & Naming Conventions
- JavaScript: ES modules, 2-space indent, semicolons, single quotes.
- Names: camelCase for variables/functions; PascalCase for classes.
- Files: JS in lowerCamelCase (e.g., `tableManager.js`); HTML descriptive (e.g., `invoice-detail.html`, `bizcardSettings.html`).
- Folder roles: business logic in `services/`, DOM/renderers in `ui/`, shared helpers in `utils.js`.
- Avoid framework dependencies; prefer small, composable functions.
- Follow `docs/02_CODING_STANDARDS.md`.

## Testing Guidelines
- No automated tests yet. Validate manually:
  - Load pages without console errors (Chromium/Firefox).
  - Check data flows using `data/*.json`.
  - Exercise interactive components for sanity.
- See `docs/03_TESTING_GUIDELINES.md` for evolving policy.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Keep subjects concise; add bullet points for key changes; link issues (e.g., `Closes #123`).
- PRs must include: clear description, affected paths (e.g., `02_dashboard/src/ui/...`), screenshots for UI changes, and manual test notes.

## Security & Configuration Tips
- Do not commit secrets; `data/*.json` is mock-only.
- Production endpoints must be configurable (see `docs/01_ARCHITECTURE.md`).
- Justify any third‑party libs in PRs and scope them narrowly.

## Agent-Specific Instructions
- Scope: this file applies to the entire repo; deeper `AGENTS.md` files override locally.
- Respect structure and naming; keep changes minimal and focused.
- Do not introduce unrelated refactors or dependencies.

