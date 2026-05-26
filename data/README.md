# Data Directory Overview

- `core/` - shared lookups used across pages (surveys, groups, users, invoices).
- `surveys/` - survey definitions and metadata (including `enquete/`).
- `responses/` - per-survey responses and business card data.
- `demo/demo_surveys/` - sample survey payloads for charts and demo screens.
- `demo/demo_answers/` - answer datasets paired with demo surveys.
- `demo/demo_business-cards/` - persona business-card data linked to demo answers.
- `news.json` - mock public-news feed for the login-front page; production source is expected to move to `support.speed-ad.com/news.json`.

Large archival dumps live in `アーカイブ/data-dumps/` to keep runtime assets light.
