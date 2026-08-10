# Valtireo Project Context

Last updated: 2026-08-04

## Reference Thread

Primary planning/reference task:

`codex://threads/019f7ff5-e5cd-7813-a92c-b0f41f6cb54b`

Use that task as background context when a new Codex task needs to understand the earlier product direction, PRD discussions, timeline choices, and backend-first decision.

## Product Direction

Valtireo is a configurable Organizational OS. The first product focuses on people, structure, HR operations, documents, approvals, compliance, internal workflows, reporting, and AI-assisted administration.

The product should not become a full Operational OS in the first build. Inventory, procurement, fleet, facilities, warehouse, logistics, vendors, and field operations belong to a later Operational OS product line or a future expansion after the Organizational OS foundation is stable.

Financial/Admin workflows belong inside the Organizational OS roadmap, but not in the first MVP. Payroll, benefits, claims, reimbursements, loans, imprest, budget approvals, cost centers, and accounting integrations should be later-phase modules.

## Current Build Strategy

The current project is backend-first.

- Backend: Laravel API
- Frontend: handled separately by another team member
- Database: MySQL
- Authentication: Laravel Sanctum
- Roles/permissions: Spatie Laravel Permission
- Auditing: owen-it/laravel-auditing
- Queue/cache/session tables: Laravel database driver for now

Do not install Breeze, Inertia, or React in this backend project unless the architecture changes later.

## Timeline Position

The September 5 target should be treated as a strong Version 1 / demo-ready MVP target, not the completion date for every long-term phase.

MVP should prioritize:

- Organization setup
- Locations/branches
- Users, roles, permissions
- Departments and units
- Designations
- Grade levels
- Employment types
- Employee records
- Employee profiles
- Employee documents
- Document expiry and approval
- Leave requests and approvals
- Attendance records/imports
- Deployment or location assignment
- Basic reports
- Audit logs

Move these after the MVP:

- Full payroll
- Recruitment/ATS
- Performance appraisal
- Learning management
- Service desk
- Connect/messaging
- Central/community layer
- Advanced AI
- Assets
- Financial/Admin workflows
- Operational OS modules

## Current Repository State

Project path:

`C:\Users\USer\Desktop\valtireo`

Current branch:

`feature/sanctum-auth-api`

Completed and committed work includes:

- Laravel project scaffold
- Git initialized
- Sanctum installed
- Spatie Permission installed
- Laravel Auditing installed
- API routes wired through `bootstrap/app.php`
- `GET /api/health`
- Auth endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- User model wired with Sanctum tokens, roles, and auditing
- Auth request validation
- User API resource
- Auth feature tests
- MySQL database migrated successfully through the package migrations

Completed and verified foundation work includes:

- `Organization` model
- `OrganizationLocation` model
- organization and location factories
- `organizations` migration
- `organization_locations` migration
- `users.organization_id` migration
- `User::organization()` relationship
- `RolePermissionSeeder`
- updated `DatabaseSeeder`
- foundation seed test
- `php artisan migrate --seed` completed successfully
- `php artisan test --filter=OrganizationAndRoleSeedTest` passed
- `Department` model, migration, factory
- `Unit` model, migration, factory
- `Designation` model, migration, factory
- `GradeLevel` model, migration, factory
- `EmploymentType` model, migration, factory
- `OrganizationStructureSeeder`
- updated structure-related role permissions
- `OrganizationStructureSeedTest`
- `php artisan test --filter=OrganizationStructureSeedTest` passed

Completed and verified module entitlement work includes:

- `PlatformModule` model, migration, factory
- `OrganizationModule` model and migration
- `PlatformModuleSeeder`
- organization module subscription relationships
- `ModuleEntitlementService`
- login response now includes organization, roles, permissions, and modules
- `/api/auth/me` now returns the same session bootstrap data
- module entitlement feature tests
- `php artisan migrate --seed` completed successfully for module tables
- `php artisan test --filter=ModuleEntitlementTest` passed
- `php artisan test --filter=AuthenticationTest` passed

Completed and verified employee onboarding work includes:

- `Employee` model, migration, factory
- `EmployeeProfile` model and migration
- `EmployeeInvitation` model and migration
- `EmployeeOnboardingService`
- `StoreEmployeeRequest`
- `EmployeeResource`
- `POST /api/employees`
- HR/admin-created employee record flow
- optional employee invitation token generation
- employee user account creation/linking when invitation is sent
- employee onboarding feature tests
- `php artisan migrate` completed successfully for employee tables
- `php artisan test --filter=EmployeeOnboardingTest` passed

