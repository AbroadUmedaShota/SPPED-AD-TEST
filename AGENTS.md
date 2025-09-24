# Repository Guidelines

## Project Structure & Module Organization
- Entry points `01_login/login-top.html` and `02_dashboard/index.html` load ES modules from `02_dashboard/src/` and shared `src/`.
- Business logic stays in `src/services/` (e.g., `invoiceService.js`); UI-only DOM work belongs in `src/ui/`; shared helpers live in `utils.js`.
- Mock datasets are under `data/`; legacy references in `archive/` should not be edited unless you are migrating data.
- Docs start at `docs/README.md`; review them before broad refactors or adding modules.

## Build, Test, and Development Commands
- Serve locally with `python -m http.server 8000` (root directory) then hit `http://localhost:8000/02_dashboard/index.html`.
- Alternative: `npx serve .` and browse to `/02_dashboard`; stop the server with `Ctrl+C`.
- Keep the browser console open; every change must load without errors and pull from the JSON fixtures.

## Coding Style & Naming Conventions
- JavaScript uses ES modules, 2-space indentation, semicolons, and single quotes; prefer small, composable functions.
- Name files lowerCamelCase (`tableManager.js`), components camelCase, and classes PascalCase.
- Do not add frameworks; rely on vanilla DOM APIs and helpers in `utils.js`.
- Follow `docs/02_CODING_STANDARDS.md` when in doubt.

## Testing Guidelines
- No automated suite yet; manually test in Chromium or Firefox.
- After changes, reload both login and dashboard flows, verify network requests hit the mock `data/*.json`, and interact with widgets to confirm rendering.
- Record manual verification steps in pull requests.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`); keep subjects short and imperative.
- Pull requests must summarize affected paths, link issues (e.g., `Closes #123`), and attach screenshots for UI updates.
- Include manual test notes describing browsers used and data scenarios covered.

## Security & Configuration Tips
- Never commit secrets; JSON fixtures are mock-only.
- Production endpoints must remain configurable; consult `docs/01_ARCHITECTURE.md` before hardcoding URLs.
- Justify any third-party dependencies and scope them to the smallest surface area.