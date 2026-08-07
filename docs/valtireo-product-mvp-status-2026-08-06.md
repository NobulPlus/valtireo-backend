# Valtireo Product and MVP Status

Date: 2026-08-06

## Product Identity

Valtireo is a configurable Organizational OS by Leading Digitals.

The first product entry point is HR and people operations, but the long-term product is broader than a standard HRMS. Valtireo should manage:

- People
- Organizational structure
- Documents
- Approvals
- Compliance
- Internal workflows
- Reporting
- Audit trails
- AI-assisted administration

The first MVP should stay focused on the Organizational OS foundation. Operational OS areas such as inventory, procurement, fleet, facilities, warehouse, logistics, vendors, and field operations should remain future expansion.

## Current Product Direction

Valtireo should be positioned as:

> The Organizational OS for modern institutions.

The product should feel:

- Structured
- Calm
- Trustworthy
- Practical
- Audit-ready
- Configurable
- Suitable for public-sector, enterprise, NGO, healthcare, education, and growing private organizations

Valtireo should not become a generic HRMS clone. HR is the starting point, but documents, approvals, compliance, and organization-wide governance are the differentiators.

One of the major product differentiators should be customization ownership:

> Default enough to start. Configurable enough to own.

Organizations should be able to shape modules, terminology, fields, approval policies, document rules, leave policies, attendance settings, dashboards, reports, notifications, and roles without needing custom development for every operational difference.

## Current Technical Direction

The current build is backend-first.

- Backend: Laravel API
- Database: MySQL
- Authentication: Laravel Sanctum
- Roles and permissions: Spatie Laravel Permission
- Audit logs: owen-it/laravel-auditing
- Frontend: handled separately
- Current strategy: clean API-first backend, frontend-agnostic

## Completed Work

### Laravel Foundation

Completed:

- Laravel project scaffold
- Git initialized
- Sanctum installed
- Spatie Permission installed
- Laravel Auditing installed
- API routing configured
- Health endpoint: `GET /api/health`
- MySQL database configured locally
- Database migrations successfully run

### Authentication

Completed:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- User model wired with Sanctum tokens
- User roles and permissions included in auth/session payload
- Organization and modules included in login/session response
- Auth request validation
- Auth feature tests

### Organization Foundation

Completed:

- `Organization` model and migration
- `OrganizationLocation` model and migration
- `users.organization_id`
- Organization/location factories
- User-to-organization relationship
- Default organization seed
- Organization and role seed tests

### Organization Structure

Completed:

- Departments
- Units
- Designations
- Grade levels
- Employment types
- Structure migrations, models, and factories
- Organization structure seeder
- Setup lookup APIs
- Structure-related permissions
- Structure seed tests

### Module Entitlements

Completed:

- `PlatformModule`
- `OrganizationModule`
- Platform module seeder
- Organization module subscription relationships
- `ModuleEntitlementService`
- Module data included in login and `/api/auth/me`
- Module entitlement tests

### Employee Onboarding and Records

Completed:

- `Employee`
- `EmployeeProfile`
- `EmployeeInvitation`
- HR/admin-created employee record flow
- Optional employee invitation token generation
- Employee user account creation/linking
- Employee invitation acceptance
- Employee profile completion/submission
- HR approval of submitted onboarding
- Employee list endpoint
- Employee detail endpoint
- Filtered CSV employee export
- Employee listing filters:
  - search
  - status
  - profile status
  - department
  - unit
  - designation
  - grade level
  - employment type
  - location
  - reporting manager
  - date ranges
  - sorting
  - pagination
- Employee onboarding and listing tests

### Dashboards

Completed:

- `GET /api/dashboard/organization`
- `GET /api/dashboard/manager`
- `GET /api/dashboard/me`
- Organization employee totals
- Onboarding metrics
- Structure counts
- Module counts
- Breakdown data
- Recent employees/invitations
- Setup completion status
- Manager/department scoped dashboard
- Personal employee dashboard
- Leave and attendance placeholders until those modules are implemented

### Workspace Customization

Completed:

- `GET /api/workspace`
- `PATCH /api/workspace/settings`
- Workspace settings included in login and `/api/auth/me`
- Organization identity settings:
  - welcome message
  - logo URL
  - login background URL
  - support email
- Theme settings:
  - mode
  - primary color
  - accent color
  - sidebar color
  - button color
  - font family
  - radius
  - density
- Localization settings:
  - timezone
  - date format
  - time format
  - currency
  - country
