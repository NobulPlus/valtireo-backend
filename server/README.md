# Valtireo Server

Laravel API backend for the Valtireo Organizational OS MVP.

## Stack

- Laravel API
- MySQL
- Laravel Sanctum token authentication
- Spatie Laravel Permission with organization/team scoping
- owen-it/laravel-auditing
- Database-backed queue/cache/session tables for local MVP development

## Getting Started

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
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

## Testing

```bash
php artisan test
```

Focused examples:

```bash
php artisan test --filter=AuthenticationTest
php artisan test --filter=EmployeeOnboardingTest
php artisan test --filter=DocumentComplianceTest
php artisan test --filter=LeaveModuleTest
php artisan test --filter=AttendanceModuleTest
php artisan test --filter=MultiTenancyIsolationTest
```

## Implemented API Areas

- Health check
- Auth/session bootstrap
- Platform dashboard, organization provisioning, organization status/modules/workspace management
- Workspace settings, logo, localization, theme, and setup checklist
- Dashboards: organization, manager, employee
- Setup lookups: departments, units, designations, grade levels, employment types, locations, assignable roles
- Roles and permissions
- Employees, onboarding, invitations, profile update, profile overview, export
- Employee emergency contacts, dependents, custom fields, custom field values, lifecycle history, reporting history, activities
- Documents, document types, document requirements, uploads/downloads/views, reviews, compliance
- Approval workflows and approval requests
- Leave types, periods, holidays, entitlements, requests, cancellation
- Attendance settings, shifts, records, correction requests
- Templates: list, download, preview, import, failed rows
- Reports and CSV exports
- Notifications and unread count
- Audit logs and activity feed

## Architecture Notes

- Every organization-owned model must be scoped by `organization_id`.
- Authorization should use permissions, not hardcoded role checks.
- Platform routes are for product Super Admin operations across customer organizations.
- Organization suspension blocks login/session bootstrap and revokes organization user tokens.
- Employee-facing self-service endpoints must only expose the authenticated employee's own data unless a permission explicitly allows broader access.
- Document, leave, and attendance decisions use the shared approval/action foundation where applicable.
- Historical data should generally be deactivated or superseded rather than hard-deleted.

## Current Work In Progress

Uncommitted work currently includes:

- onboarding approval payload requiring a starting status: `active`, `probation`, or `confirmed`
- `probation_ends_at` validation for probation onboarding approval
- onboarding approval status history/activity recording
- leave type `default_days_per_year`
- leave type `auto_grant_on_activation`
- bulk leave entitlement grants
- automatic entitlement provisioning when employees become active/probation/confirmed

Run `git status --short` before editing these areas.

## Useful Commands

```bash
php artisan route:list
php artisan migrate:fresh --seed
php artisan valtireo:send-reminders
```

## Related Docs

- `../docs/project-context.md`
- `../docs/postman/README.md`
- `../docs/valtireo-product-mvp-status-2026-08-06.md`
- `../docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`
