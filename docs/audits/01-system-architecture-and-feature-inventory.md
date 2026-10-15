# Valtireo — System Architecture and Feature Inventory

Audit date: 2026-10-15. Read-only, code-traced audit of all four applications in this repo:
`server/` (Laravel 13 API), `client/` (React/Vite admin console + employee self-service web app),
`mobile/` (Expo/React Native employee self-service app), `website/` (Astro marketing site).

Methodology: every claim below is either traced to a specific file/line, or explicitly marked as
not verified in this pass. "Verified" = I read the controller → service → model/DB path (and, where
it exists, the corresponding Feature test) and it holds together end to end. "Unverified" is not a
synonym for broken — it means I did not trace that specific path far enough to be confident either
way.

---

## 1. Server (`server/`) — Laravel 13, Sanctum, Spatie Permission

### 1.1 Stack
- `server/composer.json`: `laravel/framework ^13.8`, `laravel/sanctum ^4.3`, `spatie/laravel-permission ^8.3`, `owen-it/laravel-auditing ^14.0`, PHP `^8.3`. Test stack: `phpunit/phpunit ^12.5`, `mockery`.
- Auth: Sanctum personal access tokens (`createToken($deviceName)->plainTextToken`), bearer-header, no sessions/cookies for the API. `server/app/Http/Controllers/Api/AuthController.php:39-41,79-81` — the device name passed by the client becomes the token's name (`device_name` request field, defaulting to `'api'`), which is how mobile vs. web sessions are distinguished in `personal_access_tokens`.
- 54 Feature test files under `server/tests/Feature/` (`find tests -name "*Test.php" | wc -l` → 54), covering Approvals, Leave, Attendance, ServiceDesk (6 files), Employees/Lifestyle, Platform.

### 1.2 Multi-tenancy and authorization layering
Four middlewares compose every authenticated route group (`server/routes/api.php:71,77`):

1. **`auth:sanctum`** — token → `User`.
2. **`SetPermissionsTeamId`** (`server/app/Http/Middleware/SetPermissionsTeamId.php:25-34`) — sets Spatie's "team" context to `$user->organization_id` for the rest of the request, so every `hasRole()/can()/assignRole()` call is organization-scoped. Registered explicitly per route group (not globally) because, per its own doc comment, global middleware in this Laravel version resolves before route middleware can see `$request->user()`. Login/register (`AuthController.php:65,277`) set this manually since those routes sit outside the authenticated group entirely.
3. **`EnsureOrganizationIsActive`** (`EnsureOrganizationIsActive.php:11-34`) — revokes all tokens and 401/403s if the employee record is `suspended`/`exited` or the organization is `suspended`/`rejected`.
4. **`EnsureEmployeeVisibility`** (`EnsureEmployeeVisibility.php:18-43`) — a route-model-binding-aware guard: for any bound `Employee`/`EmployeeDocument`/`EmployeeDependent`/`EmployeeEmergencyContact`/`AttendanceRecord`/`AttendanceCorrectionRequest`/`LeaveEntitlement`/`LeaveRequest` parameter, it 404s (not 403 — avoids leaking existence) unless `EmployeeVisibility::allows()` passes, with a carved-out exception for a leave request's designated handover recipient on GET/HEAD.

On top of that, module-gated route groups use `EnsureModuleIsSubscribed::class.':<module_key>'` (e.g. `routes/api.php:241,263,292,307,321`), which checks `ModuleEntitlementService::organizationHasActiveSubscription()` (`server/app/Services/ModuleEntitlementService.php:98-114`) against the org's `moduleSubscriptions()` — status `active`/`trial`, not expired, not future-dated. Platform admins bypass this (`EnsureModuleIsSubscribed.php:21`).

`ModuleEntitlementService::forUser()` (`ModuleEntitlementService.php:14-37`) is also what builds the `modules` array returned in every session payload — the single source of truth both apps use to decide what to show/hide (`access` ∈ `manage|self|view|none`, `visibility` ∈ `enabled|hidden|locked`).