- Employee experience settings:
  - dashboard widgets
  - onboarding checklist
  - required profile fields
  - profile correction access
  - directory access
  - org chart visibility

### Platform-Led Organization Provisioning

Completed:

- `POST /api/platform/organizations`
- Restricted to Super Admin
- Creates customer organization with invited status
- Creates default Main Office location
- Creates default workspace settings
- Applies optional branding/theme overrides
- Subscribes organization to selected modules
- Creates first Organization Admin user
- Returns temporary password for local/Postman testing

### Documents and Compliance

Completed:

- `DocumentType`
- `DocumentRequirement`
- `EmployeeDocument`
- `EmployeeDocumentReview`
- Organization-created document types
- Organization-defined document requirement rules
- Requirement scoping by department, designation, grade level, employment type, and location
- Employee/HR document submission metadata
- Expiry date and reminder window support
- Review actions:
  - approve
  - reject
  - request changes
- Review notes and review history
- Document listing and filtering
- Document compliance summary for missing, expired, expiring soon, submitted, approved, rejected, and changes requested documents
- Demo compliance seed data
- Document compliance feature tests

### Employee Profile Extensions

Partially completed:

- Multiple emergency contacts per employee
- Dependents per employee
- HR/admin management of employee emergency contacts and dependents
- Employee self-service management of own emergency contacts and dependents
- Primary emergency contact flag
- Dependent beneficiary flag
- Employee detail includes profile extension records when loaded
- Demo profile extension seed data
- Employee profile extension tests

## OrangeHRM Review Completed

A local OrangeHRM Starter review was completed on 2026-08-06.

Local review source:

- `work/orangehrm-review/orangehrm`
- OrangeHRM snapshot: `v5.9`
- Git commit: `56e23b3`
- License: GPL-3.0-or-later

Detailed review file:

- `docs/orangehrm-local-review-2026-08-06.md`

### OrangeHRM Areas Reviewed

Reviewed at source level:

- Product scope
- License
- Tech stack
- Plugin/module structure
- API route coverage
- Entity/data model coverage
- HR feature areas
- Admin/setup features
- Leave features
- Attendance features
- Recruitment features
- Performance features
- Claims features
- Dashboard/reporting patterns
- Authorization and action patterns
- Comparison with current Valtireo backend and MVP plans

### OrangeHRM Key Findings

OrangeHRM is strong as a traditional HRMS. It has mature coverage in:

- Employee records/PIM
- Admin setup
- Leave
- Attendance
- Time/timesheets
- Recruitment
- Performance
- Claims
- Directory
- Dashboard
- OAuth/LDAP/OpenID options
- Localization
- Mobile support

OrangeHRM also shows that HR users expect more than simple employee CRUD. A serious HR MVP needs enough depth in employee records, leave, attendance, documents, reports, and approvals.

### Valtireo Advantage Over OrangeHRM

Valtireo should not copy OrangeHRM. The opportunity is to be stronger in areas OrangeHRM does not emphasize as its core:

- Multi-tenant SaaS foundation
- Platform-led organization provisioning
- Module entitlement by organization
- Organizational OS positioning, not HRMS-only positioning
- Dedicated document compliance module
- Approval workflows across modules
- Audit-ready activity trails
- Configurable workspace experience
- Future AI-assisted administration

### Review-Based MVP Updates

The OrangeHRM review led to these MVP updates:

- Move Documents/compliance earlier.
- Make employee records richer, but do not overbuild.
- Add leave balances, holidays, workweek, and overlap checks.
- Add attendance settings, work shifts, import-ready records, and validation.
- Add explicit approval/action workflows.
- Add a small report registry.
- Treat customization ownership as a platform capability, not only an approval feature.
- Keep recruitment, performance, claims, payroll, SSO, mobile, and social/community features post-MVP.

Additional customization strategy file:

- `docs/valtireo-customization-ownership-strategy-2026-08-06.md`

## Pending MVP Work

### P0: Complete Current Foundation Cleanly

Pending:

- Review existing uncommitted backend work
- Confirm migrations run cleanly from fresh database
- Run full backend test suite
- Refresh Postman/API collection if one exists
- Ensure all current endpoints have consistent permissions
- Ensure dashboard placeholders clearly match upcoming modules
- Update API documentation for frontend handoff

### P1: Documents and Compliance

Foundation implemented.

Remaining enhancements:

- Actual file storage/upload integration
- Dashboard widgets
- CSV/PDF export for compliance reports
- Deeper activity timeline UI payloads
- Requirement rule expansion if customer policy requires it

