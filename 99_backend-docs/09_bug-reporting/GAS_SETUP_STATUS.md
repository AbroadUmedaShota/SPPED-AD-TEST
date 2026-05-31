# GAS Setup Status

## Created

- Title: `SPEED AD バグ報告DB`
- Script URL: `https://script.google.com/d/1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb/edit`
- Script ID: `1T8nXB2MQJJkrRIAXR23m33wzabRWw-a83k51IVGBVab1JUlW-4tArxqb`
- Latest deployment: `AKfycbwH6W53pKOWzy39gCZhx9N5t3IjP6pSL35U3bX2SrvYU2GLAlr-U4b1X4czExeEWYhUng`

## Blocked

Google OAuth / Workspace policy blocked the final authorization step.

Observed errors:

- `invalid_grant` / `invalid_rapt` during initial `clasp create`.
- Web App GET returned Google Drive access denied before runtime authorization.
- `clasp run initializeDefectDb` returned permission denied.

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

Run from this folder:

```powershell
npx --yes @google/clasp login --use-project-scopes --include-clasp-scopes
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy --description "bug reporting db web app"
npx --yes @google/clasp run initializeDefectDb
```

Then set the Web App URL in `reports.html`.
