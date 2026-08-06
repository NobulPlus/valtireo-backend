# Valtireo Customization Ownership Strategy

Date: 2026-08-06

## Core Idea

One of Valtireo's strongest differentiators should be customization ownership.

Organizations should feel that Valtireo is not forcing them into one rigid HRMS workflow. Instead, Valtireo should provide strong defaults and then let each organization shape policies, approval flows, document rules, modules, fields, notifications, dashboards, and terminology to match how they actually operate.

This should apply across the whole platform, not only approvals.

## Product Principle

Valtireo should work in two layers:

1. Platform defaults
2. Organization-owned configuration

The platform provides safe, sensible defaults so a new organization can start quickly. Then the organization can customize without needing developers for every policy change.

Recommended principle:

> Default enough to start. Configurable enough to own.

## Why This Matters

Different organizations operate differently:

- A school may need principal approval for staff leave.
- A hospital may need department head plus HR compliance review.
- A government agency may require multi-step document verification.
- A startup may want one-step manager approval.
- A NGO may need project/location-based approvals.
- A manufacturing company may need shift-based attendance policies.

If Valtireo supports those differences through configuration, it becomes an operating platform rather than just another HR app.

## Approval Workflow Strategy

### MVP Approach

Start with a basic default approval engine, then add organization-level customization around it.

Default approval actions:

- Submit
- Approve
- Reject
- Request changes
- Cancel

Default approval states:

- Draft
- Submitted
- In review
- Approved
- Rejected
- Changes requested
- Cancelled

Default approval metadata:

- Module
- Record type
- Record ID
- Current status
- Current step
- Actor
- Role
- Decision note
- Decision timestamp
- Previous status
- Next status
- Audit trail reference

### Organization-Owned Approval Configuration

Organizations should eventually configure:

- Which modules require approval
- Number of approval steps
- Approval roles per step
- Approval by direct manager
- Approval by department head
- Approval by HR role
- Approval by compliance role
- Approval by location/branch role
- Approval by amount threshold
- Approval by document type
- Approval by leave type
- Approval by grade level
- Approval by department/unit
- Escalation after a time limit
- Whether comments are required
- Whether attachments are required
- Whether employees can cancel after submission
- Whether approvers can delegate

### Recommended MVP Scope

For MVP, do not build a full workflow builder.

Build:

- Fixed workflow engine
- Configurable approval policy records
- One to three approval steps
- Role-based approvers
- Direct-manager approver option
- Department-head approver option
- Required decision notes toggle
- Per-module enable/disable

Do not build yet:

- Visual drag-and-drop workflow builder
- Branching workflow designer
- Complex conditional logic UI
- SLA/escalation automation
- Delegation marketplace

## Customization Areas Across The System

### 1. Modules

Organizations should own which modules are enabled.

Already started:

- Platform modules
- Organization module subscriptions

Recommended additions:

- Module setup checklist
- Module visibility by role
- Module labels per organization later
- Module-specific settings

Examples:

- Enable HR Core, Documents, Leave, Attendance.
- Disable Recruitment and Performance until later.
- Show Documents to HR and Compliance, but not all employees.

### 2. Workspace Identity

Already started:

- Welcome message
- Logo URL
- Login background URL
- Support email
- Theme settings
- Localization settings
- Employee experience settings

Recommended additions:

- Organization terminology
- Sidebar naming overrides
- Default dashboard widgets by role
- Notification branding
- Email footer/signature settings

Examples:

- Use "Branch" instead of "Location."
- Use "Division" instead of "Department."
- Use "Staff ID" instead of "Employee Number."

### 3. Organization Structure

Already started:

- Departments
- Units
- Designations
- Grade levels
- Employment types
- Locations

Recommended additions:

- Employment statuses
- Work shifts
- Reporting relationship policies
- Optional structure levels
- Structure naming customization

Examples:

- A hospital may use Departments, Units, Wards.
- A school may use Sections, Departments, Campuses.
- A corporate organization may use Divisions, Departments, Teams.

### 4. Employee Profile Fields

Organizations should control which employee fields matter.

Already started:

- Basic employee profile
- Required profile fields in workspace settings

Recommended additions:

- Custom employee fields
- Required/optional field configuration
- Field visibility by role
- Field editability by role
- Field grouping by profile section
- Sensitive field controls

Examples:

- Government agency requires state of origin and pension number.
- Hospital requires license number and professional registration.
- NGO requires donor/project assignment.

### 5. Documents and Compliance

This should be a major Valtireo differentiator.

Recommended customization:

- Document types
- Required documents by role, grade, employment type, department, location, or country
- Expiry rules
- Reminder windows
- Approval requirement per document type
- Who can upload
- Who can verify
- Whether employee self-upload is allowed
- Whether expired documents block workflows

Examples:

- Nurses must upload practicing license yearly.
- Drivers must upload valid license before deployment.
- Contract staff must upload signed contract before activation.

### 6. Leave Policies

Recommended customization:

- Leave types
- Leave entitlement rules
- Leave period
- Work week
- Holidays
- Carryover rule later
- Approval route per leave type
- Minimum notice period
- Attachment requirement
- Overlap rules

Examples:

- Annual leave requires manager approval.
- Study leave requires HR Director approval.
- Sick leave requires attachment if more than two days.

### 7. Attendance Policies

Recommended customization:

- Timezone
- Work shifts
- Grace period
- Late threshold
- Early checkout threshold
- Attendance source types
- Manual entry permission
- Import format
- Correction approval requirement
- Weekend/holiday behavior

Examples:

- Head office uses 8am to 5pm.
- Hospital staff use rotating shifts.
- Field workers are imported from a separate attendance device.

### 8. Notifications

Recommended customization:

- Which events trigger notifications
- Notification channels
- Notification recipients
- Reminder timing
- Escalation recipients later
- Templates later

Examples:

- Notify HR when employee submits profile.
- Notify manager when leave is submitted.
- Notify compliance 30 days before document expiry.

### 9. Dashboards

Already started:

- Organization dashboard
- Manager dashboard
- Personal dashboard
- Configurable dashboard widgets in workspace settings

Recommended additions:

- Role-based default widget sets
- Organization-enabled widgets
- Module-specific dashboard cards
- Saved filters later

Examples:

- HR sees onboarding, documents, leave, attendance.
- Compliance sees expiring documents and audit exceptions.
- Department Head sees team leave and attendance.

### 10. Reports

Recommended customization:

- Enabled reports by module
- Report permissions
- Saved report filters
- Export permissions
- Scheduled reports later

Examples:

- HR Officer can export employee list.
- Compliance Officer can export expiring document report.
- Department Head can only view own team reports.

### 11. Roles and Permissions

Already started:

- Spatie roles and permissions
- Default role seeder

Recommended additions:

- Organization-specific role editing
- Permission templates
- Role cloning
- Role assignment rules
- Module-aware permissions
- Data-scope permissions

Examples:

- HR Officer can manage employee records but not workspace settings.
- Compliance Officer can approve documents but not edit salary fields.
- Department Head can approve leave only for direct department.

## Configuration Model Recommendation

Use a layered configuration model.

### Platform Defaults

Global defaults owned by Valtireo:

- Default modules
- Default roles
- Default statuses
- Default approval actions
- Default document rules
- Default leave types
- Default dashboard widgets

### Organization Settings

Organization-level overrides:

- Branding
- Localization
- Terminology
- Enabled modules
- Required fields
- Approval policies
- Notification policies
- Dashboard settings

### Module Settings

Module-specific configuration:

- Document module settings
- Leave module settings
- Attendance module settings
- Employee module settings
- Report module settings

### Record-Level Rules

Specific rules tied to data:

- Document type requirements
- Leave type approval policy
- Work shift rules
- Custom fields
- Report filters

## Suggested Technical Building Blocks

### Existing Building Blocks

Already useful:

- `organizations.settings`
- `platform_modules`
- `organization_modules`
- Spatie permissions
- Laravel Auditing
- Workspace settings service

### Recommended New Building Blocks

Add over time:

- `organization_settings`
- `module_settings`
- `custom_fields`
- `custom_field_values`
- `approval_policies`
- `approval_steps`
- `approval_requests`
- `approval_actions`
- `notification_policies`
- `report_definitions`
- `saved_report_views`

For MVP, avoid overbuilding all tables at once. Start with approval policies, custom fields, and module settings only when a module needs them.

## MVP Recommendation

For MVP, make customization visible and useful without building a massive no-code builder.

Build:

- Organization module enablement
- Workspace branding/theme/localization
- Required employee profile fields
- Basic custom employee fields
- Document requirement rules
- Basic configurable approval policies
- Leave policy settings
- Attendance settings and shifts
- Role/permission-aware dashboards

Do not build yet:

- Full visual workflow builder
- Full form builder
- Advanced formula/rule engine
- Complex notification template editor
- Scheduled report builder
- Marketplace of templates

## Product Language

Use this idea in product positioning:

> Valtireo gives each organization ownership of its structure, policies, approvals, documents, and workflows without needing to rebuild the system.

Shorter:

> Built with strong defaults. Owned through configuration.

## Strategic Conclusion

Customization ownership should be treated as a core platform capability.

The goal is not unlimited customization from day one. The goal is controlled customization:

- Safe defaults
- Clear settings
- Role-protected changes
- Audit trail for configuration changes
- Module-by-module growth

This will help Valtireo stand apart from standard HRMS platforms and support the larger Organizational OS vision.

