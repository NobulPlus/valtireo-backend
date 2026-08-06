# OrangeHRM Local Review

Date: 2026-08-06

Local source reviewed:

- `work/orangehrm-review/orangehrm`
- Git snapshot: `56e23b3`, tagged `v5.9`
- Product: OrangeHRM Starter, GPL-3.0-or-later

## Why We Reviewed It

OrangeHRM is a mature open-source HRMS. The goal of this review is not to copy it. The goal is to use it as a market and implementation reference, identify strong HR workflows users will expect, notice weak spots or product boundaries, and compare those against Valtireo's MVP and PRD direction.

Valtireo's stronger strategic position remains:

- Multi-tenant Organizational OS, not just a single-company HRMS.
- Backend-first Laravel API with module entitlements.
- HR as the first product entry point, with documents, approvals, compliance, internal workflows, reporting, and AI-assisted administration as the wider platform direction.

## OrangeHRM Highlights

OrangeHRM has broad HR module coverage. The cloned repository includes plugins for:

- Admin/setup
- PIM/employee records
- Leave
- Attendance
- Time/timesheets
- Recruitment
- Performance
- Claims
- Dashboard
- Directory
- Authentication
- OAuth
- LDAP
- OpenID
- Mobile
- Corporate branding
- Localization/i18n
- Maintenance/purge
- Workspace notifications
- Buzz/social feed

Approximate local source scale:

- Admin: 59 API classes, 50 route groups, 23 core entities
- PIM: 73 API classes, 59 route groups, 26 core entities
- Leave: 46 API classes, 29 route groups, 12 core entities
- Time: 41 API classes, 27 route groups, 7 core entities
- Recruitment: 32 API classes, 28 route groups, 9 core entities
- Performance: 31 API classes, 20 route groups, 8 core entities
- Attendance: 21 API classes, 12 route groups, 1 core entity
- Claim: 16 API classes, 14 route groups, 5 core entities
- Plugin test coverage: about 596 PHP test files

## Feature Patterns Worth Borrowing

### 1. Employee record depth

OrangeHRM's PIM is much deeper than our current employee model. It covers:

- Personal details
- Contact details
- Profile picture
- Emergency contacts
- Dependents
- Work experience
- Education
- Skills
- Languages
- Licenses
- Memberships
- Immigration records
- Salary components
- Employment contract
- Supervisors/subordinates
- Termination records and reasons
- Attachments per profile screen
- Custom fields
- CSV import

Valtireo currently has a strong start: employee identity, organization structure, manager, onboarding status, profile status, listing/filtering/export, and profile completion. The gap is not the foundation; the gap is employee profile richness.

MVP implication:

- Keep MVP lean, but add a structured "employee profile extensions" plan.
- For Version 1, prioritize emergency contacts, dependents, documents, employment history/status changes, reporting relationships, and custom fields.
- Push salary components, immigration, licenses, languages, memberships, and complex qualifications to post-MVP unless a target customer requires them.

### 2. Leave is more than requests

OrangeHRM models leave as a system:

- Leave types
- Leave periods
- Work week
- Holidays
- Leave entitlements
- Leave balances
- Employee leave requests
- Manager/HR employee leave actions
- Bulk leave actions
- Overlap validation
- Comments
- Leave reports

Valtireo's PRD already lists leave requests and approvals, but the real MVP should include enough leave infrastructure for the workflow to make sense.

MVP implication:

- Include leave types, leave periods, holidays, balances/entitlements, requests, approval actions, comments/decision notes, overlap checks, and dashboard/report counters.
- Do not build every advanced leave rule at first, but avoid a shallow "request table only" implementation.

### 3. Attendance needs policy and exception handling

OrangeHRM includes:

- Attendance configuration
- Current datetime/timezone support
- Punch in/out
- My records
- Employee records
- Record overlap validation
- Summary reports
- Admin/proxy employee punch in/out