Completed employee records and setup API work includes:

- employee invitation acceptance
- employee profile completion/submission
- HR approval of submitted employee onboarding
- paginated employee listing
- employee detail endpoint
- filtered CSV employee export endpoint
- setup lookup endpoints for departments, units, designations, grade levels, employment types, and locations
- rich demo data seeder for realistic Postman/frontend testing
- employee listing filters for search, status, profile status, organization structure fields, reporting manager, date ranges, sorting, and pagination

Completed dashboard work includes:

- `GET /api/dashboard/organization`
- `GET /api/dashboard/manager`
- `GET /api/dashboard/me`
- organization-level employee totals, onboarding metrics, structure counts, module counts, breakdowns, recent employees/invitations, and setup completion
- dashboard filters for date ranges, structure fields, status, search, sorting, and recent item limits
- manager/department dashboard scope for HR/admin selected departments, Department Heads, Supervisors, and direct-report managers
- manager dashboard people metrics including scoped employee counts, profile health, composition, recent joiners, profile updates, members, and direct reports
- manager dashboard includes explicit leave and attendance placeholders until those modules are implemented
- personal employee dashboard payload with work details, profile status, pending actions, organization, and entitled modules

Completed workspace customization work includes:

- `GET /api/workspace`
- `PATCH /api/workspace/settings`
- workspace settings included in `POST /api/auth/login` and `GET /api/auth/me`
- organization-level identity settings such as welcome message, logo URL, login background URL, and support email
- organization-level theme settings such as mode, primary color, accent color, sidebar color, button color, font family, radius, and density
- localization settings such as timezone, date format, time format, currency, and country
- employee experience settings such as dashboard widgets, onboarding checklist, required profile fields, profile correction access, directory access, and org chart visibility
- workspace settings permissions:
  - every normal workspace user can view workspace settings
  - Super Admin, Organization Admin, and HR Director can update workspace settings

Completed platform-led organization provisioning includes:

- `POST /api/platform/organizations`
- route is restricted to users with the `Super Admin` role
- creates the customer organization with status `invited`
- creates the primary `Main Office` location
- creates default workspace settings, with optional branding/theme overrides
- subscribes the organization to selected platform modules
- creates the first `Organization Admin` user
- returns a temporary password in the response for Postman/local testing until the mail provider and password setup email flow are implemented

Important distinction:

- Seed data is only the development/demo sandbox.
- Platform provisioning is the real customer organization creation workflow.
- After provisioning, the first Organization Admin logs in, lands inside their organization workspace, and completes setup/configuration from there.

Completed documents/compliance foundation includes:

- `DocumentType`, `DocumentRequirement`, `EmployeeDocument`, and `EmployeeDocumentReview`
- organization-created document types
- organization-defined document requirement rules
- requirement scoping by department, designation, grade level, employment type, and location
- employee/HR document submission metadata
- expiry dates and reminder windows
- review actions: approve, reject, request changes
- review notes and review history
- document compliance summary for missing, expired, expiring soon, submitted, approved, rejected, and changes requested documents
- demo document types and requirements seeded for local/Postman testing
- document compliance tests

Completed shared approval/action foundation includes:

- organization-configurable approval workflows
- workflow steps with ordered approval sequence
- approver strategies for permission, role, direct manager, and department head
- approval request tracking for approvable records
- decision history with action, actor, previous status, next status, note, and metadata
- configurable note requirements for rejection and change requests
- default employee document approval workflow for demo and newly provisioned organizations
- document submissions now create approval requests when approval is required
- existing document review endpoint now uses the shared approval engine
- approval workflow and approval request APIs for Postman/frontend integration
- approval workflow feature tests

Completed multi-tenancy isolation coverage includes:

- cross-organization access tests for employees, documents, custom fields, approval workflows, and approval requests
- cross-organization write-protection tests for custom field values, document reviews, approval workflow updates, and approval decisions
- organization-scoped validation tests for employee structure IDs
- setup lookup scoping tests
- workspace settings scoping tests
- full backend suite confirms tenant isolation coverage remains green

Completed leave foundation includes:

