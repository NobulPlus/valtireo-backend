# Valtireo Frontend Build and Improvement Brief

Last updated: 2026-08-11

## Purpose

This file is the single working brief for continuing the Valtireo frontend. It consolidates the product understanding, repository context, API workflow, implementation order, design direction, and current improvement priorities.

Use this before designing or building any frontend screen.

## Source Files to Read First

Read these files in this order:

1. `docs/valtireo-brand-guide-v1.pdf` — brand identity source of truth (logo, palette, typography, voice, module naming).
2. `docs/valtireo-design-system-foundations-v1.pdf` — design system source of truth (tokens, type scale, component patterns, workflow states, build order).
3. `README.md`
4. `docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`
5. `docs/postman/README.md`
6. `docs/postman/valtireo-api.postman_collection.json`
7. `docs/postman/valtireo-local.postman_environment.json`
8. `client/README.md`
9. `C:/Users/USer/Documents/Codex/2026-07-20/hrms/outputs/PeopleCore Foundation PRD v3.2.docx`

`docs/valtireo-brand-product-design-foundation-v1.md` is now superseded by the two PDFs above. It's still useful as narrative background (positioning rationale, research references, "what to borrow from Leading Digitals/Arkfilms") but where it disagrees with the PDFs on anything concrete — palette, logo, typography — the PDFs win.

The older PeopleCore PRD is strategic ancestry. It explains the original Workforce OS thesis. Valtireo is the evolved product identity and should now be treated as the main product.

## Product Truth

Valtireo is not just HR software.

Valtireo is a configurable Organizational OS for structure, people, workflows, approvals, documents, compliance, internal services, reporting, activity trails, communication, and intelligence.

HR is the first MVP entry point because it proves the core engines with real workflows, but the public product identity must stay broader than HRMS.

The product should help organizations replace scattered files, spreadsheets, chats, manual approvals, and informal follow-up with one structured, governed workspace.

Core promise:

> Every person, process, document, request, and decision has a clear place, owner, status, and audit trail.

## Product Positioning

Primary positioning:

> Valtireo is the Organizational OS for modern institutions and growing teams.

Expanded positioning:

> Valtireo helps organizations manage structure, people, workflows, approvals, documents, compliance, internal services, reporting, and operational intelligence from one connected platform.

Sharp enterprise positioning:

> Valtireo turns scattered organizational work into structured, visible, governed operations.

## Product Architecture

Current product line:

- Valtireo Core
- Valtireo HR
- Valtireo Documents
- Valtireo Leave
- Valtireo Attendance
- Valtireo Reports
- Valtireo Governance

Future or later product surfaces:

- Valtireo Desk / Service Desk
- Valtireo Payroll
- Valtireo Recruit
- Valtireo Performance
- Valtireo Learning
- Valtireo Assets
- Valtireo Compliance
- Valtireo Central
- Valtireo AI
- Connect-style workflow communication

Do not present Valtireo as `Valtireo HRMS`, `Valtireo Workforce only`, or a generic HR tool.

## Core Engines

Valtireo should feel like one platform because these engines run through every module:

- Tenant and organization management
- Workspace identity, theme, localization, and settings
- Users, roles, permissions, and module access
- Configurable organization structure
- Custom fields and configurable records
- Workflow and approval routing
- Document requirements and compliance rules
- Notifications and reminders
- Audit logs and human-readable activity feeds
- Reports, exports, templates, and imports
- Future AI assistance and communication surfaces

## Current MVP Scope

The frontend MVP should integrate the completed backend modules:

- Auth/session bootstrap
- Workspace settings and setup checklist
- Organization, manager, and employee dashboards
- Setup lookups
- Employee directory, creation, detail, onboarding approval, and profile overview
- Employee self-service profile, contacts, dependents, custom fields, and activity
- Documents, document types, requirements, compliance, submissions, and reviews
- Approval workflows, queue, details, and actions
- Leave setup, entitlements, requests, cancellation, and approval flow
- Attendance settings, shifts, records, corrections, and approval flow
- Templates and CSV imports
- Reports and CSV exports
- Notifications
- Audit logs and activity feed