Valtireo plans "manual attendance records/import-ready structure." That is reasonable for MVP, but we should include the policy shape early.

MVP implication:

- Add attendance settings: timezone, workday policy, allowed source types, edit permissions.
- Add attendance records with source (`manual`, `import`, later `device`), check-in/check-out, duration, status, notes, and approval/correction state.
- Add overlap validation and summary metrics from day one.
- Keep biometric/device integrations post-MVP.

### 4. Admin/setup breadth matters

OrangeHRM's admin module goes beyond departments and job titles:

- Job titles and job specifications
- Job categories
- Employment statuses
- Users
- Subunits/company structure
- Education, skills, languages, licenses, memberships
- Organization profile
- Pay grades/currencies
- Nationalities
- Email configuration/subscriptions
- Work shifts
- Locations
- Module enablement
- Localization

Valtireo already covers organization, locations, departments, units, designations, grade levels, employment types, module entitlements, workspace settings, roles, and permissions. That is good MVP architecture.

MVP implication:

- Add employment statuses separately from employment types.
- Add work shifts before or alongside attendance.
- Add job specification/role description as a document or metadata concept tied to designation.
- Keep pay grades lightweight. Full payroll/currency salary modeling should remain post-MVP.

### 5. Reports are first-class, not afterthoughts

OrangeHRM has reporting endpoints across PIM, leave, attendance, and time. Valtireo already has dashboards and export. The next step is to define named reports, not just ad hoc dashboard payloads.

MVP implication:

- Add a small reporting registry: report key, module, filters, export support, permission.
- MVP reports should include employee list, onboarding/profile completion, missing/expiring documents, leave balance/request summary, attendance summary, and audit/activity summary.

### 6. Workflow action endpoints are a strong pattern

OrangeHRM exposes explicit actions for candidate progression, claim actions, performance review allowed actions, leave bulk actions, and attendance validation. This is a useful API design cue.

MVP implication:

- For Valtireo approvals, prefer explicit action endpoints such as `approve`, `reject`, `request-changes`, `cancel`, and `submit`, with decision notes and audit trail.
- Do not hide important business transitions inside generic `PATCH` endpoints only.

## OrangeHRM Loopholes and Limits

These are not "bad" in isolation, but they are opportunities for Valtireo positioning.

### 1. Single-instance HRMS orientation

OrangeHRM appears built around one organization per installation, with singleton-style organization configuration. Valtireo is already modeling organizations, module entitlements, and platform-led provisioning, which is stronger for SaaS/multi-tenant delivery.

Valtireo advantage:

- Multi-tenant from the foundation.
- Platform modules and organization subscriptions already exist.
- Better fit for selling to multiple institutions from one hosted product.

### 2. HRMS boundary

OrangeHRM is broad inside HR, but it is still primarily HRMS. Valtireo's PRD should keep HR as the entry point while retaining the broader Organizational OS scope: documents, approvals, compliance, internal services, reporting, and governance.

Valtireo advantage:

- Document compliance and approval workflows can become a differentiator.
- Audit-ready operational records can be stronger than standard HRMS records.

### 3. Document/compliance gap

OrangeHRM has attachments in employee, recruitment, claim, job specification, and other contexts, but this review did not find a dedicated document compliance module comparable to Valtireo's planned:

- Document type registry
- Required employee documents
- Expiry tracking
- Approval status
- Missing document checks
- Compliance dashboards

Valtireo advantage:

- Make Documents a core MVP module, not just file attachments.

### 4. Stack and modernization

OrangeHRM uses a mature but heavier custom PHP/Symfony/Doctrine/Vue CLI architecture. It is Docker-oriented and has many project-specific conventions.

Valtireo advantage:

- Laravel API conventions are simpler for our team.
- Sanctum, Spatie Permission, Laravel Auditing, and clean resource/request/controller patterns are easier to extend quickly.

### 5. GPL licensing

OrangeHRM Starter is GPL-3.0-or-later. That is fine for review and learning, but we should not copy code into Valtireo.

