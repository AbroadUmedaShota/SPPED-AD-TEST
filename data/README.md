# Data Directory Overview

- `core/` - shared lookups used across pages (surveys, groups, users, invoices).
- `surveys/` - survey definitions and metadata (including `enquete/`).
- `responses/` - per-survey responses and business card data.
- `docs/examples/demo_surveys/` - sample survey payloads for charts and demo screens (moved from `data/demo_surveys/`).
- `docs/examples/demo_answers/` - answer datasets paired with demo surveys (moved from `data/demo_answers/`).
- `docs/examples/demo_business-cards/` - persona business-card data linked to demo answers (moved from `data/demo_business-cards/`).

Large archival dumps live in `archive/data-dumps/` to keep runtime assets light.