Out of first HR MVP:

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

## Repository Structure

```text
valtireo/
  client/   # React + TypeScript + Vite frontend
  server/   # Laravel API backend
  docs/     # Product, API, Postman, design, and handoff docs
```

Frontend work belongs in `client/`.

Backend work belongs in `server/`.

Shared documentation belongs in `docs/`.

## Frontend Stack

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- Axios
- React Hook Form
- Zod
- Tailwind CSS v4
- lucide-react icons

## Local Development

Backend:

```bash
cd server
php artisan serve
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Local frontend URL:

```text
http://127.0.0.1:5173
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

Default local employee:

```text
email: aisha.bello@valtireo.test
password: Password1!
```

## API Workflow

Start every integration pass with:

1. `GET /api/health`
2. `POST /api/auth/login`
3. Store bearer token.
4. `GET /api/auth/me`

The login and `/auth/me` payload is the application bootstrap payload. It drives:

- user identity
- organization context
- roles
- permissions
- entitled modules
- workspace settings
- navigation visibility
- route access
- available actions
- theme/application settings

Do not hardcode access by role alone. Use permissions and module entitlement from the session payload.

## Endpoint Groups

Main endpoint groups:

- Health
- Auth
- Platform provisioning
- Workspace and setup
- Dashboards
- Employees
- Employee self-service
- Documents and compliance
- Approvals
- Leave
- Attendance
- Templates and imports
- Reports
- Notifications
- Audit and activity

Use the Postman collection for exact endpoint examples, payloads, and testing order.

## Frontend Implementation Order

Build in this order:

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

This lines up with the Design System Foundations build order (app shell; buttons/badges/inputs; tables/filters; detail pages/tabs; approval/document workflows; dashboards/reports) — that document groups by component class, this one by product module, but neither contradicts the other.

## Current Frontend State

The current client includes:

- Auth/login flow
- App shell
- Sidebar/topbar/navigation structure
- Permission/module guards
- Workspace and setup checklist
- Setup lookups and shared selectors
- Dashboards
- Employee directory and create employee flow
- Employee detail/profile overview

Not yet fully built:

- Documents
- Approvals
- Leave
- Attendance
- Templates/imports
- Reports
- Notifications
- Audit/governance

## Screen Philosophy

Every screen must quickly answer:

- What is this?
- Who owns it?
- What is the status?
- What action is needed?
- What changed recently?

Design for dense operational use. Users will scan tables, review statuses, approve requests, export records, and return to the same screens repeatedly.

## Product Shell Direction

Recommended shell:

- Left sidebar for primary modules
- Topbar for organization context, search, notifications, quick actions, and profile
- Content header with title, breadcrumbs, status, and primary action
- Optional right-side drawer for activity, comments, approval history, or future AI support

Sidebar groups:

- Core
- People
- Workflows
- Documents
- Time
- Services
- Reports
- Governance
- Settings

## Shared Components to Build and Reuse

- App shell
- Sidebar item with module/permission guard
- Page header
- Data table
- Filter bar/filter drawer
- Pagination
- Status badge
- Empty state
- Error state
- Loading state
- Form field wrapper with Laravel validation error mapping
- Async select
- Date range filter
- Confirmation modal
- Approval action panel
- Activity timeline
- Notification item
- Import preview table
- Report table
- Drawer/panel patterns

## Design Direction

Valtireo should feel:

- structured
- calm
- trustworthy
- intelligent
- official
- precise
- practical
- scalable
- quietly premium
- institution-ready

Avoid:

- playful consumer patterns
- generic HRMS visuals
- flashy startup language
- decorative dashboards
- heavy gradients inside work screens
- fake metrics
- fake features
- AI-hype theater
- visible development artifacts in production
- overusing parent-brand identity

The product can be visually impressive, but it must remain believable for government, healthcare, education, NGOs, enterprise, and growing private organizations.

## Brand and Design System (Finalized — Source of Truth)