Valtireo rule:

- Use OrangeHRM as a product reference only.
- Do not copy implementation code, UI, or proprietary wording.

## Valtireo Coverage Check

Already covered or planned well:

- Multi-tenant organizations
- Organization locations
- Users/auth/session bootstrap
- Roles and permissions
- Audit logs
- Departments/units/designations/grade levels/employment types
- Module entitlements
- Workspace branding/settings/localization
- Employee records
- Employee invitation/onboarding
- Employee listing, filters, detail, export
- Role-aware dashboards
- Platform-led organization provisioning
- Documents, leave, attendance, reports in stated MVP roadmap

Needs stronger MVP definition:

- Employee documents as a compliance module
- Employee profile extensions
- Leave balances/entitlements/holidays/workweek
- Attendance settings, overlap validation, summaries, import states
- Work shifts
- Employment statuses
- Approval action model
- Report registry
- Activity timelines at record level

Post-MVP or later-phase:

- Recruitment/ATS
- Performance appraisal
- Claims/reimbursements
- Payroll/salary components
- Learning
- Social feed/internal community
- LDAP/OpenID enterprise SSO
- Mobile app
- Complex qualifications/languages/licenses/memberships

## Recommended MVP Adjustments

### P0: Keep and finish current foundation

Finish current backend foundation before expanding:

- Organization provisioning
- Workspace setup
- Structure lookups
- Employee onboarding
- Dashboard
- Permissions/audit discipline

### P1: Build Documents before Leave/Attendance

Documents should be Valtireo's differentiator against a standard HRMS.

Minimum MVP:

- Document types
- Required document rules by organization, employment type, department, or grade
- Employee documents
- Upload metadata
- Expiry date and reminder window
- Approval status
- Review actions with notes
- Missing/expired/expiring reports
- Dashboard widgets

### P1: Deepen Employee Profile Carefully

Add only the profile extensions that support onboarding, compliance, and daily HR use:

- Multiple emergency contacts
- Dependents
- Employment status history
- Reporting relationships
- Employee attachments/documents link
- Custom fields by organization
- Profile activity timeline

### P1: Leave Should Include Balances

Minimum MVP:

- Leave types
- Leave period
- Holidays
- Work week
- Leave entitlement/balance
- Employee request
- Manager/HR approval
- Comments/decision notes
- Overlap validation
- Leave dashboard/report

### P1: Attendance Should Be Import-Ready and Exception-Aware

Minimum MVP:

- Attendance settings
- Work shifts
- Attendance records
- Manual entry
- CSV import-ready model
- Overlap validation
- Corrections/approval state
- Summary report

### P2: Add Workflow/Approval Infrastructure

Instead of building approvals separately for each module forever, define a shared approval action pattern early:

- Subject module/type/id
- Current status
- Allowed actions
- Actor
- Decision note
- Audit log/activity timeline

This will help documents, leave, attendance corrections, onboarding approval, and later claims/performance.

### P2: Add Report Registry

Add a small report registry instead of only hardcoding dashboard endpoints:

- Report key
- Module
- Permissions
- Filter schema
- Export formats
- Handler/service class

This keeps reporting scalable without overbuilding BI.

## Product Conclusion

OrangeHRM proves that the HR baseline users expect is broader than simple employee CRUD. However, it also confirms that Valtireo's direction is stronger if we stay disciplined:

- Do not try to match every OrangeHRM module in MVP.
- Do make employee records, documents, leave, attendance, approvals, reports, audit, and setup feel complete enough to trust.
- Use Documents + multi-tenant Organizational OS + audit-ready workflows as the differentiation.

Recommended next implementation order:

1. Documents/compliance module
2. Employee profile extensions needed by documents/onboarding
3. Shared approval/action pattern
4. Leave with balances and holidays
5. Attendance with settings, shifts, imports, and summaries
6. Report registry and MVP reports

