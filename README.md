# Valtireo

Valtireo is a configurable Organizational OS by Leading Digitals. The current MVP focuses on HR operations, people records, documents, approvals, leave, attendance, reports, notifications, audit trails, workspace customization, and platform-led organization management.

## Repository Layout

```text
valtireo/
  client/   # React + TypeScript frontend
  server/   # Laravel API backend
  docs/     # Product, design, Postman, and handoff docs
  work/     # Local/reference research artifacts
```

## Product Shape

Valtireo is not intended to be a generic HRMS clone. HR is the first entry point, but the larger direction is an audit-ready operating layer for organizations:

- organization provisioning and workspace ownership
- people, roles, permissions, and organization structure
- employee lifecycle and self-service
- document compliance and expiry tracking
- configurable approval workflows
- leave and attendance operations
- reports, notifications, and audit/activity visibility
- organization-owned theme, terminology, policies, fields, and setup controls

## Backend

The Laravel API lives in `server/`.

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

```text
email: admin@valtireo.test
password: Password1!
```

## Frontend

The React application lives in `client/`.

```bash
cd client
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://127.0.0.1:8000`.

## Current Feature Surface

Implemented areas include:

- Auth/session bootstrap with module entitlements
- Platform console and organization provisioning
- Workspace settings, branding, localization, and setup checklist
- Roles, permissions, custom fields, and organization structure controls
- Employee directory, creation, profile, onboarding, approval, status, reporting, documents, and activity
- Employee self-service: profile, leave, attendance
- Organization, manager, and personal dashboards
- Documents and compliance
- Approval workflows and approval requests
- Leave types, periods, holidays, entitlements, requests, and balances
- Attendance settings, shifts, records, and correction requests
- Reports and CSV exports
- Notifications
- Audit logs and activity feed
- Import templates

## Work In Progress

There are active uncommitted changes around:

- onboarding approval starting stage: active, probation, or confirmed
- probation end date capture during onboarding approval
- leave type defaults and auto-grant on employee activation
- bulk leave entitlement grants

Check `git status --short` before editing or committing.

## Postman

Postman assets live in:

- `docs/postman/valtireo-api.postman_collection.json`
- `docs/postman/valtireo-local.postman_environment.json`
- `docs/postman/README.md`

## Key Docs

- `docs/project-context.md`
- `docs/valtireo-product-mvp-status-2026-08-06.md`
- `docs/valtireo-frontend-design-system.md`
- `docs/valtireo-brand-product-design-foundation-v1.md`
- `docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`