- organization-owned leave types
- leave periods
- holidays
- configurable work week/work days
- employee leave entitlements and balances
- employee/HR leave request submission
- working-day calculation excluding non-working days and holidays
- minimum notice and maximum days per request validation
- overlap checks for submitted/approved leave
- balance checks with pending and used days
- shared approval request creation for submitted leave
- approval decision syncing into leave request status and balances
- leave request cancellation
- manager and employee dashboard leave metrics
- demo leave setup and entitlements seeded for local/Postman testing
- leave feature tests

Completed attendance foundation includes:

- organization attendance settings
- work shifts
- manual, employee, and import-ready attendance records
- check-in/check-out timestamps
- duration calculation with shift break minutes
- source tracking
- present/late/absent/corrected status support
- employee self-service attendance record creation
- HR/admin attendance record creation for employees
- attendance correction requests
- shared approval request creation for attendance corrections
- approval decision syncing into correction status and attendance record values
- manager and employee dashboard attendance metrics
- demo attendance settings, shifts, and records seeded for local/Postman testing
- attendance feature tests

Completed import template foundation includes:

- permission-aware template registry
- template listing endpoint
- CSV download endpoint
- attendance import template
- employee import template
- leave entitlement import template
- document requirement import template
- template download tests

Completed employee profile extension work includes:

- multiple emergency contacts per employee
- dependents per employee
- employment status history
- reporting relationship history
- organization-defined employee custom fields
- custom field values per employee
- HR/admin updates for employee custom field values
- employee self-service updates for visible and employee-editable custom fields
- employee profile activity timeline
- complete employee profile overview payload combining core employee, profile, contacts, dependents, documents, custom fields, lifecycle history, reporting history, and activities
- HR/admin management of emergency contacts and dependents for employees in their organization
- employee self-service management of their own emergency contacts and dependents
- primary emergency contact support
- dependent beneficiary flag
- HR/admin lifecycle status changes with effective dates, reasons, notes, and actor tracking
- HR/admin reporting manager changes with previous/new manager history
- employee detail response includes loaded emergency contacts, dependents, documents, and custom field values
- employee detail response includes loaded status and reporting history
- demo profile extension data seeded for local/Postman testing
- employee profile extension tests

## Database

Local MySQL database:

- Database: `valtireo`
- Username: `valtireo_user`
- Password: stored in local `.env`

The `.env` file is local-only and ignored by Git.

Current migrations have run successfully:

- users
- cache
- jobs
- personal access tokens
- audits
- permissions/roles
- organizations
- organization locations
- user organization relationship
- departments
- units
- designations
- grade levels
- employment types
- platform modules
- organization module subscriptions
- employees
- employee profiles
- employee invitations
- employee emergency contacts
- employee dependents
- employee status histories
- employee reporting histories
- employee custom fields
- employee custom field values
- employee profile activities
- document types, requirements, employee documents, and document reviews

## Default Local Seed

The foundation seed is intended to create:

- Organization: `Valtireo Demo Organization`
- Organization code: `VALTIREO`
- Location: `Head Office`
- Location code: `HQ`
- Admin email: `admin@valtireo.test`
- Admin password: `Password1!`
- Admin role: `Super Admin`

Default roles:

- Super Admin
- Organization Admin
- HR Director
- HR Officer
- Compliance Officer
- ICT Admin
- Department Head
- Supervisor
- Employee

## Next Implementation Order

Next modules should be built in this order:

OrangeHRM local review reference:

- A local OrangeHRM Starter `v5.9` review was completed on 2026-08-06.
- Review file: `docs/orangehrm-local-review-2026-08-06.md`
- Main takeaway: do not copy OrangeHRM or chase its whole module breadth in MVP, but use its mature HR coverage to strengthen Valtireo's employee profile, documents, leave, attendance, approvals, and reporting definitions.
- Valtireo differentiator: multi-tenant Organizational OS plus document compliance, approvals, audit trail, and configurable modules.

Updated near-term implementation order:

1. Add report registry and MVP reports:
   - employee list/profile completion
   - document compliance
   - leave summary
   - attendance summary
   - audit/activity summary

## Working Rules

- Keep the backend API clean and frontend-agnostic.
- Prefer Laravel conventions unless the codebase establishes a stronger local pattern.
- Keep MVP scope tight.
- Add tests for each backend foundation slice.
- Update this file after major decisions or completed modules.
