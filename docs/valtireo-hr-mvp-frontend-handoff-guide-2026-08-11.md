# Valtireo HR MVP Frontend Handoff Guide

Last updated: 2026-08-11

## 1. Purpose

This guide is the frontend handoff document for the Valtireo HR MVP. It consolidates the product direction, brand and product design foundation, completed backend capabilities, API integration workflow, implementation priorities, and remaining MVP polish items.

The goal is to help the frontend team begin implementation, API integration, and final HR MVP completion without having to piece together context from separate planning notes.

Use this guide alongside:

- `docs/postman/valtireo-api.postman_collection.json`
- `docs/postman/valtireo-local.postman_environment.json`
- `docs/postman/README.md`
- `docs/valtireo-brand-product-design-foundation-v1.md`
- `docs/valtireo-product-mvp-status-2026-08-06.md`

Repository layout:

```text
valtireo/
  client/   # Frontend application
  server/   # Laravel API backend
  docs/     # Shared product, API, Postman, and handoff docs
```

## 2. Product Summary

Valtireo is a configurable Organizational OS by Leading Digitals. HR is the first product entry point, but the long-term product is broader than a traditional HRMS.

Recommended positioning:

> Valtireo is the Organizational OS for modern institutions and growing teams.

Product promise:

> Structure your people, workflows, approvals, documents, and internal services in one connected platform.

The first HR MVP should prove that an organization can manage:

- Workspace and organization setup
- Users, roles, permissions, and module access
- Departments, units, designations, grade levels, employment types, and locations
- Employee records and onboarding
- Employee self-service profile completion
- Documents, requirements, compliance, expiries, and reviews
- Shared approvals across documents, leave, and attendance corrections
- Leave setup, entitlements, requests, balances, and approvals
- Attendance settings, shifts, records, correction requests, and approvals
- Dashboards, reports, imports, notifications, audit logs, and activity feeds

Valtireo should not feel like a generic HRMS clone. The differentiator is the operating layer: every person, document, request, approval, report, and important change has a place, owner, status, and trail.

## 3. MVP Scope

### In Scope

The frontend MVP should focus on the completed backend modules:

- Auth/session bootstrap
- Workspace settings and setup checklist
- Organization dashboard, manager dashboard, and employee dashboard
- Setup lookups for structure data
- Employee list, create employee, employee detail, onboarding approval, and profile overview
- Employee self-service profile, contacts, dependents, custom fields, and activity
- Documents, document types, requirements, compliance, document submissions, and reviews
- Approval workflows and approval queue/actions
- Leave setup, entitlements, requests, cancellation, and approval flow
- Attendance settings, shifts, records, corrections, and approval flow
- Templates and CSV imports
- Reports and CSV exports
- Notifications
- Audit logs and activity feed

### Out of Scope for First HR MVP

Keep these post-MVP unless a customer requirement changes the priority:

- Payroll
- Recruitment/ATS
- Performance appraisals
- Learning management
- Full service desk
- Claims, loans, imprest, budgets, and finance/admin workflows
- Full workflow builder
- Full form builder
- Complex rule engine
- SSO/LDAP/SAML
- Mobile app
- AI assistant
- Operational OS modules such as inventory, procurement, fleet, facilities, warehouse, logistics, vendors, and field operations

## 4. Backend Architecture

The current build is backend-first and frontend-agnostic.

- Backend: Laravel API
- Backend path: `server/`
- Frontend path: `client/`
- PHP: `^8.3`
- Laravel: `^13.8`
- Auth: Laravel Sanctum bearer tokens
- Roles and permissions: Spatie Laravel Permission
- Audit logs: owen-it/laravel-auditing
- Database: MySQL locally
- API base URL for local testing: `http://127.0.0.1:8000/api`
- Postman collection: `docs/postman/valtireo-api.postman_collection.json`
- Postman environment: `docs/postman/valtireo-local.postman_environment.json`

Most endpoints require:

```text
Authorization: Bearer {{auth_token}}
Accept: application/json
Content-Type: application/json
```

File preview/import endpoints use `multipart/form-data`.