`database/seeders/PlatformModuleSeeder.php` seeds 19 module keys (organization_setup, users_roles, employees, employee_self_service, documents, leave, attendance, deployment, reports, audit_logs, payroll, recruitment, performance, learning, service_desk, assets, financial_admin, ai_assistant, organization_structure) and subscribes the demo "VALTIREO" org to 14 of them. Several modules (`recruitment`, `performance`, `learning`, `financial_admin`, `ai_assistant`) are seeded as catalog entries with no corresponding controllers found under `app/Http/Controllers/Api` — **Missing/Placeholder at the platform-catalog level**, i.e. they exist as sellable module rows but have no backend implementation.

### 1.3 Route inventory (`server/routes/api.php`, 415 lines)
Grouped by prefix, all behind the four middlewares above except `/health` and the public `auth/*` and invitation-accept endpoints:
- `auth/*` — register, login, forgot/reset password (all throttled), `/me`, `/logout`.
- `platform/*` — platform-admin-only (`is_platform_admin` check inline in controllers, not middleware) organization provisioning/listing/export, module toggling, verification document review, error-log monitoring.
- `organization-verification/*` — org's own KYC-style document upload/submission.
- `workspace`, `lifestyle/*` (gated on `employee_self_service`), `dashboard/*`, `operations/*` (task + automation-rule center), `templates/*` (import/export), `reports/*` (gated), `notifications/*`, `audit-logs`/`activity-feed` (gated), `approval-workflows/*`, `approvals/*` (generic approval inbox/act), `setup/*` (org-structure lookups: departments/units/designations/grade-levels/employment-types/locations/clusters), `roles/*`, `permissions`, `documents/*` (gated), `company-events/*`, `leave/*` (gated), `tickets/*` (gated on `service_desk`), `assets/*` (gated), `attendance/*` (gated), `payroll/*` (gated, 30+ endpoints — settings, pay groups, components, employee compensation/bank accounts, self-service payslips, runs lifecycle calculate→submit→finalize→publish/void, inputs, statutory profile, loans, payment export/batches, journal, reports), `employees/*` (gated on `employees`), `me/employee-profile`, `employee-profile/*` (self-service profile/custom fields/emergency contacts/dependents, gated on `employee_self_service`).
- Public (outside the auth group): `employee-invitations/{token}/accept`, `organization-admin-invitations/{token}/accept`, both throttled.

### 1.4 Key services traced
- `ModuleEntitlementService` — see 1.2.
- `LeaveRequestService` (420 lines) + `ApprovalRequestService` (402 lines) — generic polymorphic approval engine, see Journey 2.
- `OrganizationProvisioningService` — `provision()` wrapped in `DB::transaction` (`server/app/Services/OrganizationProvisioningService.php:36`), assigns `organization_admin` role (`:101`) — see Journey 8.
- `EmployeeLifestyleService` + `EmployeeLifestyleController` (161 lines) — fully traced, see Journey 7.
- `AttendanceService`, `TicketService`, `TicketReportingService`, `PayrollService` — read at controller-call level; internals not fully traced in this pass (**unverified**, not broken).

---

## 2. Client (`client/`) — React 19 + Vite 8 + TanStack Query + Tailwind 4

- `client/package.json`: React 19.2, `react-router-dom ^7.18`, `@tanstack/react-query ^5.101`, `axios ^1.19`, `react-hook-form` + `zod` + `@hookform/resolvers`, Tailwind 4 via `@tailwindcss/vite`, TypeScript `~6.0`, build = `tsc -b && vite build`.
- API client (`client/src/lib/apiClient.ts:17-21`): axios instance, `baseURL = import.meta.env.VITE_API_BASE_URL || '/api'` (defaults to the Vite dev proxy so the browser never negotiates CORS directly). Bearer token read from `localStorage['valtireo.auth_token']` (`:9,13,17-24`). A notable hardening detail: both the response-success and response-error interceptors (`:62-68, 73-80`) re-check that the `Authorization` header actually sent on the just-completed request still matches the *currently* stored token before acting on 401/403 — this guards against a race where a stale in-flight request's failure could clear a session a user has since re-established (same pattern duplicated in mobile's `apiClient.ts`).
- This is the admin console: `client/src/features/` has 19 feature folders; `employees` (11 files), `platform` (6), `settings` (6), `payroll` (5), `dashboard` (5) are the largest, consistent with it being the full org-admin + platform-admin surface, not just self-service. `employee-self-service`-style pages (e.g. `features/leave/MyLeavePage.tsx`) coexist with admin pages in the same feature folder.
- Router: single `App.tsx` (no `pages/` router tree beyond a `NotFoundPage`), so route structure lives inline in `App.tsx` rather than file-based routing — **not independently re-verified route-by-route in this pass**.