This section reflects the decisions locked in on 2026-08-11 after reviewing `valtireo-brand-guide-v1.pdf` and `valtireo-design-system-foundations-v1.pdf`. It supersedes the palette/typography guidance in the older markdown foundation doc wherever the two differ.

### Logo

Final mark: a pine rounded-square container holding a "V" letterform built from layered teal/blue strokes, with a small gold node at the top of the V and a cyan node at the bottom tip.

- Gold node = decision, approval, and governance moments.
- Cyan node = AI, automation, and intelligence assistance.
- Deep pine base = trust, control, and enterprise seriousness.

Primary lockup: mark + "Valtireo" wordmark + "ORGANIZATIONAL OS" subtitle, on light backgrounds. Reverse lockup: same, on dark pine backgrounds.

Logo misuse rules:

- Do not stretch or distort the mark.
- Do not place it on low-contrast backgrounds.
- Do not replace the palette with random gradients.
- Do not use generic people, gear, globe, or shield icons as the primary mark.
- Do not present the brand publicly as "Valtireo HRMS."

**Pending implementation gap:** the codebase currently implements an earlier, abstract two-overlapping-planes mark in `client/src/components/ui/Logomark.tsx`, `client/public/favicon.svg`, and the sidebar brand row in `client/src/components/shell/Sidebar.tsx`. All three need to be rebuilt to match the real V-letterform mark described above before the login page or app shell can be called finished.

### Color Palette

Core product colors (used for the large majority of the UI):

- Pine: `#123F3A`
- Teal: `#2F8F8A`
- Blue: `#244F7A`
- Ink: `#101828` (see open item below — this is the value used by the Brand Guide; the codebase currently has this same value as `--color-strong` and a separate, nearly identical `--color-ink: #111827`)
- Canvas: `#F7FAF9`
- Surface: `#FFFFFF`
- Soft Surface: `#EEF5F4`
- Border: `#D7E2E0`

Accent colors, each with a specific, narrow job — not general-purpose accents:

- Bridge Teal `#65C7C4` — the parent-brand (Leading Digitals) link. Confined to the login/entry screen and any future marketing surfaces only. Not used inside dashboards, tables, or forms.
- Decision Gold `#FFCC29` — reserved for decision, approval, and governance moments (matches the logo's gold node). Used sparingly, never as a default action/button color.
- AI Cyan `#16B6C9` — reserved for AI, automation, and intelligence-assistance moments (matches the logo's cyan node). Used sparingly.

Status colors (existing token set, still valid):

- Success: `#168A5B`
- Warning: `#C47A00`
- Danger: `#C2413D`
- Info: `#2563A8`
- Pending: `#8A6D1F`
- Draft: `#667085`

Usage rules:

- Use Pine, Ink, Canvas, and white for most product UI.
- Use Teal and Blue for navigation, active states, and product identity.
- Use Gold only for governance/approval highlights, never as a primary button color.
- Use Cyan only for AI/automation moments.
- Avoid large teal-only screens — the product should not read as one-note.
- Do not rely on color alone for status; always pair color with a text label.

### Typography

Locked:

- Product UI (tables, forms, navigation, buttons): **Inter**, self-hosted via `@fontsource/inter`. Instrument Sans was considered and rejected — Inter stays as the only UI typeface.
- Brand/display headings: **Manrope**, self-hosted via `@fontsource/manrope`.

Type scale (from the Design System Foundations deck):

| Role | Size / Line height / Weight |
| --- | --- |
| Display | 30px / 36px / 800 |
| Page Title | 24px / 32px / 800 |
| Section | 18px / 26px / 750 |
| Body | 14px / 22px / 400 |
| Label | 12px / 16px / 750 |

**Open item:** a weight of 750 isn't a standard static font-weight step (Manrope via `@fontsource` ships in steps of 100: 400/500/600/700/800). At implementation time, either round 750 down to 700, or switch to the Manrope variable-font package so 750 is achievable exactly.

Principles:

- Dense but readable.
- Strong hierarchy.
- Sentence case for UI labels.
- Compact labels for admin screens.
- Avoid decorative letter spacing inside product UI.
- No oversized hero typography inside operational dashboards.

### Workflow Status Model

The Design System Foundations deck defines a formal five-stage lifecycle for approvals and documents, each with its own color:

1. Draft — gray
2. Submitted — blue
3. Review — gold/amber
4. Approved — green
5. Archived — dark pine

This is the canonical status model to use for the approval queue and document workflow screens (not yet built). It's distinct from, and more specific than, the six general-purpose status tokens (Success/Warning/Danger/Info/Pending/Draft) already in `index.css` — those remain valid for other general states (form validation, connection errors, and so on), but approval/document lifecycle states should use this five-stage model specifically.

### Empty, Loading, and Error State Patterns

- Empty: soft-surface card, plain description of what's missing (e.g. "No employees have been added yet."), plus a primary action to resolve it (e.g. "Invite employee").
- Loading: soft-surface card with skeleton rows, plain description (e.g. "Loading employee records...").
- Error: danger-tinted card, plain description of what failed (e.g. "Employee records could not be loaded."), plus a "Retry" action in danger red.

### Open Brand/Design Implementation Items

Not yet resolved — flag these before or during implementation rather than guessing:

- **Ink hex value.** Brand Guide lists Ink as `#101828`; the codebase currently has both `--color-ink: #111827` and a separate `--color-strong: #101828`. Recommend consolidating to a single near-black value (`#101828`, since that's what both the Brand Guide and the existing `--color-strong` token already agree on) rather than keeping two nearly-identical tokens — but this hasn't been explicitly confirmed yet.
- **Label font-weight 750.** See Typography section above — needs either rounding to 700 or a switch to variable Manrope.
- **Logomark/favicon/Sidebar rework.** See Logo section above — three files currently implement the wrong mark.

## Login Page Direction

The login page is the product entry point, not an HR page.

It should communicate:

- Valtireo is the Organizational OS.
- The product is broader than HR.
- The workspace is secure, governed, and operational.
- The interface is premium and technically mature without feeling fake.

Do not include `by Leading Digitals` in the login UI.

Avoid HR-only copy such as:

- employee records only
- HR dashboard
- workforce-only positioning

Better language:

- One operating layer for the whole organization.
- Structure, workflows, services, compliance, reporting, and intelligence.
- Every process, document, request, and decision has a clear place and trail.

Creative/motion direction:

- Use refined tech/system visuals, not fantasy decoration.
- Motion should suggest structure, routing, signals, governance, and system intelligence.
- Motion must be subtle, performant, and disabled under `prefers-reduced-motion`.
- Do not use fake live metrics unless backed by real data.
- The brighter Bridge Teal (`#65C7C4`) is allowed here specifically as the parent-brand link — this is the one place in the product where it's appropriate. See the Color Palette section above.

## UX Rules

- Do not add dead links or fake actions.
- Do not add SSO, forgot-password flows, passkeys, or AI entry points unless the backend/product supports them.
- Show development seed credentials only in development mode.
- Always handle empty, loading, success, validation, forbidden, not-found, and server-error states.
- Use backend validation errors and map `422` field errors to form fields.
- Handle `401` by clearing session and redirecting to login.
- Handle `403` with a permission/access state.
- Keep filters in URL where useful.
- Reuse status colors and components across modules.

## Permissions and Modules

Use session permissions and modules, not role names alone.

Important permission groups:

- `workspace_settings.view`
- `workspace_settings.update`
- `employees.view`
- `employees.create`
- `employees.update`
- `employees.delete`
- `employee_documents.view`
- `employee_documents.create`
- `employee_documents.update`
- `employee_documents.delete`
- `approval_workflows.view`
- `approval_workflows.create`
- `approval_workflows.update`
- `approvals.view`
- `approvals.action`
- `leave_requests.view`
- `leave_requests.create`
- `leave_requests.approve`
- `leave_requests.cancel`
- `attendance.view`
- `attendance.create`
- `attendance.update`
- `attendance.correct`
- `reports.view`
- `audit_logs.view`

Hide navigation when the module is unavailable.

Hide primary actions when permission is missing.

Still handle backend `403`, because backend remains the source of truth.

## Module Screen Notes

### Workspace and Setup

Use workspace settings for:

- organization identity
- theme
- localization
- employee experience settings
- setup checklist progress

Configuration should feel like a normal part of the product, not an advanced hidden area.

### Dashboards

Dashboards should be role-aware:

- Organization dashboard for organization-wide HR/admin visibility
- Manager dashboard for scoped departments/direct reports
- Employee dashboard for self-service

Dashboard rule (from the Design System Foundations deck): prioritize tasks, exceptions, upcoming expiries, approvals, incomplete records, and audit-sensitive changes. Avoid marketing-style hero sections inside the product.

### People

People is the first proof module, but do not let it narrow the product identity.

Screens:

- Employee directory
- Create employee
- Employee profile/detail
- Onboarding approval
- Profile activity
- Emergency contacts
- Dependents
- Custom fields
- Status history
- Reporting history

### Documents

Documents are a key differentiator.

Screens:

- Document types
- Document requirements
- Compliance dashboard/table
- Employee documents
- Submit document metadata
- Review document
- Expiry/missing/changes-requested states

### Workflows

Build reusable approval patterns. Use the five-stage workflow status model (Draft → Submitted → Review → Approved → Archived) defined in the Brand and Design System section above.

Screens:

- Approval queue
- Approval detail
- Approval action panel
- Approval workflow setup

Supported actions:

- approve
- reject
- request changes
- cancel

Every approval screen should show: requester, current approver, decision history, due date/age, attached documents, and the available decision actions.

### Leave

Screens:

- Leave setup
- Leave types
- Leave periods
- Holidays
- Leave entitlements
- Leave request list
- Create leave request
- Leave request detail
- My leave balance

### Attendance

Screens:

- Attendance settings
- Work shifts
- Attendance records
- My attendance
- Correction requests
- Correction detail

### Templates and Imports

Supported template keys:

- `attendance_import`
- `employee_import`
- `leave_entitlement_import`
- `document_requirement_import`

Flow:

1. Template list
2. Download sample CSV
3. Upload CSV for preview
4. Show row-level validation
5. Confirm import
6. Show partial success and failed rows

### Reports

Supported report keys:

- `employee_directory`
- `document_compliance`
- `leave_balances`
- `leave_requests`
- `attendance_summary`
- `attendance_exceptions`

Pattern:

- Report registry
- Report detail table
- Filter panel
- CSV export

### Notifications

Pattern:

- Topbar unread count
- Notification drawer
- Category/status filters
- Mark read
- Mark all read

### Governance

Use:

- Audit logs for low-level technical records
- Activity feed for human-readable timelines

Screens:

- Governance/audit page
- Employee activity tab
- Activity filters and compact metadata rows

## Build Quality Checklist

Before finishing any screen:

- Build passes with `npm.cmd run build`.
- Lint passes or only known unrelated warnings remain.
- Screen works at desktop and mobile widths.
- Text does not overflow containers.
- Loading state exists.
- Empty state exists.
- Error state exists.
- Permission state exists if applicable.
- Forms map backend validation errors.
- Actions invalidate relevant TanStack Query keys.
- Navigation respects modules and permissions.
- UI uses existing tokens/components.
- No fake links, fake data, or unsupported features.
- No production-visible dev credentials.
- No copy that narrows Valtireo to HRMS unless the screen is explicitly inside HR.
- Colors, type, and logo usage match the Brand and Design System section above.

## Current Improvement Approach

Improve one page at a time.

For each page:

1. Understand the product role of the page.
2. Read existing code and relevant backend resources.
3. Check API shape from Postman and backend resources/services.
4. Improve UX, layout, copy, states, and integration.
5. Keep changes scoped.
6. Build and lint.
7. Review visually.
8. Move to the next page only after the current page feels product-ready.

## Important Product Reminder

The HR MVP is the current milestone.

Valtireo is the broader product.

Frontend pages inside HR can be HR-specific. Product identity, app shell, login, dashboard framing, module architecture, and design language should communicate the larger Organizational OS vision.