Run backend commands from `server/`:

```bash
cd server
php artisan serve
php artisan test
```

## 5. Local Login and Session Bootstrap

Default local seed user:

```json
{
  "email": "admin@valtireo.test",
  "password": "Password1!"
}
```

Start integration with:

1. `GET /api/health`
2. `POST /api/auth/login`
3. Store the returned token.
4. Call `GET /api/auth/me` after app refresh.

The login and `/auth/me` responses are important because they return the user session context needed to render the frontend:

- user
- organization
- roles
- permissions
- entitled modules
- workspace settings

Frontend should treat this response as the application bootstrap payload. It should drive navigation visibility, permission checks, module access, organization branding, dashboard routing, and available actions.

## 6. Roles and Permissions

Seeded roles:

- Super Admin
- Organization Admin
- HR Director
- HR Officer
- Compliance Officer
- ICT Admin
- Department Head
- Supervisor
- Employee

Frontend should not hardcode access by role alone. Use the `permissions` and `modules` returned by login/session where possible.

Important permission groups:

- `workspace_settings.view`, `workspace_settings.update`
- `employees.view`, `employees.create`, `employees.update`, `employees.delete`
- `employee_documents.view`, `employee_documents.create`, `employee_documents.update`, `employee_documents.delete`
- `approval_workflows.view`, `approval_workflows.create`, `approval_workflows.update`
- `approvals.view`, `approvals.action`
- `leave_requests.view`, `leave_requests.create`, `leave_requests.approve`, `leave_requests.cancel`
- `attendance.view`, `attendance.create`, `attendance.update`, `attendance.correct`
- `reports.view`
- `audit_logs.view`

Recommended FE rule:

- Hide navigation when the module is unavailable.
- Hide primary actions when the user lacks permission.
- Still handle `403` gracefully because backend remains the source of truth.

## 7. Brand and Product Design Direction

Valtireo should feel:

- Structured
- Calm
- Trustworthy
- Practical
- Audit-ready
- Configurable
- Suitable for government, enterprise, NGO, healthcare, education, and growing private organizations

Avoid:

- Flashy startup SaaS language
- Playful consumer app patterns
- Heavy gradients
- Decorative dashboards
- Oversized marketing-style cards inside the app
- Generic HRMS visuals

### Visual Foundation

Recommended palette:

- Valtireo Pine: `#123F3A`
- Valtireo Teal: `#2F8F8A`
- Valtireo Blue: `#244F7A`
- Valtireo Ink: `#111827`
- Canvas: `#F7FAF9`
- Surface: `#FFFFFF`
- Soft Surface: `#EEF5F4`
- Border: `#D7E2E0`
- Muted Text: `#667085`
- Strong Text: `#101828`
- Success: `#168A5B`
- Warning: `#C47A00`
- Danger: `#C2413D`
- Info: `#2563A8`
- Pending: `#8A6D1F`
- Draft: `#667085`

Recommended typography:

- Product UI: Inter or Instrument Sans
- Brand/display: Manrope

### Product Shell

Recommended layout:

- Left sidebar for modules
- Topbar for organization context, search, notifications, quick actions, and profile
- Content header with title, breadcrumbs, status, and primary action
- Optional right-side drawer for activity, comments, approval history, or future AI support

Suggested sidebar groups:

- Core
- People
- Workflows
- Documents
- Time
- Reports
- Governance
- Settings

### Core UX Principle

Every screen should quickly answer:

- What is this?
- Who owns it?
- What is the status?
- What action is needed?
- What changed recently?

## 8. Recommended Frontend Implementation Order

Build in this order to reduce integration friction:

1. Auth shell and session bootstrap
2. App shell, navigation, permissions, modules, workspace theme
3. Workspace and setup checklist
4. Setup lookups and shared selectors
5. Dashboards
6. Employee directory and employee creation
7. Employee detail and profile overview
8. Employee self-service screens
9. Documents and compliance
10. Approval queue and approval actions
11. Leave setup and leave requests
12. Attendance settings, shifts, records, and corrections
13. Templates/imports
14. Reports/exports
15. Notifications
16. Audit logs and activity feed