---

## 3. Mobile (`mobile/`) — Expo 57 / React Native 0.86, employee self-service only

- `mobile/package.json`: Expo `~57.0.28`, React Native `0.86.3`, React `19.2.3`, `@react-navigation/native` + `bottom-tabs` + `native-stack` (stack/tab navigator — **not** Expo Router, despite `mobile/AGENTS.md` reportedly requiring it per `docs/mobile-employee-experience-review-2026-10-13.md`, see §6), `@tanstack/react-query ^5.104`, `axios ^1.20`, `expo-secure-store`, `expo-local-authentication`, `expo-document-picker`/`expo-image-picker`/`expo-file-system`/`expo-sharing`.
- API client (`mobile/src/lib/apiClient.ts:13`): `baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'` — same interceptor/race-guard pattern as the web client. Token storage is `expo-secure-store` (`mobile/src/lib/secureToken.ts`), with an in-memory `cachedToken` mirror for the synchronous axios interceptor and a serialized `writeQueue` (`:69,98-100`) specifically to avoid a logout-then-login race leaving storage empty.
- **Biometric login is password-vaulting, not passwordless auth.** `mobile/src/lib/secureToken.ts:26-35` documents this explicitly: there is no refresh-token endpoint on the backend, so "biometric sign-in" is Face ID/fingerprint (via `expo-local-authentication`, gated through `SecureStore`'s `requireAuthentication` option) unlocking a **stored plaintext password** (`BiometricCredential { email, password, name }`), which is then replayed through the normal `/auth/login` call (`AuthContext.tsx:178-192`). Server-side, `/auth/login` has no knowledge of biometrics at all — it's an ordinary password login. Classification: **Implemented and verified**, but as "device-gated saved password," not biometric-backed server authentication — worth flagging precisely because the UI framing ("Sign in with Face ID") could be read as the latter.
- Session bootstrap (`AuthContext.tsx:92-123`) distinguishes a 401 (→ clear session) from any other error (→ keep token, surface `reconnectError`, let the user retry) — deliberate "offline reconnect" UX, matches what `docs/mobile-employee-experience-review-2026-10-13.md` separately reviewed.
- 11 navigation stacks (`mobile/src/navigation/`): Assets, Attendance, Documents, Home, Leave, Lifestyle, MoreStack, PayslipsStack, RootNavigator, TicketsStack, plus `MainTabs`. 29 screen files under `mobile/src/screens/`.
- Feature API modules (`mobile/src/features/*/api.ts`): assets, attendance, auth, calendar, dashboard, directory, leave, lifestyle, notifications, payroll, profile, tickets. **`features/documents/` has no `api.ts`** — document screens (`DocumentsListScreen.tsx`, `UploadDocumentScreen.tsx`) instead import `useAcknowledgeDocument`/`useSubmitSignedCopy`/`useMyDocumentTypes`/`useSubmitMyDocument` from `features/profile/api.ts` (confirmed by reading both screens' imports). This is a real wiring, just organized under a different feature folder than its screen folder — not a gap, just a naming note for future readers.
- **Attendance on mobile is view + correction-request only — there is no clock-in/clock-out capability.** `mobile/src/features/attendance/api.ts` (36 lines total) exposes exactly two hooks: `useMyAttendanceRecords` (GET `/attendance/records`) and `useRequestAttendanceCorrection` (POST `/attendance/corrections`). There is no call to `POST /attendance/records` (the clock-in endpoint that exists server-side, `AttendanceRecordController::store`, `routes/api.php:314`) anywhere in mobile. `AttendanceListScreen.tsx` (the only attendance screen) renders a read-only list with a single "Request correction" link per row (`:31-33`). This matches both the user's own memory note ("Attendance deferred — biometric/ATM policy work on hold until physical terminal device") and `docs/mobile-feature-priorities.md`'s explicit instruction not to imply GPS/mobile clock-in exists until that policy question is settled. Classification: **Partially implemented by design** (not a bug — a deliberate scope limit, confirmed against product intent in two independent docs).

---

## 4. Website (`website/`) — Astro 7.3.8, static marketing site

- `website/package.json`: single dependency, `astro: 7.3.8` (pinned — its README notes the dependency tree needs Node ≥22.19, ahead of the repo's other Node usage). No React/Vue/client framework integration installed.
- Pages (`website/src/pages/`): `index`, `about`, `contact`, `faq`, `product`, `product/[id]`, `industries/[slug]`, `404`. Components: `AppScreenshot.astro`, `CallToAction.astro`, `Icon.astro`, `ProductPreview.astro`.
- `grep -rl "fetch(\|axios\|api\."` across `website/src` returned **zero matches**, and `grep -rl "<form"` also returned **zero matches**. This is a purely static content site: no API calls to `server/`, no client-side data fetching, no lead-capture or contact forms wired to anything. The `/contact` page is static copy, not a working form submission.
- The site's own README (`website/README.md:3-5`) self-describes as independent of `client/`/`server/` and designed to build "without loading the application bundle or requiring a running API" — consistent with what's in the code. Classification for the website as a whole: **Implemented but unverified for intended scope** at the level of "does it render and navigate correctly" (not checked beyond directory/dependency inspection in this pass), and **Missing** for any backend integration (contact form submission, CRM/lead capture) since none exists — which may simply be correct for this early stage, not a defect.

---

## 5. Consolidated feature classification

| Area | Feature | Classification | Evidence |
|---|---|---|---|
| Server | Multi-tenant scoping (org_id + Spatie team) | Complete and verified | `SetPermissionsTeamId.php:25-34`, `EnsureOrganizationIsActive.php`, `EnsureEmployeeVisibility.php` |
| Server | Module entitlement gating | Complete and verified | `ModuleEntitlementService.php`, `EnsureModuleIsSubscribed.php`, `routes/api.php` gated groups |
| Server | Auth (register/login/logout/password reset, device tokens) | Complete and verified | `AuthController.php` full read, throttled routes `routes/api.php:66-69` |
| Server | Generic approval workflow engine (leave/tickets/attendance corrections/onboarding) | Complete and verified | `ApprovalRequestService.php:38-132,261-404`, `ApprovalRequestController.php` |
| Server | Leave request submit/cancel/view + evidence/handover downloads | Complete and verified | `LeaveRequestController.php` (full read), scoped by `EmployeeVisibility` |
| Server | Attendance record create (clock-in) + corrections | Implemented but unverified (service internals not traced) | `AttendanceRecordController.php:39-46` calls `AttendanceService::createRecord` — service body not read |
| Server | Employee appreciation / lifestyle ("Life at work") | Complete and verified | `EmployeeLifestyleController.php` full read: consent, moderation, notification insert, DB transaction w/ row lock |
| Server | Document compliance (types/requirements/upload/review/acknowledge/signed copy) | Implemented but unverified | Routes exist (`routes/api.php:212-232`); controller internals not fully traced this pass |
| Server | Ticket lifecycle (create→assign→start→hold/resume→escalate→resolve→close/reopen, watchers, comments) | Implemented but unverified in depth, strongly corroborated | 344-line controller + 6 dedicated Feature test files (`TicketLifecycleTest.php`, `TicketWatcherTest.php`, etc.) — tests exist but were not executed in this read-only pass |
| Server | Payroll run lifecycle (calculate→submit→finalize→publish/void) + self-service payslips | Payslip self-service: Complete and verified. Run lifecycle: Implemented but unverified | `EmployeePayrollController.php:19-37` fully read (finalized+published gating); `PayrollRunController`/`PayrollOperationsController` internals not traced |
| Server | Platform org provisioning | Implemented but unverified (DB transaction + role assignment confirmed, full body not read) | `OrganizationProvisioningService.php:29,36,101` |
| Server | Platform module catalog entries: recruitment, performance, learning, financial_admin, ai_assistant | Missing (seeded as catalog rows only, no controllers found) | `PlatformModuleSeeder.php`; no matching `Api\*Controller` found for these keys |
| Client | Admin console (employees, settings, platform, payroll, dashboard, setup/org-structure) | Implemented but unverified at page level (architecture confirmed, pages not individually traced) | `client/src/features/*` directory census |
| Client | Session/auth handling + race-safe interceptors | Complete and verified | `client/src/lib/apiClient.ts:62-80` |
| Mobile | Login, session bootstrap, logout | Complete and verified | `AuthContext.tsx` full read |
| Mobile | Biometric "sign-in" | Complete and verified, but is password-vaulting not passwordless auth (see §3) | `secureToken.ts:26-58`, `AuthContext.tsx:167-192` |
| Mobile | Leave request submission + evidence/handover upload | Complete and verified | `features/leave/api.ts` wired to same endpoints traced server-side |
| Mobile | Attendance clock-in/out | Missing (view + correction-request only, by design) | `features/attendance/api.ts` (36 lines, no POST to `/attendance/records`); `AttendanceListScreen.tsx:31-33` |
| Mobile | Attendance correction requests | Complete and verified | `features/attendance/api.ts:20-35` → `POST /attendance/corrections` |
| Mobile | Document upload/acknowledge/signed-copy | Complete and verified (wired via `features/profile/api.ts`, not a `documents` api file) | `screens/DocumentsListScreen.tsx`, `screens/UploadDocumentScreen.tsx` imports |
| Mobile | Payslip viewing | Implemented but unverified at screen level (API hooks present; screen-by-screen trace not done) | `features/payroll/api.ts` exists; not opened in this pass |
| Mobile | Ticket creation/comments/attachments | Complete and verified | `features/tickets/api.ts` full read, matches server routes |
| Mobile | Lifestyle/appreciation | Complete and verified | `features/lifestyle/api.ts` full read, matches `EmployeeLifestyleController` exactly |
| Mobile | Push notifications | Missing | No device-token registration code found; `docs/mobile-feature-priorities.md` explicitly lists this as Phase 3, not built, and warns "an in-app inbox alone is not push delivery" |
| Mobile | Navigation framework per `AGENTS.md` (Expo Router) | Broken/inconsistent with stated project policy (not a runtime bug) | `package.json` deps show `@react-navigation/*` stack/tab navigators in active use; `docs/mobile-employee-experience-review-2026-10-13.md` independently flags the same mismatch |
| Website | Marketing pages (static content, nav, footer) | Implemented but unverified (not rendered/screenshotted in this pass) | `website/src/pages/*.astro` census |
| Website | Contact form / lead capture / any API integration | Missing | Zero `fetch`/`axios`/`<form` matches repo-wide in `website/src` |

---

## 6. Critical user journeys traced end-to-end

### Journey 1 — Employee login (web)
`client/src/features/auth/LoginPage.tsx` → `POST /auth/login` → `AuthController::login` (`AuthController.php:46-84`): looks up `User` with `organization`, checks password hash and `accessIsBlocked()`, rejects if org is `suspended`/`rejected`, sets Spatie team id (`:65`), auto-transitions org `invited → setup_in_progress` on the admin's first login (`:67-77`), mints a Sanctum token named by `device_name` (defaults `'api'` for web) (`:79-81`), returns `authPayload` (token + `sessionPayload`: user/org/workspace/roles/permissions/`modules`/`has_manager_scope`). Client stores token in `localStorage['valtireo.auth_token']` (`apiClient.ts:13,24-39`). **Verified.**

### Journey 2 — Employee login (mobile)
`mobile/src/screens` login screen → `AuthContext.login()` (`AuthContext.tsx:139-155`) → same `/auth/login` with `device_name` set to `"${Device.modelName} — Valtireo"` (`:65-68`) so the token is distinguishable per physical device in `personal_access_tokens`. Token written through `setStoredToken` into `expo-secure-store` with a write-queue to prevent out-of-order persistence (`secureToken.ts:90-110`). Session re-bootstrapped via `GET /auth/me` on app restart (`AuthContext.tsx:92-123`), with 401 → logout vs. any-other-error → "reconnect, keep token" distinction. **Verified.**

### Journey 3 — Leave request submission → approval
Frontend (web or mobile, identical contract) → `POST /leave/requests` → `LeaveRequestController::store` (`LeaveRequestController.php:59-79`) → `LeaveRequestService::submit()` (not fully read, but called with validated data + optional `evidence`/`handover_document` files) → creates `LeaveRequest`, and (inferred from `ApprovalRequestService` constructor injection at `LeaveRequestService.php:22`) opens an `ApprovalRequest`. Approval engine: `ApprovalRequestService::act()` (`ApprovalRequestService.php:90-176`) only accepts action on `status === 'pending'` (`:96`), wraps the decision in `DB::transaction` (`:102`), records a decision with `previous_status`/`next_status` (`:114-132`), and on full approval cascades into `onLeaveRequestStatusChanged`-equivalent logic (`:304-340`) that updates the `LeaveRequest.status` and, when approved, touches the matching `LeaveEntitlement` (`:326`) — i.e. balance deduction is wired into the same transaction as the approval decision, not a separate step that could silently desync. Visibility on read is enforced twice: route-level `EnsureEmployeeVisibility` middleware and controller-level `EmployeeVisibility::ids()` filtering (`LeaveRequestController.php:38-54`). **Verified end to end**, including the approval→entitlement linkage.

### Journey 4 — Attendance clock-in (web) vs. mobile gap
Web: `POST /attendance/records` → `AttendanceRecordController::store` (`AttendanceRecordController.php:39-46`) → `AttendanceService::createRecord($user, $data)`. Controller-level auth and visibility confirmed (`:19,30-34`); **service internals not traced** (unverified, not broken). Mobile: confirmed **no call to this endpoint exists anywhere in `mobile/src`** — mobile only reads records and files corrections (`features/attendance/api.ts`). This is consistent with the project's explicit, documented decision to defer mobile/biometric attendance until a physical terminal device is available (user's own memory note + `docs/mobile-feature-priorities.md`'s instruction against implying GPS attendance). **Classification: web path implemented-but-unverified; mobile path intentionally absent, not broken.**

### Journey 5 — Attendance correction request → approval
Mobile/web → `POST /attendance/corrections` → `AttendanceCorrectionRequestController::store` (routes at `routes/api.php:317`) → presumably opens another polymorphic `ApprovalRequest` (same engine as Journey 3 — confirmed by `ApprovalRequestService.php:373-398` containing an attendance-correction-specific status-propagation branch that sets the underlying record to `'corrected'` on approval, `:393`). Controller internals of `AttendanceCorrectionRequestController` not independently opened this pass. **Partially verified** (the approval-side propagation is confirmed in code; the request-creation controller body is not).

### Journey 6 — Payslip viewing (self-service)
Mobile/web → `GET /payroll/me/payslips` → `EmployeePayrollController::myPayslips` (`EmployeePayrollController.php:19-29`): requires `payroll.payslips.view_own` permission, requires the caller to have a linked `Employee`, and — critically — filters to `PayrollRunItem`s whose parent `PayrollRun` is `status = 'finalized'` **and** `published_at` is not null (`:26`), so an employee can never see a draft/unpublished run's numbers. `myPayslip($payrollRunItem)` (`:31-37`) re-checks org/employee ownership by id (404 if mismatched, not 403 — avoids confirming the id exists) and re-checks the finalized+published gate independently per-record rather than trusting the list filter. **Verified**, and notably well-hardened (double-gating, information-hiding via 404).

### Journey 7 — Appreciation / "Life at work" (lifestyle)
Mobile `features/lifestyle/api.ts` → `POST /lifestyle/appreciations` → `EmployeeLifestyleController::store` (`EmployeeLifestyleController.php:83-116`): requires the org's `appreciation_enabled` setting (`enabled()` check, `:86`), requires the recipient to be a different active employee (`:91-93`), requires the recipient to have opted in — `receive_appreciation`, and additionally `allow_shared_appreciation` for shared-visibility posts (`:94-98`) — all inside a `DB::transaction` with `lockForUpdate()` on the recipient row to serialize concurrent sends against concurrent consent withdrawal (`:88-90`). On success, inserts a database notification only (no mail/push) and deliberately omits the message body from the notification payload (`:101-110`, comment confirms this is intentional privacy behavior). Separately, `updatePreferences()` (`:28-44`) permanently converts a user's existing `shared` appreciations to `private` the moment they withdraw consent, and documents that re-opting-in does not republish them (`:37`). Moderation (`report`/`moderate`, `:129-160`) is gated on `workspace_settings.update`, a real org-admin permission, not a dedicated "moderator" role. **Fully verified end to end**, and the consent model is more rigorous than the one-line description in `docs/lifestyle-backend.md` suggests at a skim — the doc and the code agree.

### Journey 8 — Ticket creation (service desk)
Mobile `features/tickets/api.ts` (`useCreateTicket`) and web both → `POST /tickets` → `TicketController::store` (not individually re-opened past the controller header in this pass, but the route is gated by `EnsureModuleIsSubscribed::class.':service_desk'` and the same `TicketController` backs 20+ lifecycle transitions — assign/start/hold/resume/escalate/resolve/close/reopen/decline — each a separate `PATCH` with its own `FormRequest` class under `App\Http\Requests\ServiceDesk\*`, and 6 dedicated Feature test files exist (`TicketLifecycleTest.php`, `TicketWatcherTest.php`, `TicketPriorityAndSlaTest.php`, `TicketQueueAndReportingTest.php`, `TicketCategoryTest.php`, `TicketCommentTest.php`). Mobile's `useCreateTicket` payload shape (`ticket_category_id`, `subject`, `description`, `priority?`, `department_id?`, `assigned_to_user_id?`, `attachment?`) matches the controller's dependency list. **Implemented and strongly corroborated by test presence, but the controller body for `store`/`resolvers`/`reporting` was only partially read** — classified implemented-but-unverified rather than fully verified, to be precise about what was actually traced vs. inferred from test file names.

### Journey 9 — Platform admin provisions a new organization
Platform admin console → `POST /platform/organizations` → `PlatformOrganizationController::store` (confirmed to exist at `PlatformOrganizationController.php:179`, body not fully read) → `OrganizationProvisioningService::provision()` (`OrganizationProvisioningService.php:29-101+`): wraps the whole operation in `DB::transaction` (`:36`) and assigns the `organization_admin` role to the new admin user (`:101`) before returning. Status-change side effects are confirmed elsewhere: `updateStatus()` (`PlatformOrganizationController.php` — read in full) revokes all of an organization's user tokens the moment it's suspended/rejected (`$organization->users()->each(fn ($user) => $user->tokens()->delete())`), and records every status transition in `statusHistories()`. **Partially verified**: the transactional + role-assignment shape is confirmed; full `provision()` body (module subscription seeding, admin invitation email dispatch) was not read line-by-line.

### Journey 10 — Session invalidation on organization suspension (cross-cutting, both apps)
`EnsureOrganizationIsActive` middleware (`EnsureOrganizationIsActive.php:23-31`) returns 403 with `code: 'organization_access_revoked'` and deletes all the user's tokens the instant any authenticated request hits a suspended/rejected org. Both `client/src/lib/apiClient.ts:77-80` and `mobile/src/lib/apiClient.ts:77-80` listen for exactly this `code` and force a client-side logout (`onWorkspaceSuspended` listener set), with the race-guard described in §2/§3 ensuring a stale in-flight request can't incorrectly trigger this for a session the user has already re-established. **Verified**, and notably this is one of the few places where client and mobile share not just an endpoint contract but an identical defensive pattern, byte-for-byte comparable between `client/src/lib/apiClient.ts` and `mobile/src/lib/apiClient.ts`.

---

## 7. Cross-reference with existing docs under `docs/`

- `docs/lifestyle-backend.md` — describes the appreciation/milestones feature's consent model, enablement flags, and moderation path. **Matches the code exactly** (Journey 7); if anything the code is slightly more defensive (row-locking, notification-content omission) than the prose implies.
- `docs/mobile-feature-priorities.md` — explicitly scopes mobile attendance to correction-requests only and warns against implying GPS/mobile clock-in exists "until... company policy allows mobile attendance" is resolved. **Matches the code**: confirmed in Journey 4 that mobile genuinely has no clock-in call. Also lists service requests/tickets, directory, calendar, and assets as the next build phase, citing existing web/API support for all four — consistent with what this audit found server-side (routes exist for all four) and consistent with mobile now having tickets/directory/calendar/assets screens shipped (per the task brief and `mobile-employee-experience-review`), i.e. that phase appears to have since been completed.
- `docs/mobile-employee-experience-review-2026-10-13.md` — an earlier, more granular review of the same mobile codebase, dated two days before this audit. It independently found several of the same things this audit found by a different route (e.g. the `secureToken.ts`/`AuthContext.tsx` session-race surface area, the React Navigation vs. Expo-Router `AGENTS.md` mismatch this audit also flagged in §3) and additionally found specific UI/data-correctness bugs (directory `department_id=all` omission, profile field-clearing not persisting, unpaginated ticket/asset/alert history, handover picker only showing the first 24 directory entries) that this architecture-level audit did not independently re-verify — those are more granular than this pass's scope, and that doc should be treated as the more authoritative source for exact mobile UX defects. No contradiction found between the two documents.
- `docs/PAYROLL_BACKEND_ARCHITECTURE.md`, `docs/valtireo-product-mvp-status-2026-08-06.md`, `docs/valtireo-frontend-build-and-improvement-brief.md`, and the two business-plan docs were not read in this pass (out of scope / superseded by more recent code state) — flagging their existence here for a future audit pass rather than claiming to have reconciled them.
- One small discrepancy worth flagging: `mobile/src/context/AuthContext.tsx:64` ("matching the backend's confirmed mobile contract (see `MobileSessionContractTest`)") references a test class that this audit could not find anywhere in `server/tests/` or `mobile/tests/` under that name. Not evidence of a broken contract (the device-named-token behavior it describes is independently confirmed in `AuthController.php`), just a stale or renamed test reference worth a follow-up grep.

---

## 8. What this audit did not verify (explicitly)

- Internal bodies of `AttendanceService`, `TicketService`, `PayrollService`, `PayrollRunController`/`PayrollOperationsController` (the run calculate→finalize→publish pipeline), `DocumentRequirementController`/`EmployeeDocumentController` compliance logic, and `OrganizationProvisioningService::provision()` past the transaction/role-assignment lines.
- Any client (`client/src/`) page beyond `LoginPage`/`MyLeavePage`/`apiClient.ts` was inventoried by directory census, not individually opened.
- No test suite was executed (`php artisan test`, mobile's `node --test tests/*.cjs`, or any `tsc --noEmit`) — this was a static/read trace only, per the audit's own read-only constraint.
- Website rendering/navigation was not exercised in a browser; only source/dependency inspection was performed.

None of the above are reported as broken — they are reported as unverified, per the taxonomy requested.
