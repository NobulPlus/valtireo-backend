# 10 — Home Experience and Information Architecture Audit

Status: **Audit for review. No code changed.** Read-only research across `server/`,
`client/`, and `mobile/`, delegated to four parallel research passes and synthesized here.
This audit expands the Home redesign beyond visual styling — the objective is the most
useful Home experience for Employees and, where the backend already supports it, Managers,
not a rearrangement of the existing cards. Nothing in this file or its companions
([11](11-home-information-architecture.md), [12](12-home-expansion-plan.md)) is
implemented. Per the brief that commissioned it: present for approval before any
implementation begins.

## How to read this file

Each opportunity area below is evaluated against the six required criteria: (1) exact
existing backend endpoint and mobile navigation destination, (2) implementation status,
(3) subscription/permission/visibility rules, (4) importance and recommended Home
position, (5) additional API calls / performance / empty-error-state considerations, (6)
duplication risk. File:line citations are preserved exactly as the research found them, so
every claim here can be checked directly against the code.

## Cross-cutting finding: "manager" is not one thing in this backend

Before the per-feature evaluation, one finding shapes everything below: this product has
**two unrelated permission axes** that both sound like "manager" but are not interchangeable:

- **People-manager scope** — `has_manager_scope`, computed `$employee !== null &&
  $user->can('employees.view_team')` (`server/app/Services/DashboardService.php:772-777`),
  sent on every session payload (`AuthController.php:290`) but **parsed and never read
  anywhere in mobile** (`mobile/src/context/AuthContext.tsx:59`,
  `mobile/src/types/api.ts:123` — confirmed by grep, exactly two occurrences, zero
  consumers). This is the same "modeled but dead" pattern already documented for
  `logo_url`/`theme` in [05](05-organization-branding-compatibility.md) — a second dead
  field with the same shape of problem.
- **Service-desk agent scope** — `service_desk.view`, an operational permission for
  ticket-queue/reporting access (`server/app/Http/Controllers/Api/TicketController.php`),
  unrelated to whether someone manages people. A service-desk agent may have no direct
  reports; a people-manager may hold no service-desk permission at all.

**This audit treats "Manager Home" as the people-manager axis (`has_manager_scope`)
only**, per the brief's own phrasing ("Employees and, where supported, Managers"). Service
desk status is evaluated separately below, for employees generally, not folded into the
Manager IA.

## Cross-cutting finding: actionable tasks vs. informational statuses

A second taxonomy applies across every item below, corrected into this revision:
**actionable** content is something the signed-in person can resolve or act on by tapping
it (it has a real destination and a real next step); **informational** content is a status
or summary with no implied action (nothing is "wrong" or "waiting" just because the card
exists). Conflating the two — rendering a summary number as if it were a task, or an
actual task as flat unclickable text — is itself a usability defect independent of any
individual feature's readiness. Applied per item below:

- **Actionable**: pending actions (item 1, once tappable), notification deep-links
  (item 6), the holiday card's tap-through (item 7, the action is "see the full calendar,"
  not resolve something, but it is a real navigable action rather than a dead end),
  approvals (item 10 — but see that item's note on why it's being built later and
  separately, not bundled with the informational card below).
- **Informational**: stats row, attendance exceptions, document compliance status (the
  *list* is informational even though the underlying documents may separately need
  action via the Documents screen), leave balances, the Lifestyle card (item 8 — a
  deliberate "no implied action" card per its own entry), and the manager "Team at a
  glance" card (item 10's dashboard aggregate — read-only summary data, explicitly not a
  task list).

This distinction drives [11](11-home-information-architecture.md)'s proposed ordering:
actionable content is placed ahead of informational content, not interleaved by feature
area or by who it's for.

## Opportunity-by-opportunity evaluation

### 1. Actionable pending tasks and document compliance

- **Endpoint / destination**: `GET /dashboard/me` → `DashboardController::me`
  (`server/app/Http/Controllers/Api/DashboardController.php:24-27`) →
  `DashboardService::pendingActions()` (`DashboardService.php:846-890`), returning a keyed
  list: `complete_profile`, `profile_approval`, `leave_approval`, `leave_handover_cover`,
  `ticket_pending`. Already rendered on mobile Home as plain bullet text
  (`HomeScreen.tsx` "Needs your attention" card). Document compliance: `GET
  /documents/compliance` and the same-shaped `document_compliance` array already on
  `/dashboard/me`, computed by `DocumentComplianceService::complianceState()`
  (`server/app/Services/DocumentComplianceService.php:441-459`, the exact
  missing/expired/expiring_soon/pending_acknowledgment/awaiting_signature/rejected/
  changes_requested state machine already surfaced on Home today).