This sequence follows the backend dependencies. For example, leave and attendance screens need employees and setup lookups; approval actions become useful after documents, leave, and attendance corrections are visible.

## 9. API Workflow by Module

### Health

- `GET /health`

Use this for local connectivity checks.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

Frontend flow:

1. Login with email/password.
2. Store bearer token.
3. Use `/auth/me` on reload.
4. Clear token on logout or `401`.

### Platform Provisioning

- `POST /platform/organizations`

This is restricted to Super Admin. It creates a customer organization, default Main Office location, workspace settings, module subscriptions, and first Organization Admin user.

Frontend note: this is likely an internal/admin screen, not part of the regular customer workspace.

### Workspace and Setup

- `GET /workspace`
- `PATCH /workspace/settings`
- `GET /setup/checklist`
- `GET /setup/lookups`
- `GET /setup/departments`
- `GET /setup/units`
- `GET /setup/designations`
- `GET /setup/grade-levels`
- `GET /setup/employment-types`
- `GET /setup/locations`

Frontend usage:

- Use workspace settings for organization identity, theme, localization, and employee experience settings.
- Use setup checklist to guide onboarding for Organization Admin/HR Director.
- Use lookup endpoints for form dropdowns and filters.

### Dashboards

- `GET /dashboard/organization`
- `GET /dashboard/manager`
- `GET /dashboard/me`

Recommended dashboard routing:

- Organization Admin, HR Director, HR Officer: organization dashboard
- Department Head, Supervisor: manager dashboard
- Employee: personal dashboard

Use permissions and backend response availability rather than role names only.

### Employees

- `GET /employees`
- `GET /employees/export`
- `POST /employees`
- `GET /employees/{employee}`
- `PATCH /employees/{employee}/approve-onboarding`
- `PATCH /me/employee-profile`
- `POST /employee-invitations/{token}/accept`
- `GET /employees/{employee}/profile-overview`
- `GET /employees/{employee}/profile-activities`
- `GET /employees/{employee}/custom-field-values`
- `PUT /employees/{employee}/custom-field-values`
- `GET /employees/{employee}/status-history`
- `POST /employees/{employee}/status-history`
- `GET /employees/{employee}/reporting-history`
- `POST /employees/{employee}/reporting-history`

Employee list supports search, status filters, profile status filters, structure filters, reporting manager filters, date ranges, sorting, and pagination.

Recommended screens:

- Employee directory table
- Create employee drawer/page
- Employee profile page
- Onboarding review/approval action
- Employment history tab
- Reporting history tab
- Documents tab
- Leave tab
- Attendance tab
- Activity tab

### Employee Self-Service

- `GET /employee-profile/overview`
- `GET /employee-profile/activities`
- `GET /employee-profile/custom-fields`
- `POST /employee-profile/custom-fields`
- `GET /employee-profile/custom-fields/{customField}`
- `PATCH /employee-profile/custom-fields/{customField}`
- `GET /employee-profile/custom-field-values`
- `PUT /employee-profile/custom-field-values`
- `GET /employee-profile/emergency-contacts`
- `POST /employee-profile/emergency-contacts`
- `PATCH /employee-profile/emergency-contacts/{emergencyContact}`
- `DELETE /employee-profile/emergency-contacts/{emergencyContact}`
- `GET /employee-profile/dependents`
- `POST /employee-profile/dependents`
- `PATCH /employee-profile/dependents/{dependent}`
- `DELETE /employee-profile/dependents/{dependent}`

Frontend note: the `employee-profile` route group is for the logged-in employee's own profile. The `/employees/{employee}/...` route group is for HR/admin working on another employee.

### Documents and Compliance

- `GET /documents/types`
- `POST /documents/types`
- `GET /documents/types/{documentType}`
- `PATCH /documents/types/{documentType}`
- `GET /documents/requirements`
- `POST /documents/requirements`
- `GET /documents/requirements/{documentRequirement}`
- `GET /documents/compliance`
- `GET /documents`
- `POST /documents`
- `GET /documents/{employeeDocument}`
- `GET /documents/{employeeDocument}/download`
- `GET /documents/{employeeDocument}/view`
- `PATCH /documents/{employeeDocument}/review`

