# Valtireo

Valtireo is a configurable Organizational OS by Leading Digitals. The current MVP is focused on HR, people operations, documents, approvals, leave, attendance, reports, notifications, and audit-ready workflows.

## Repository Layout

```text
valtireo/
  client/   # Frontend application lives here
  server/   # Laravel API backend
  docs/     # Shared product, API, Postman, and frontend handoff docs
  work/     # Local/reference research artifacts
```

## Backend

The Laravel API is now inside `server/`.

Common local commands:

```bash
cd server
composer install
php artisan migrate --seed
php artisan serve
php artisan test
```

Local API base URL:

```text
http://127.0.0.1:8000/api
```

Default local admin:

```json
{
  "email": "admin@valtireo.test",
  "password": "Password1!"
}
```

## Frontend

The frontend should be created inside `client/`. The recommended implementation order and product/API context are documented in:

- `docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`
- `docs/postman/README.md`

## Postman

Share these files with the frontend developer:

- `docs/postman/valtireo-api.postman_collection.json`
- `docs/postman/valtireo-local.postman_environment.json`
- `docs/postman/README.md`

## Product and Design Context

Key docs:

- `docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`
- `docs/valtireo-brand-product-design-foundation-v1.md`
- `docs/valtireo-product-mvp-status-2026-08-06.md`
- `docs/project-context.md`

