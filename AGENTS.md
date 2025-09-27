# Repository Guidelines

## Project Structure & Module Organization
The site serves static HTML with primary entry points at `02_dashboard/index.html` and `01_login/login-top.html`. JavaScript modules live in `02_dashboard/src/` and `src/`, with business logic under `services/` (for example `invoiceService.js`) and UI render helpers in `ui/` (such as `surveyRenderer.js`). Share cross-cutting utilities through `utils.js`, store fixtures in `data/*.json`, and keep reference material in `docs/` starting with `docs/README.md`. Preserve this layout when adding features to keep imports predictable.

## Build, Test, and Development Commands
- `python -m http.server 8000` - serve the workspace root and browse to `http://localhost:8000/02_dashboard/index.html`.
- `npx serve .` - alternative lightweight server; open `/02_dashboard` once running. No build step exists, so changes should appear immediately after refresh.

## Coding Style & Naming Conventions
Follow ES module syntax with 2-space indentation, semicolons, and single quotes. Use camelCase for variables and functions, PascalCase only for classes, and lowerCamelCase file names like `tableManager.js`. Keep business logic in `services/`, DOM work in `ui/`, and avoid frameworks in favor of small composable functions. Consult `docs/02_CODING_STANDARDS.md` before adding new patterns.

## Testing Guidelines
Automated tests are not yet in place. Validate manually in Chromium or Firefox, ensuring the console stays clean and data flows correctly from `data/*.json`. Exercise interactive widgets end-to-end and note any gaps. Refer to `docs/03_TESTING_GUIDELINES.md` when planning manual coverage.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). Keep subjects concise, add bullet highlights in the body, and link issues (for example `Closes #123`). Pull requests should outline affected paths such as `02_dashboard/src/ui/...`, include screenshots for visual changes, and document manual test steps.

## Security & Configuration Tips
Do not commit secrets; `data/*.json` contains mock data only. Keep production endpoints configurable as described in `docs/01_ARCHITECTURE.md`, and justify any third-party dependency additions in your pull request summary.

## Agent-Specific Instructions
- **Communication Language:** All interactions with the user, including CLI prompts and content generated on GitHub (Issues, Pull Requests, comments), must be conducted in **Japanese**.
- Respect existing file roles and avoid unrelated refactors or dependency changes.
- Preserve ASCII unless a file already relies on other encodings.
- If unexpected repository changes appear, pause and confirm the desired resolution with the maintainer before proceeding.