Completed backend behavior:

- Organization-defined document types
- Document requirements scoped by structure fields
- Employee/HR document submission metadata
- Multipart employee/HR document file upload
- Authenticated document download and inline view URLs
- Expiry and reminder windows
- Missing, expired, expiring soon, submitted, approved, rejected, and changes-requested compliance status
- Shared approval request creation when approval is required
- Review history

Frontend note: `POST /documents` supports either the older metadata-style `file_path` payload or multipart `file` upload. The response includes `download_url` and `view_url`, but both still require the bearer token.

### Approval Workflows and Approval Queue

- `GET /approval-workflows`
- `POST /approval-workflows`
- `GET /approval-workflows/{approvalWorkflow}`
- `PATCH /approval-workflows/{approvalWorkflow}`
- `GET /approvals`
- `GET /approvals/{approvalRequest}`
- `POST /approvals/{approvalRequest}/actions`

Supported actions:

- `approve`
- `reject`
- `request_changes`
- `cancel`

Supported approver strategies:

- permission
- role
- direct manager
- department head

Frontend should build a reusable approval action component that can be used from:

- approval queue
- document detail/review screen
- leave request detail
- attendance correction detail

Decision notes may be required depending on workflow configuration.

### Leave

- `GET /leave/types`
- `POST /leave/types`
- `GET /leave/periods`
- `POST /leave/periods`
- `GET /leave/holidays`
- `POST /leave/holidays`
- `GET /leave/entitlements`
- `POST /leave/entitlements`
- `GET /leave/requests`
- `POST /leave/requests`
- `GET /leave/requests/{leaveRequest}`
- `PATCH /leave/requests/{leaveRequest}/cancel`

Completed backend behavior:

- Leave types
- Leave periods
- Holidays
- Work days
- Entitlements and balances
- Working-day calculation
- Minimum notice validation
- Maximum request-day validation
- Overlap checks
- Balance checks
- Shared approval integration
- Cancellation
- Dashboard metrics

Recommended screens:

- Leave setup
- Leave entitlements
- Leave request list
- Create leave request
- Leave request detail with approval trail
- My leave balance

### Attendance

- `GET /attendance/settings`
- `PATCH /attendance/settings`
- `GET /attendance/shifts`
- `POST /attendance/shifts`
- `GET /attendance/records`
- `POST /attendance/records`
- `GET /attendance/records/{attendanceRecord}`
- `GET /attendance/corrections`
- `POST /attendance/corrections`
- `GET /attendance/corrections/{attendanceCorrection}`

Completed backend behavior:

- Attendance settings
- Work shifts
- Manual, employee, and import-ready attendance records
- Check-in/check-out timestamps
- Duration calculation
- Source tracking
- Present, late, absent, half-day, and corrected statuses
- Correction requests
- Shared approval integration
- Dashboard metrics

Recommended screens:

- Attendance settings
- Work shifts
- Attendance records
- My attendance
- Correction requests
- Correction detail with approval trail

### Templates and Imports

- `GET /templates`
- `GET /templates/{key}/download`
- `POST /templates/{key}/preview`
- `POST /templates/{key}/import`
- `POST /templates/{key}/failed-rows`

Supported template keys:

- `attendance_import`
- `employee_import`
- `leave_entitlement_import`
- `document_requirement_import`

Frontend should support:

- Template list
- Download sample CSV
- Upload CSV for preview
- Show row-level validation results
- Confirm import
- Show partial success and failed rows
- Download failed rows as CSV for correction and re-upload

### Reports and Exports

- `GET /reports`
- `GET /reports/{key}`
- `GET /reports/{key}/export`

Supported report keys:

- `employee_directory`
- `document_compliance`
- `leave_balances`
- `leave_requests`
- `attendance_summary`
- `attendance_exceptions`

Exports return CSV and honor active filters/sorting.

