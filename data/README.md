# Data Directory Overview

- `core/` – shared lookups used across pages (surveys, groups, users, invoices).
- `surveys/` – survey definitions and metadata (including `enquete/`).
- `responses/` – per-survey responses and business card data.
- `demo_surveys/` – sample survey payloads for charts and demo screens.
- `demo_answers/` – answer datasets paired with demo surveys.
- `demo_business-cards/` – persona business-card data linked to demo answers.

Large archival dumps live in `archive/data-dumps/` to keep runtime assets light.
