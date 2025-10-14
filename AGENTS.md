# Repository Guidelines

## Project Structure & Module Organization
The site delivers static HTML entry points at `02_dashboard/index.html` and `01_login/login-top.html`. Place business logic modules in `02_dashboard/src/services/` or `src/services/`, keep DOM render helpers under `02_dashboard/src/ui/` and `src/ui/`, and share cross-cutting utilities through `src/utils.js`. Store mock datasets in `data/*.json` and review context and standards in `docs/README.md` before creating features.

## Build, Test, and Development Commands
- `python -m http.server 8000` - Serve the repository root and open `http://localhost:8000/02_dashboard/index.html` for dashboard work.
- `npx serve .` - Lightweight alternative; browse to `/02_dashboard` after launch.
There is no build pipeline, so refreshing the browser reflects changes immediately.

## Coding Style & Naming Conventions
Follow ES module syntax with 2-space indentation, trailing semicolons, and single quotes for strings. Use camelCase for functions and variables, PascalCase for classes, and lowerCamelCase filenames such as `tableManager.js`. Keep business logic isolated in `services/` modules and limit DOM manipulation to the `ui/` layer. Confirm any new patterns against `docs/design/02_CODING_STANDARDS.md`.

## Testing Guidelines
Automated tests are not yet in place; perform manual verification in Chromium or Firefox. Ensure data flows correctly from `data/*.json` through services into the rendered UI and keep the browser console free of errors. Consult `docs/03_TESTING_GUIDELINES.md` for required manual coverage checklists.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, etc.) with concise subjects. Summarize key changes in bullet form within the body and reference related issues with `Closes #123` when applicable. Pull requests should list affected paths (e.g., `02_dashboard/src/ui/...`), include screenshots for visual updates, and document the manual tests performed.

## Security & Configuration Tips
Never commit secrets; treat `data/*.json` as mock-only fixtures. Keep production endpoints configurable as described in `docs/01_ARCHITECTURE.md`, and document any new third-party dependency justifications in your pull request summary.