Recommended frontend pattern:

- Report registry screen
- Report detail table
- Filter panel generated from the report definition
- CSV export button

### Notifications

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/{notification}/read`
- `PATCH /notifications/read-all`

Supported filtering examples:

- `status=unread`
- `status=read`
- `category=approvals`
- `category=employee_onboarding`
- `event=approval.submitted`

Notifications currently cover:

- Employee invitation
- Employee invitation accepted
- Approval submitted
- Approval decided
- Document expiry reminders
- Onboarding follow-up reminders
- Pending approval reminders

Recommended frontend pattern:

- Topbar unread count
- Notification drawer
- Notification list with category/status filters
- Mark read and mark all read actions

### Audit and Activity

- `GET /audit-logs`
- `GET /activity-feed`

Audit logs are low-level technical records with old values, new values, actor, IP, URL, user agent, and timestamp.

Activity feed is more human-readable and better for employee profile timelines or admin activity pages.

Recommended frontend pattern:

- Governance/audit page for authorized users
- Employee activity tab using activity feed
- Compact metadata rows and filters

## 10. Key Frontend Data Patterns

### Pagination

List endpoints generally return paginated data. Build shared table pagination that can consume Laravel-style pagination metadata.

### Filters and Sorting

Employee, reports, documents, leave, attendance, audit, and activity endpoints support filters. Keep filter state in the URL where possible so HR users can share or revisit views.

### Statuses

Build shared status badge components for:

- Employee status
- Profile completion status
- Document status
- Approval status
- Leave status
- Attendance status
- Notification read status

Use calm, consistent status colors. Do not invent a new color language per module.

### Errors

Backend validation errors follow Laravel conventions. Frontend should map field errors to form inputs and show a concise form-level summary.

Handle:

- `401`: clear session and redirect to login
- `403`: show permission/access message
- `404`: show not found or scoped-empty state
- `422`: show validation errors
- `500`: show generic retry/support message

### Tenant Isolation

The backend scopes organization data by `organization_id`. Frontend should still avoid mixing organization-scoped IDs across sessions and should refresh lookups after login or organization context changes.

## 11. Product Screens to Build

### Auth and Entry

- Login
- Invitation acceptance
- Optional register page for local/dev only if needed

### Core Shell

- Sidebar
- Topbar
- Organization switch/context display
- Notifications drawer
- User menu
- Permission-aware navigation
- Theme application from workspace settings

### Workspace Setup

- Workspace overview
- Setup checklist
- Organization identity/settings
- Theme/localization/settings form

### Dashboards

- Organization dashboard
- Manager dashboard
- Employee dashboard

### People

- Employee directory
- Create employee
- Employee detail/profile overview
- Employee onboarding approval
- Employee profile activity
- Emergency contacts
- Dependents
- Custom fields and custom field values
- Status history
- Reporting history

### Documents

- Document types
- Document requirements
- Document compliance dashboard/table
- Employee document list/detail
- Submit document metadata
- Review document

### Workflows

- Approval queue
- Approval request detail
- Approval actions component
- Approval workflow setup

### Leave

- Leave types
- Leave periods
- Holidays
- Leave entitlements
- Leave request list
- Create leave request
- Leave request detail
- My leave

### Attendance

- Attendance settings
- Work shifts
- Attendance record list
- Attendance record detail
- Correction request list
- Correction request detail
- My attendance

### Reports and Data Operations

- Template/import center
- Report registry
- Report detail
- CSV export action

### Governance

- Audit logs
- Activity feed

## 12. Recommended Component System

Build reusable components early:

- App shell
- Sidebar item with module/permission guard
- Page header
- Data table
- Filter bar/filter drawer
- Pagination
- Status badge
- Empty state
- Form field wrapper with Laravel validation error mapping
- Async select for employees/lookups
- Date range filter
- Confirmation modal
- Approval action panel
- Activity timeline
- Notification item
- Import preview table
- Report table

Design these for dense operational screens. Valtireo users will scan tables, review statuses, approve requests, and export records repeatedly.

## 13. Customization Ownership

One of Valtireo's strongest product ideas is:

> Default enough to start. Configurable enough to own.

The frontend should make configuration feel like a normal part of the product, not an advanced hidden area.

Already completed backend configuration areas:

- Organization module subscriptions
- Workspace identity/theme/localization/settings
- Required profile fields
- Employee custom fields
- Document types and document requirements
- Approval workflows
- Leave types, leave periods, holidays, and entitlements
- Attendance settings and work shifts
- Permission-aware reports and templates

Frontend implication:

- Prefer settings screens that are clear, auditable, and role-protected.
- Use simple configuration forms over complicated builders for MVP.
- Show setup progress and next actions.

## 14. Completed Backend Work

The backend HR MVP foundation completed so far includes:

- Laravel API foundation
- Sanctum authentication
- Spatie roles and permissions
- Laravel auditing
- Organization and location foundation
- Organization structure
- Module entitlement service
- Employee onboarding and records
- Employee invitation and acceptance
- Employee profile completion and approval
- Employee profile extensions
- Workspace customization
- Platform-led organization provisioning
- Dashboards
- Documents and compliance
- Shared approval/action engine
- Multi-tenancy isolation tests
- Leave module
- Attendance module
- Import templates
- Report registry and CSV exports
- In-app notifications and reminder command
- Audit/activity visibility
- Postman collection and local environment
- Feature tests across the main backend modules

## 15. Remaining MVP Polish

These are not blockers for frontend implementation, but they should be tracked before final HR MVP release:

- Confirm fresh database migration and seed flow remains clean.
- Run the full backend test suite before the final handoff checkpoint.
- Refresh Postman collection if endpoint payloads change during FE integration.
- Add branded email templates and live mail provider configuration.
- Add notification preferences later if needed.
- Add dashboard widgets for approval queue, documents, leave, and attendance refinements as FE stabilizes.
- Add PDF exports only after report layouts stabilize.
- Add richer policy scoping for leave and approvals after MVP if customers require it.

## 16. Integration Checklist for Frontend

Before building each module:

- Open the backend from `server/` and the frontend from `client/`.
- Import Postman environment and collection.
- Login as `admin@valtireo.test`.
- Inspect the exact response shape in Postman.
- Confirm permission/module requirements from `/auth/me`.
- Build the screen with empty, loading, success, validation, forbidden, and error states.
- Use setup lookup endpoints for IDs instead of hardcoding local seed IDs.
- Keep filters and pagination reusable.
- Confirm actions against backend `403` and `422` behavior.

Before final frontend handoff:

- Auth persists across refresh.
- Navigation reflects modules and permissions.
- Workspace theme/settings are applied.
- Core dashboard loads.
- Employee list, create, detail, and profile overview work.
- Documents, approvals, leave, attendance, reports, notifications, and audit pages can load seeded data.
- CSV download/export flows work.
- Form validation messages show correctly.
- `401`, `403`, `404`, and `422` states are handled cleanly.

## 17. Recommended FE and BE Collaboration Workflow

1. FE imports Postman collection and confirms local backend health/login.
2. FE builds app shell and auth using `/auth/login` and `/auth/me`.
3. FE builds shared API client with bearer token, validation error handling, and CSV download support.
4. FE builds shared tables, filters, status badges, forms, and approval action components.
5. FE implements modules in the order listed in this guide.
6. FE records payload gaps or screen-specific needs as integration notes.
7. BE adjusts response shapes only where there is a real UX/integration benefit.
8. FE and BE lock endpoint contracts before visual polish.
9. Final QA uses the Postman testing order and frontend happy paths.

## 18. Final Product Direction

The HR MVP should show that Valtireo can already operate as a serious institution-ready people operations platform:

- Every employee has a complete record.
- Every document has a status and expiry trail.
- Every approval has an owner and decision history.
- Every organization can configure modules, structure, settings, fields, policies, and reports.
- Every important action is auditable.
- Every report helps leadership see what is happening without chasing spreadsheets.

The frontend should make this feel clear, calm, and operationally trustworthy.
