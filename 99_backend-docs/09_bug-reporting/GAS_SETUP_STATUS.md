# GAS Setup Status

## Created

- Title: `SPEED AD バグ報告DB`
- Script URL: `https://script.google.com/d/1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb/edit`
- Script ID: `1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb`
- Latest dedicated deployment: `AKfycbwn_0ROYUKCZ5ptrvSsGSIEcNRnShbGaZiINRJbb0c487G005vLlGkpA2TKP0FeHFEC5Q`

## Current Workaround

Existing E2E scenario GAS works and has already been authorized as a Web App. The working E2E GAS has been extended with the bug-reporting resources and actions, while preserving the existing scenario APIs.

- Shared Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`
- Shared Spreadsheet ID: `16aPp9PVFlkfBhhirmP0nG7P09oImGXhrSTrraLLYK9M`
- Added tabs: `defect_cases`, `defect_observations`, `defect_evidence`, `triage_events`

This is a temporary backend until a dedicated spreadsheet or dedicated Apps Script Web App can be authorized.

## Verified

- `GET ?resource=scenarios` returns existing E2E scenario data from the shared deployment.
- `GET ?resource=defect_cases` returns bug-reporting case rows from the shared deployment.
- `POST appendObservation` succeeded with smoke observation `OBS-SMOKE-20260531181809`.
- `POST promoteObservationToCase` succeeded with smoke case `BUG-SMOKE-20260531181809`.

## Blocked Items

Google OAuth / Workspace policy blocked the dedicated spreadsheet creation/final authorization path.

Observed errors:

- `invalid_grant` / `invalid_rapt` during initial `clasp create`.
- Web App GET returned Google Drive access denied before runtime authorization.
- `clasp run initializeDefectDb` returned permission denied.
- Direct Sheets API creation returned `SERVICE_DISABLED` for the Google-provided OAuth project.

## Local Fallback

`reports.html` now works without GAS by using browser localStorage as the temporary DB.

Use it for:

- human observations
- AI observations
- representative defect cases
- duplicate merges
- Backlog body generation
- JSON export

## Resume Steps After Admin Unblocks OAuth

Run from `99_backend-docs/09_bug-reporting/gas`:

```powershell
npx --yes @google/clasp login --use-project-scopes --include-clasp-scopes
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy --description "bug reporting db web app"
npx --yes @google/clasp run initializeDefectDb
```

Then set the Web App URL in `reports.html`.