### P1: Employee Profile Extensions

Partially implemented.

Completed:

- Multiple emergency contacts
- Dependents

Remaining MVP scope:

- Employment status history
- Reporting relationship history or explicit supervisor/subordinate support
- Organization-defined custom fields
- Profile activity timeline
- Link employee documents into the employee profile view

Keep post-MVP unless required:

- Salary components
- Immigration
- Licenses
- Languages
- Memberships
- Complex qualifications

### P1: Shared Approval and Action Pattern

Build before Leave and Attendance become too complex.

Minimum MVP scope:

- Shared action naming:
  - submit
  - approve
  - reject
  - request changes
  - cancel
- Decision notes
- Actor/role tracking
- Status transition validation
- Allowed actions by role/status
- Per-record activity timeline
- Audit trail integration

Organization-owned customization:

- Enable/disable approval per module
- Configure one to three approval steps
- Choose role-based approvers
- Support direct-manager approval
- Support department-head approval
- Require decision notes per policy
- Apply different approval policies by document type, leave type, department, grade, or location over time

Potential use cases:

- Employee onboarding approval
- Document approval
- Leave approval
- Attendance correction approval
- Future claims/reimbursements

Avoid in MVP:

- Visual drag-and-drop workflow builder
- Complex branching workflow designer
- Advanced SLA/escalation automation
- Full formula/rule engine

### P1: Leave Module

Minimum MVP scope:

- Leave types
- Leave period
- Holidays
- Work week
- Leave entitlement/balance
- Employee leave request
- Manager/HR approval
- Comments/decision notes
- Overlap checks
- Leave dashboard counters
- Leave reports

Avoid in MVP:

- Highly complex policy engines
- Country-specific leave law automation
- Payroll integration

### P1: Attendance Module

Minimum MVP scope:

- Attendance settings
- Work shifts
- Manual attendance records
- CSV import-ready model
- Check-in/check-out fields
- Attendance source
- Duration calculation
- Overlap validation
- Correction/approval state
- Notes
- Attendance summary report

Avoid in MVP:

- Biometric device integration
- GPS tracking
- Advanced shift rotations
- Payroll integration

### P2: Report Registry

Minimum MVP scope:

- Report key
- Module
- Permission
- Filter schema
- Export support
- Handler/service class

MVP reports:

- Employee list
- Profile completion
- Missing/expired/expiring documents
- Leave balance/request summary
- Attendance summary
- Audit/activity summary

## Future/Post-MVP Modules

These should stay outside the first MVP unless a paying customer requires them earlier.

### HR Expansion

- Recruitment/ATS
- Performance appraisal
- Learning management
- Advanced employee qualifications
- Salary components
- Benefits
- Payroll
- Exit management

### Finance/Admin Workflows

- Claims/reimbursements
- Loans
- Imprest
- Budget approvals
- Cost centers
- Payroll/accounting integrations

### Internal Services

- Service desk
- ICT requests
- Facility requests
- Policy/help center
- Internal forms

### Enterprise Integrations

- LDAP
- OpenID Connect
- SAML/SSO
- Microsoft/Google workspace integrations
- Email/SMS/WhatsApp notifications
- Webhooks

### Product Expansion

- Mobile app
- AI assistant
- Advanced analytics
- Scheduled reports
- Org chart visualization
- Internal community/central layer

### Operational OS Later Product Line

Keep these outside the first Organizational OS MVP:

- Inventory
- Procurement
- Fleet
- Facilities
- Warehouse
- Logistics
- Vendors
- Field operations
- Asset-heavy operational workflows

## Recommended Implementation Order

1. Stabilize and verify current foundation.
2. Add employee profile extensions needed by compliance.
3. Add shared approval/action pattern.
4. Build Leave with balances, holidays, workweek, and approvals.
5. Build Attendance with settings, shifts, import-ready records, and summaries.
6. Add report registry and MVP reports.
7. Revisit recruitment, performance, claims, payroll, SSO, and mobile after MVP.

## Strategic Decision

Valtireo should not try to beat OrangeHRM by matching every HR feature immediately.

Valtireo should beat traditional HRMS tools by becoming the operating layer for institutions:

- Every employee has a complete record.
- Every document has a status and expiry trail.
- Every approval has an owner and decision history.
- Every organization can configure modules and workspace settings.
- Every organization can own its structure, terminology, policies, fields, approval rules, and reports.
- Every important action is auditable.
- Every report helps leadership see what is happening without chasing spreadsheets.