- **Status**: **Fully implemented** on both sides for the data itself. **Partially
  implemented** for the interaction: pending-action items render as static text with no
  `onPress` — nothing deep-links to the screen that would resolve the action.
- **Access rules**: no module gate beyond auth; scoped to the signed-in employee only
  (self-scoped, not manager-visible) for all five keys, including `leave_approval`.
  **`leave_approval`'s meaning is now confirmed directly from source**:
  `DashboardService.php:864-868` sets it when
  `$employee->leaveRequests()->where('status', 'submitted')->exists()`, with the label
  *"Your leave request is awaiting approval."* — this means **the employee's own leave
  request is awaiting someone else's approval**, not "you have approvals waiting for you
  to act on." The earlier draft of this audit flagged this key as needing verification
  before any deep-link was wired; that verification is now done, and the correct,
  safe deep-link destination for this key is the Leave screen (showing the employee's own
  request status) — it never implies or requires a manager-approval screen, so it carries
  no dependency on §10's manager work.
- **Importance & position**: High — this is the single highest-value, lowest-risk
  improvement available (same data, same card, just tappable). Recommended position:
  unchanged (top of the conditional stack, as today).
- **Additional considerations**: Zero new API calls — wiring `onPress` per `action.key` to
  the already-built destination screens (Profile for `complete_profile`/
  `profile_approval`, Leave for `leave_approval`/`leave_handover_cover`, Tickets tab for
  `ticket_pending`) is pure navigation code, and every one of the five keys now has a
  confirmed, existing destination. No new empty/error states beyond what the card already
  handles (the card doesn't render when the array is empty, unchanged).
- **Duplication risk**: None — this improves the existing card in place, no new surface.

### 2. Profile completion and onboarding

- **Endpoint / destination**: Covered by `pendingActions()` above (`complete_profile`/
  `profile_approval` keys) plus `EmployeeProfile.completion_status`
  (`pending`/`submitted`/`approved`, referenced throughout `DashboardService.php` e.g.
  120-123, 212-219). No separate "onboarding checklist" endpoint exists for an individual
  employee — the organization-setup checklist (`GET /setup/checklist` →
  `SetupChecklistController`) is an **admin-only, org-configuration** checklist
  (departments/roles/etc. configured), not an employee onboarding concept; do not conflate
  the two.
- **Status**: **Fully implemented** as a *signal* (the pending-actions keys above are the
  closest thing to an onboarding checklist today). **No new development needed** to
  surface it better — see item 1, same fix covers this.
- **Access rules**: self-scoped only, no manager visibility into another employee's
  onboarding progress via this path (the admin-facing
  `GET /employees/{employee}/profile-overview` and `PATCH
  /employees/{employee}/approve-onboarding` are `employees.view`/`employees.update`-gated —
  an HR/admin permission tier, not the people-manager `has_manager_scope` tier — see the
  cross-cutting finding above; this stays out of scope for a Manager Home).
- **Importance & position**: Covered by item 1 — no separate card recommended.
- **Additional considerations**: none beyond item 1.
- **Duplication risk**: Building a separate "onboarding progress" card would duplicate the
  pending-actions card for no benefit — not recommended.

### 3. Leave requests, balances, and handover assignments

- **Endpoint / destination**: `GET /leave/requests`, `/leave/types`, `/leave/periods`,
  `/leave/holidays` — mobile's `mobile/src/features/leave/api.ts:16-127` already wraps
  all of these. Leave already has its own bottom tab (`LeaveStack.tsx`, `MainTabs.tsx:76`)
  — deliberately **excluded** from Home's Quick Access by existing design
  (`HomeScreen.tsx` comment: "Leave, Attendance and Tickets already have their own bottom
  tab... repeating them here would just be the same destination behind a second button").
  Balances and handover assignments are already full Home cards today
  (`HomeScreen.tsx`, "Leave balances"/"Covering for a colleague").
- **Status**: **Fully implemented**, both the tab and the two Home cards.
- **Access rules**: `leave_requests.view`/`leave_requests.create`, scoped via
  `EmployeeVisibility::ids()` (`server/app/Services/EmployeeVisibility.php:18-44`) — this
  shared service is what gives Leave (and Attendance, and Documents) a **manager-scope for
  free**: when the caller holds `employees.view_team`, the same index endpoint already
  returns the team's data, not a separate manager endpoint.
- **Importance & position**: No change recommended for Employee Home — the existing
  exclusion-from-Quick-Access rationale is sound and avoids redundant navigation.
  **Manager opportunity**: see [11](11-home-information-architecture.md)'s Manager IA —
  team leave data is already aggregated cheaply at `/dashboard/manager` (see item 10).
- **Additional considerations**: none for the employee side.
- **Duplication risk**: Adding a Leave Quick Access tile would duplicate the existing tab
  — explicitly not recommended, consistent with the codebase's own stated reasoning.

### 4. Attendance, corrections, and exceptions

- **Endpoint / destination**: `GET /attendance/records`, `/attendance/corrections` —
  `mobile/src/features/attendance/api.ts:6-26`. Own bottom tab
  (`AttendanceStack.tsx`/`MainTabs.tsx:77`), same exclusion-from-Quick-Access rationale as
  Leave. Exceptions already surfaced in the existing "Attendance this month" Home card.
- **Status**: **Fully implemented.**
- **Access rules**: `attendance.view`/`attendance.create`, same `EmployeeVisibility`
  manager-scope mechanism as Leave — confirmed cheap and already manager-aggregated at
  `DashboardService::attendanceMetricsForEmployees()` (`DashboardService.php:955-965`,
  `count()`/`sum()` aggregates, no N+1).
- **Importance & position**: No change for Employee Home. **Manager opportunity**: see
  item 10 — already in `/dashboard/manager`'s payload.
- **Additional considerations**: none.
- **Duplication risk**: None (unchanged).

### 5. Service desk status and quick actions

- **Endpoint / destination**: `GET /tickets` — `mobile/src/features/tickets/api.ts:10`.
  Own bottom tab (`TicketsStack.tsx`/`MainTabs.tsx:78`), excluded from Quick Access by the
  same existing rationale. The generic "Needs your attention" card's `ticket_pending`
  boolean (item 1) is the only ticket-adjacent Home content today.
- **Status**: **Fully implemented** for an individual employee's own tickets. **No cheap
  count endpoint exists for a plain employee** — `TicketReportingService`'s aggregate
  counts are gated by `service_desk.view` only (an agent/admin permission), so an
  employee-facing "my open tickets: 2" badge would require fetching the full paginated
  list and counting client-side (not currently done, and not recommended without a
  backend count endpoint — see [12](12-home-expansion-plan.md) phase list).
- **Access rules**: `service_desk.view` (agent/admin, org-wide queue) OR `service_desk.create`
  (self-scoped, merges raised-by-me and assigned-to-me into one undifferentiated list when
  the caller lacks `service_desk.view` —
  `server/app/Http/Controllers/Api/TicketController.php:110-130`). **No people-manager
  scope exists for tickets at all** — this is a binary self-vs-org-wide-agent gate, not a
  team-scope, confirmed by the backend research finding no `EmployeeVisibility` usage in
  `TicketController`.
- **Importance & position**: Low for Employee Home — the tab already covers it and no
  change is recommended. **Not recommended for Manager Home** either, because
  `service_desk.view` is the agent-permission axis, not the people-manager axis (see the
  cross-cutting finding) — a people-manager with no service-desk role would see an empty
  or misleading card.
- **Additional considerations**: A manager-scoped ticket view ("my team's tickets") would
  require new backend development (adding team-scoping to `TicketController::index`) —
  explicitly flagged as **requires new development**, not a mobile-only change.
- **Duplication risk**: A Home ticket tile would duplicate the Tickets tab — not
  recommended.

### 6. Notifications and deep linking

- **Endpoint / destination**: `GET /notifications/unread-count` (cheap, single `COUNT`
  query, `server/app/Http/Controllers/Api/NotificationController.php:37-42`) — already the
  one domain with a true count hook, already surfaced as the bell badge on Home
  (`mobile/src/features/notifications/api.ts:6`, polled every 60s,
  `HomeScreen.tsx` bell icon). The notification payload already carries real deep-link
  fields: `action_url`, `action_label`, `entity_type`, `entity_id`, `metadata`
  (`NotificationController.php:70-88`), with a full catalogue of real relative paths
  already generated server-side (e.g. `/service-desk?ticket={id}`, `/me/leave`,
  `/me/lifestyle`, `/approvals/{id}`, `/calendar` —
  `server/app/Services/NotificationDispatchService.php`, multiple methods).
- **Status**: **Partially implemented.** The count and the data model are fully built and
  already consumed; the deep-link itself is **not** — `NotificationsScreen.tsx` only reads
  `severity` and shows a flat list, never reads `action_url`/`entity_type`/`entity_id`
  (confirmed by grep against the screen). Tapping a notification today does not navigate
  to the thing it's about.
- **Access rules**: none beyond auth — notifications are always self-scoped
  (`$request->user()->notifications()`), no module gate, no permission string.
- **Importance & position**: High — this is the second-highest-value, close-to-zero-new-
  backend-work improvement identified (same reasoning as item 1: the data already exists,
  only the client-side mapping is missing). No new Home card — this improves the existing
  bell/notification-list flow.
- **Additional considerations**: Needs a small, genuinely new piece of mobile code: a
  pure `action_url`/`entity_type` → navigation-target mapping function (recommend writing
  it as an isolated, unit-testable function per this session's established pattern — see
  `mobile/src/lib/biometricErrorPresentation.ts` for the precedent of extracting exactly
  this kind of decision logic out of a screen component so it can be tested without
  rendering). The web app's `action_url` paths (e.g. `/service-desk?ticket={id}`) are
  web-route shaped, not mobile-stack shaped — the mapping function needs to translate web
  paths to mobile stack/screen/params, not assume they're directly usable. Empty/error
  state: an unrecognized `action_url` pattern should fail safe (stay on the notification
  list, do nothing) rather than crash or navigate somewhere wrong.
- **Duplication risk**: None — this is a behavior fix to an existing flow.

### 7. Upcoming holidays and company events

- **Endpoint / destination**: `GET /leave/holidays` (plain list,
  `server/app/Http/Controllers/Api/LeaveHolidayController.php:16-28`). The "next holiday"
  + `days_away` computation mobile Home already shows comes from
  `DashboardService::nextHoliday()` (`DashboardService.php:1037-1065`, an in-memory scan
  over all active holidays, re-anchoring recurring dates to the current year). Company
  events are a **separate** backend concept (`CompanyEventController`,
  `routes/api.php:242-247`) with their own notification dispatch (`action_url: /calendar`)
  — not currently surfaced on the Home card at all (only statutory holidays are). Full
  Calendar screen exists on mobile (`CalendarScreen.tsx`, via `useAgenda` which already
  composes leave + company events + holidays, `mobile/src/features/calendar/api.ts:37`) —
  but is buried in the More menu, with **no tap-through from the Home holiday card today**.
- **Status**: **Fully implemented** for the data (holiday card content, and the fuller
  agenda screen). **Partially implemented** for the IA: the Home card is a dead end
  (no `onPress`) when a full Calendar screen showing the same and more already exists one
  tap away in the nav tree.
- **Access rules**: `leave_requests.view`/`leave_requests.create` for holidays; Calendar's
  `useAgenda` additionally gates leave/holiday inclusion on `moduleByKey('leave')`
  (`mobile/src/features/calendar/api.ts:40`) but the screen itself has no module gate
  (`MoreMenuScreen.tsx` `module: null`).
- **Importance & position**: Medium — low effort (add `onPress` → navigate to Calendar),
  meaningful improvement (the destination screen already shows the fuller event picture
  including company events, which the Home card currently omits entirely).
- **Additional considerations**: Zero new API calls. `DashboardService::nextHoliday()`'s
  in-memory full-table scan is cheap at typical org holiday-table sizes (<50 rows) — flagged
  as a note, not a blocker.
- **Duplication risk**: None — this connects two already-built surfaces that currently
  don't know about each other.

### 8. Birthdays, anniversaries, and employee appreciation

- **Endpoint / destination**: `GET /lifestyle/milestones` (upcoming birthdays/
  anniversaries, opt-in per person, leap-year-safe —
  `server/app/Services/EmployeeLifestyleService.php:45-76`) and `GET
  /lifestyle/appreciations?scope=received` (appreciation messages sent to me —
  `server/app/Http/Controllers/Api/EmployeeLifestyleController.php:67-81`). Mobile already
  has both hooks built and working (`mobile/src/features/lifestyle/api.ts:28,46`), consumed
  by `LifestyleScreen.tsx` — but **Lifestyle has no presence on Home at all**: no Quick
  Access tile, no header icon, no card. It's reachable only via More menu → Lifestyle. The
  only Home-adjacent content is the tenure line in "My role" (years of service), which is
  dashboard data, not a link into Lifestyle.
- **Status**: **Fully implemented**, backend and mobile hooks both — this is purely a
  Home-IA gap, not a development gap.
- **Access rules**: Gated by org-level feature flags, `lifestyle.milestones_enabled` /
  `lifestyle.appreciation_enabled` (`EmployeeLifestyleService::enabled()`,
  `EmployeeLifestyleService.php:28-31`), already fetched via
  `useLifestylePreferences` (`mobile/src/features/lifestyle/api.ts:8`) and checked by
  `LifestyleScreen.tsx:116-117` — the same flags should gate a new Home card.
  Per-person opt-in (`share_birthday`/`share_anniversary`/`receive_appreciation`) is
  already enforced server-side.
- **Importance & position**: High — explicitly named in the brief, fully backend-ready,
  and currently invisible on Home despite being one tap of hook-reuse away. Recommended
  position: a new card below the existing "Leave balances"/"Next holiday" cluster (same
  visual tier as those, not Quick Access — it's informational, not a navigation shortcut).
- **Additional considerations**: Two separate calls needed (`useMilestones` +
  `useAppreciations`) — no combined endpoint exists, so this card does its own light
  client-side aggregation (take the nearest upcoming milestone, show an appreciation-count
  teaser). Empty state: card doesn't render if both calls return empty or the feature
  flags are off (same pattern as every other conditional Home card today). No pagination
  concern — `milestones()` has no cap today, acceptable at typical org sizes per the
  backend research, worth a note for future scale.
- **Duplication risk**: None — net-new surface for data that already flows elsewhere but
  isn't visible from Home.

### 9. Payslips and assigned assets

- **Endpoint / destination**: `GET /payroll/me/payslips`, `/payroll/me/compensation` —
  `mobile/src/features/payroll/api.ts:7-14`. `GET /assets` (self-scoped) —
  `mobile/src/features/assets/api.ts:6`. Both already Quick Access tiles on Home today.
- **Status**: **Fully implemented** for the employee's own data, both backend and mobile.
  Note: `useMyCompensation` (`payroll/api.ts:7`) has **zero screen consumers anywhere** on
  mobile — a built, unused hook (same "dead but ready" pattern as `has_manager_scope` and
  the notification deep-link fields).
- **Access rules**: `payroll.payslips.view_own`/`payroll.compensation.view_own`, strictly
  self-keyed (`$request->user()->employee`) — **no manager-scope exists for payroll at
  all**, confirmed absent (not merely unexplored): there is no permission or query path
  between "my own payslip" and the org-wide admin `payroll.runs.view` tier. Same for
  Assets — `AssetController::index` is a strict binary (`assets.view` sees everything,
  otherwise self-only), **no team-scope exists**, confirmed by its not using
  `EmployeeVisibility` at all (unlike Leave/Attendance/Documents).
- **Importance & position**: No change recommended for Employee Home (already well
  covered). **Not available for Manager Home without new backend development** — flagged
  explicitly in [11](11-home-information-architecture.md)'s Manager IA as a confirmed gap,
  not a "needs more research" item.
- **Additional considerations**: none for the employee side.
- **Duplication risk**: None (unchanged).

### 10. Team summaries, approvals, and manager responsibilities

- **Endpoint / destination**: `GET /dashboard/manager` →
  `DashboardController::manager` → `DashboardService::manager()`
  (`server/app/Services/DashboardService.php:90-174`) — **this already exists and is
  already consumed on web** (`client/src/features/dashboard/ManagerDashboardView.tsx`, via
  `useManagerDashboard`, `client/src/features/dashboard/api.ts:39-44`). It scopes employees
  by department/cluster/direct-reports and returns `count()`/`sum()` aggregates for leave
  and attendance — genuinely cheap, no N+1. **Mobile has zero equivalent** — no hook, no
  screen, nothing (confirmed: grep for `manager`/`approve`/`team`/`direct_report` across
  `mobile/src` returns no manager-facing code anywhere).
- **Status**: **Fully implemented on the backend and on web. Requires new mobile
  development only** — porting an existing, proven pattern, not inventing one. This is the
  single best-positioned "new" feature in this entire audit.
- **Access rules**: Gated by `has_manager_scope` (`employees.view_team`) or
  `reports.view` + department filter for broader org visibility
  (`DashboardService.php:694-722`). **Recommend mobile's first version use the narrower
  `has_manager_scope` default only — no department picker** (web's broader
  `ManagerDashboardView.tsx:111-121` department-browse capability should not be
  replicated on a Home card without an equivalent, deliberate UI affordance for choosing
  scope — see [12](12-home-expansion-plan.md)'s security test plan).
- **Approvals** (deliberately separated from the above, revised this pass): the generic
  workflow engine (`ApprovalRequestService`/`ApprovalVisibility`) already has real
  manager-scope logic — `direct_manager`/`department_head` step-type checks
  (`server/app/Services/ApprovalRequestService.php:179-201`,
  `ApprovalVisibility.php:36-53`) — confirming a manager really can approve their own
  reports' requests today, via `POST /approvals/{id}/actions`. **No cheap pending-count
  endpoint exists** — a manager-facing "3 approvals waiting" badge would call
  `GET /approvals?status=pending` and read `.meta.total`. An earlier draft of this audit
  treated this as "not ideal but good enough to bundle into the first manager-dashboard
  card." **That bundling is now explicitly undone**: Approvals is an *actionable* feature
  (per the taxonomy above) being proposed for a mobile surface that has never had any
  approval-acting code before, against an endpoint whose authorization behavior
  (`ensureActorCanApproveStep()`) and list-filtering (`ApprovalVisibility::query()`) have
  only been read, not exercised, from mobile. It is held out of the initial manager-home
  implementation as its own, later, separately-approved phase — see
  [12](12-home-expansion-plan.md)'s phase list — pending direct verification that the
  authorization and API behavior work as read before any mobile UI commits to them.
- **Importance & position**: The **Team at a glance** aggregate (informational, read-only,
  per the taxonomy above) is High, conditional on `has_manager_scope`. Per the ordering
  correction in [11](11-home-information-architecture.md), it sits **after** the
  employee's own actionable pending-actions card, not above it — an urgent personal task
  (e.g. "complete your profile," "your leave needs attention") outranks a manager's team
  summary even on a manager's own Home. Zero layout impact for the majority non-manager
  audience either way (see [12](12-home-expansion-plan.md)'s accessibility/regression
  notes on the "hidden element still reserves space" risk class). Approvals has no
  position yet — it isn't part of this phase.
- **Additional considerations**: One new mobile hook (`useManagerDashboard`, mirroring the
  web pattern against the same endpothat already exists), one new conditional Home card.
  Empty state: a manager with zero direct reports / an empty team should see nothing (card
  doesn't render), not a zeroed-out card.
- **Duplication risk**: None — net-new surface, explicitly ported from a working web
  precedent rather than designed from scratch.

## Net summary: readiness at a glance

| Opportunity | Backend | Mobile | Home IA gap |
|---|---|---|---|
| Pending actions deep-linking | Ready | Needs wiring | Yes — static text today |
| Profile completion/onboarding | Ready (via pending actions) | Covered by above | No separate card needed |
| Leave balances/handover | Ready | Ready | None (by design) |
| Attendance exceptions | Ready | Ready | None (by design) |
| Service desk (employee) | Ready | Ready | None (by design) |
| Service desk (manager-scoped) | **Requires new backend dev** | N/A | N/A |
| Notification deep-linking | Ready | Needs new mapping code | Yes — fields unused |
| Holiday → Calendar tap-through | Ready | Needs `onPress` wiring | Yes — dead-end card |
| Birthdays/anniversaries/appreciation | Ready | Ready (hooks exist) | Yes — zero Home presence |
| Payslips/assets (employee) | Ready | Ready | None (unchanged) |
| Payslips/assets (manager-scoped) | **Requires new backend dev** | N/A | N/A |
| Team leave/attendance (manager), informational | Ready (`/dashboard/manager`) | **Requires new mobile dev** | Yes — zero mobile presence, ordered after personal actionable items |
| Approvals (manager), actionable | Ready (no cheap count) | **Requires new mobile dev — separate, later phase** | Yes — deliberately deferred pending auth/API verification, not bundled into the initial manager dashboard |

Continued in [11-home-information-architecture.md](11-home-information-architecture.md)
(current-vs-proposed structure, Employee IA, Manager IA) and
[12-home-expansion-plan.md](12-home-expansion-plan.md) (phases, responsiveness/
accessibility, regression/security test plan).
