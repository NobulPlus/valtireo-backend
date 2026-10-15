# Security, Reliability, and Test Health Audit

**Date:** 2026-10-15
**Scope:** `server/` (Laravel API), `client/` (React/Vite), `mobile/` (Expo/React Native). `website/` excluded (brand new, no auth/sensitive data surface).
**Method:** Static code review (read-only) + safe automated checks (test suites, type checks, linters, code-style checker). No destructive operations were run; no files were modified outside this report.

---

## 1. Production-critical issues (security / data-integrity risk)

### 1.1 Passport photos served from an unauthenticated public disk (PII exposure)
- `server/config/filesystems.php:41-48` — the `public` disk maps to `storage/app/public`, symlinked to `public/storage`, served directly by the web server with **no authentication or organization scoping at all**.
- `server/app/Http/Controllers/Api/EmployeeController.php:496-499` stores employee passport photos on this `public` disk (`organizations/{orgId}/employees/{employeeId}/passport/...`).
- Compare with `employee_documents` and payroll documents, which live on the `local` disk (`storage/app/private`, `serve => true`, `config/filesystems.php:33-39`) and are only reachable through controller methods that enforce `organization_id` + ownership/permission checks (e.g. `EmployeeDocumentController::authorizeDocumentAccess()` at `server/app/Http/Controllers/Api/EmployeeDocumentController.php:192-199`).
- Net effect: passport photo URLs (`UserResource.php:25`, `EmployeeProfileResource.php:27`, `DashboardService.php:217`) are protected only by the unguessability of Laravel's random 40-char storage filename — not by any session, org-membership, or role check. Anyone who obtains a URL (browser history, referrer leakage, logs, shared screenshot, shoulder-surfing a network tab) has permanent, unauthenticated access to that PII image, with no revocation path.
- **Recommendation:** move passport photos to the `local` disk behind an authenticated, org/ownership-scoped controller endpoint (same pattern as `EmployeeDocumentController::view`), or serve via short-lived signed URLs if cloud storage (S3) is adopted.

### 1.2 "Documents" module `required_permission` is stricter than the actual self-service endpoints it gates
- `server/database/seeders/PlatformModuleSeeder.php:96-103` — the `documents` module has `required_permission => 'employee_documents.view'`.
- The base `Employee` role (`server/app/Services/DefaultRoleSeedingService.php:180-191`) has **no** `employee_documents.*` permission.
- Yet `SubmitEmployeeDocumentRequest::authorize()` (`server/app/Http/Requests/Documents/SubmitEmployeeDocumentRequest.php:10-14`) lets any user with an employee record upload a document, and `EmployeeDocumentController::authorizeDocumentAccess()` (`EmployeeDocumentController.php:192-199`) lets an employee view/download their **own** document without `employee_documents.view`.
- This is the exact bug class the prior sessions already fixed for `attendance`, `assets`, and `payroll` (each of which now has `required_permission => null` with an explanatory comment in the same seeder file, e.g. lines 113-127, 159-168, 209-218) — `documents` was missed. In practice this is a **UX/nav-visibility bug, not an authorization bypass**: `EnsureModuleIsSubscribed` middleware (the thing that actually gates the routes) only checks subscription status, not `required_permission` (`server/app/Http/Middleware/EnsureModuleIsSubscribed.php:17-53`), and employees reach their own documents via the "My profile → Documents" tab (`client/src/features/profile/MyProfilePage.tsx`), which is not gated by the `documents` module key. So no data is actually exposed/blocked incorrectly today — but `ModuleEntitlementService::forUser()` will still report `documents` as `visibility: 'hidden'` for a plain Employee, which is the same latent inconsistency class flagged before and worth closing proactively (set `required_permission` to `null` with the same style of comment, matching attendance/assets/payroll).

### 1.3 Stack-trace leakage is gated by a single `APP_DEBUG` flag with no backstop
- `server/.env:4` has `APP_DEBUG=true` (expected for local dev).
- `server/bootstrap/app.php:31-112` has a well-built custom exception reporter: it suppresses routine 4xx noise, strips raw exception messages/SQL bindings from the log, and writes a sanitized `SystemErrorLog` row (no code/trace inline, just file/line/class + an 8-frame trace excerpt with file/line/class/function only — no arguments). This is good practice.
- However, there is **no custom `render()` override** that forces generic error bodies regardless of `APP_DEBUG`. If `APP_DEBUG` is ever accidentally left `true` in a production `.env`, Laravel's default behavior will return full stack traces (including file paths and, for DB errors, query bindings) in API JSON responses. This is a config-discipline risk, not a code bug — **verify `APP_DEBUG=false` is set in the production environment**; nothing in code prevents leakage if it is not.

---

## 2. Design/UX issues (not security — flagged for other reports)

- No UX/design issues identified in this audit's scope beyond the module-visibility inconsistency in §1.2, which is primarily a nav-display bug.

---

## 3. Authentication, session handling, and authorization — detailed findings (mostly positive)

### Authentication (`AuthController.php`)
- Login (`AuthController.php:46-84`) uses constant-shape error messages (`'The provided credentials are incorrect.'`) regardless of whether the email exists — good, avoids user enumeration via the login endpoint.
- `forgotPassword` (`AuthController.php:173-194`) always returns the same response whether or not the email is registered — explicitly commented as deliberate, avoids enumeration.
- Password reset codes: 6-digit numeric code, **hashed** with `Hash::make()` before storage in `password_reset_tokens` (`AuthController.php:181-186`), 15-minute TTL (`RESET_CODE_TTL_MINUTES`), and on successful reset **all existing Sanctum tokens for the user are revoked** (`$user->tokens()->delete()`, `AuthController.php:227`) — correct "credential recovery = sign out everywhere" behavior.
- Both `resetPassword` and `acceptOrganizationAdminInvitation` wrap the check-and-consume sequence in `DB::transaction(...)->lockForUpdate()` (`AuthController.php:105-131`, `205-231`) to prevent a double-submit race on the same code/token — well-reasoned, with inline comments explaining why the outcome is returned rather than thrown (so the transaction's own cleanup delete isn't rolled back).
- Tokens are Sanctum personal access tokens, named by `device_name` (defaults to `'api'`), consistent with multi-device session tracking.
- Sanctum token expiration defaults to 1440 minutes / 24h (`server/config/sanctum.php:53`, no `SANCTUM_TOKEN_EXPIRATION` override in `.env`) — bounded session lifetime by default, good.

### Rate limiting (`AppServiceProvider.php:26-74`)
- `login`: 30/min per IP + 5/min per hashed email identity.
- `register`: 20/min per IP + 5/min per hashed email identity.
- `invitation-accept`: 20/min per IP + 10/min per hashed token.
- `password-reset-request`: 10/min per IP + 3 per 15 min per hashed email identity.
- `password-reset-confirm`: 20/min per IP + 5 per 15 min per hashed email identity.
- All five limiter names are wired to the matching routes in `routes/api.php` (lines 66-69, 414-415) — no mismatches found. Rate limiting is sound and appropriately tiered (IP-wide generous, per-identity tight).

### Session handling / logout
- `logout()` (`AuthController.php:247-254`) deletes only `currentAccessToken()` — **single-device logout**, consistent with the multi-device token model. There is no "log out everywhere" user-facing action outside of a password reset.
- `EnsureOrganizationIsActive` middleware (`server/app/Http/Middleware/EnsureOrganizationIsActive.php`) revokes **all** tokens (`$user->tokens()->delete()`) if the employee record is suspended/exited or the organization is suspended/rejected — correct defense-in-depth for access revocation mid-session.

### Mobile biometric credential storage (`mobile/src/lib/secureToken.ts`)
- Design: no refresh-token endpoint exists server-side, so biometric "sign-in" is implemented as storing the user's actual password in `expo-secure-store` under a key gated by `requireAuthentication: true` (native biometric/passcode gate at the OS keychain/keystore level), then replaying a normal login on unlock. This is explicitly documented in code comments (lines 26-36) as the same pattern browsers/password managers use for biometric autofill.
- `setBiometricCredential()` (lines 47-58) refuses to store anything if `SecureStore.canUseBiometricAuthentication()` is false, throwing an error that directs the user back to password sign-in — no silent downgrade path that stores the password without a biometric gate.
- `loadBiometricIdentity()` (lines 17-24) deliberately reads only email/name at startup, never the password, until biometric prompt succeeds.
- **Assessment:** reasonable tradeoff given the backend constraint. Residual risk surface: (a) the credential is tied to OS-level biometric/keychain protection, which is not absolute (device backups, OS-level exploits, or a compromised unlocked device could expose it); (b) there is no separate secret — a successful biometric unlock yields the literal account password, which if ever exfiltrated grants full account access with no separate revocation path other than the user changing their password; (c) this pattern cannot be invalidated remotely by the server (unlike a scoped refresh token, which could be revoked server-side without rotating the primary password). If/when a refresh-token endpoint becomes feasible, switching away from password-storage would reduce blast radius on device compromise.

### Web client token storage (`client/src/context/AuthContext.tsx`)
- The Sanctum bearer token is stored in `localStorage` (key `valtireo.auth_token`, synced cross-tab via the `storage` event, `AuthContext.tsx:133`). This is the standard SPA bearer-token tradeoff (no httpOnly cookie), meaning any XSS on the client would expose the token. No CSP/XSS audit was in scope here — flagging as a residual risk inherent to the chosen auth model, not a newly found bug.

### Permissions/authorization middleware composition
- `SetPermissionsTeamId` (`server/app/Http/Middleware/SetPermissionsTeamId.php`) scopes all Spatie `can()`/`hasRole()` checks to `organization_id` for the rest of the request; it's applied explicitly in both authenticated route groups in `routes/api.php` (lines 71, 77) rather than globally, with a code comment explaining why (global middleware runs before the route resolves the user in this Laravel version). `AuthController::sessionPayload()` sets it manually for login/register since those routes sit outside the authenticated group (`AuthController.php:273-277`) — consistent and intentional.
- `EnsureEmployeeVisibility` (`server/app/Http/Middleware/EnsureEmployeeVisibility.php`) auto-checks any route-bound `Employee`, `EmployeeDocument`, `EmployeeDependent`, `EmployeeEmergencyContact`, `AttendanceRecord`, `AttendanceCorrectionRequest`, `LeaveEntitlement`, or `LeaveRequest` model against `EmployeeVisibility::allows()`, with a documented carve-out for leave handover recipients. Applied to both top-level authenticated route groups (`routes/api.php:71, 77`) — did not find a route in `routes/api.php` that binds one of these models but skips this middleware group.
- `EmployeeVisibility` (`server/app/Services/EmployeeVisibility.php`) always scopes its base query by `organization_id` first (line 20), then layers "self" / "view_team" (reporting-manager or cluster manager/supervisor) / "view_department" (department head) on top — correctly org-isolated regardless of which visibility tier applies. Reused consistently by `EmployeeDocumentController::index`, `LeaveRequestController`, and the middleware itself.
- `EnsureModuleIsSubscribed` (`server/app/Http/Middleware/EnsureModuleIsSubscribed.php`) only checks module existence/active flag + organization subscription status (`subscriptionIsActive()` checks `starts_at`/`expires_at` window) — it does **not** enforce `required_permission`; that field is purely a nav-visibility hint consumed by `ModuleEntitlementService`. This distinction matters for §1.2 above: a stale `required_permission` is a UX bug, not an access-control bypass, because the real gate is the controller-level `abort_unless($user->can(...))` / FormRequest `authorize()` calls, which were separately verified correct per-endpoint (see §4).
- Checked all other module `required_permission` values against their route groups (`routes/api.php`) for the same stale-permission pattern (attendance, assets, payroll, service_desk already fixed with `null` + comment; employees, deployment, reports, audit_logs, organization_setup, users_roles, organization_structure, recruitment, performance, learning, financial_admin, ai_assistant are admin-only features with no self-service alternate path, so no mismatch) — only `documents` still has the stale value (§1.2).

---

## 4. Organization isolation — spot checks

Confirmed `organization_id` scoping is applied at the query/controller level (not just route middleware) in:
- `EmployeeDocumentController::index` — `where('organization_id', ...)` + `EmployeeVisibility::ids()` (`EmployeeDocumentController.php:30`).
- `EmployeeDocumentController::authorizeDocumentAccess` — `abort_unless($employeeDocument->organization_id === ..., 404)` (`EmployeeDocumentController.php:194`).
- `AttendanceRecordController` — index and show both scope/verify `organization_id` (`AttendanceRecordController.php:24, 50`).
- `EmployeeController` — index, export, show, update all scope/verify `organization_id` (`EmployeeController.php:65, 129, 247, 266, 306`), plus uniqueness/exists validation rules scoped by `organization_id` (lines 321-326).
- `LeaveRequestController::show/downloadEvidence/downloadHandoverDocument` — explicit `organization_id` check plus ownership/handover-recipient check before any file access (`LeaveRequestController.php:83-104`).
- `TicketController::downloadAttachment` — `organization_id` check + (`service_desk.view` OR reporter OR assignee) (`TicketController.php:179-185`).
- `PayrollOperationsController::downloadPayment/payslip/downloadPayslip` — `organization_id` check + permission or "own payslip, only if finalized and published" check (`PayrollOperationsController.php:119-135`).
- `OrganizationVerificationController` — `authorizeDocumentAccess` requires platform-admin OR same-organization, and `platformReview`/`platformIndex` gate on `is_platform_admin` (`OrganizationVerificationController.php:72-124`).

No instance found of a controller relying solely on route-level middleware without its own `organization_id`/ownership check for sensitive reads. This is a consistently-applied pattern across the codebase.

---

## 5. File access authorization

Reviewed every "download"/"view" endpoint serving a stored file:
`EmployeeDocumentController::download/view`, `LeaveRequestController::downloadEvidence/downloadHandoverDocument`, `TicketController::downloadAttachment`, `TicketCommentController::downloadAttachment` (not individually quoted above but follows the same `Ticket`-scoped pattern via its parent ticket), `PayrollOperationsController::downloadPayment/downloadPayslip`, `OrganizationVerificationController::download`, `TemplateController::download` (static template files, not user data).

All of the user-data download endpoints checked require **both** an `organization_id` match (returning 404, not 403, for cross-tenant IDs — correctly avoids confirming the record exists in another tenant) **and** an ownership/role check before streaming the file. Guessing another employee's document/payslip/ticket-attachment ID across tenants returns 404; guessing within the same tenant without permission/ownership returns 403 or 404 depending on the endpoint's chosen semantics — consistently enforced, not just advisory.

**Exception:** passport photos (§1.1) — these bypass this pattern entirely by living on the public disk.

---

## 6. Sensitive data / API resource exposure

Reviewed `UserResource`, `OrganizationResource`, `EmployeeDirectoryResource`, and skimmed the rest of `app/Http/Resources/*`:
- `UserResource` (`server/app/Http/Resources/UserResource.php`) exposes only `id, organization_id, name, email, email_verified_at, photo_url, created_at, updated_at` — no password hash, no raw tokens. Fine.
- `OrganizationResource` exposes only name/code/contact/location/status fields — no billing/financial data. Fine.
- `EmployeeDirectoryResource` (self-service directory listing) exposes name, employee number, work email/phone, department/unit/designation/location only — no salary, no national ID, no personal (non-work) contact info. Appropriately minimal for a company-wide directory view.
- Did not find a Resource class that conditionally includes/excludes fields by role (i.e., no per-role resource variants) — the pattern throughout is "the Resource is minimal enough that no field needs to be gated," which is a reasonable design choice given the controllers already gate *which records* are returned by role (§4).

---

## 7. Test / build health (exact commands and results)

All commands run from a clean `main` working tree, read-only.

| Check | Command | Result |
|---|---|---|
| Backend code style | `cd server && php vendor/bin/pint --test` | **Exit 0** (reported as "pass" per Pint's own semantics even though it lists style suggestions — see note below) |
| Client type-check | `cd client && npx tsc --noEmit` | **Exit 0**, no output — clean |
| Client lint | `cd client && npx oxlint` | **Exit 0**, 0 errors, 15 warnings (all `react-hooks/exhaustive-deps`, `only-export-components`, `no-extra-boolean-cast` — style/perf hints, not bugs) |
| Mobile type-check | `cd mobile && npx tsc --noEmit` | **Exit 0**, no output — clean |
| Mobile lint | `cd mobile && npx expo lint` | **Exit 0**, 1 warning (`'api' is defined but never used` in `src/features/calendar/api.ts`) |
| Mobile contract/unit tests | `cd mobile && node --test tests/*.cjs` | **14/14 pass**, 0 fail, exit 0 (includes the ~13 contract tests from the prior session plus one more; all green, including the biometric-identity-only-at-startup test and the logout-download-race tests) |
| Backend full test suite | `cd server && php artisan test` | **431/431 passed, 3,030 assertions, exit code 0 — see note below** |

**Note on Pint:** `--test` mode returned exit code 0 with `"result":"fail"` embedded in its own JSON-ish output body, listing ~130 files it would reformat (mostly `ordered_imports`, `fully_qualified_strict_types`, `phpdoc_align`, `braces_position`/`statement_indentation` — i.e., import ordering, `\Throwable`-style fully-qualified references in doc-blocks/catches, and brace style). Notably `PayrollOperationsController.php` and `PayrollOperationsService.php` are flagged for many formatting fixers (`single_space_around_construct`, `no_multiple_statements_per_line`, etc.) because those two files are written in a deliberately dense, semicolon-per-line style distinct from the rest of the codebase — purely cosmetic, not a correctness concern. No security-relevant files were flagged beyond routine import ordering.

**Note on the full backend suite:** `php artisan test` was run to completion in the background (PATH included Herd's `php84`). Final result: `{"tool":"phpunit","result":"passed","tests":431,"passed":431,"assertions":3030,"duration_ms":7710230}`, exit code `0`. **All 431 tests passed — 0 failures.** This is actually better than the known-gotchas baseline (previously 429 tests with 2 pre-existing date-rot flaky failures in `NotificationModuleTest::test_leave_approval_flow_creates_approval_notifications` and `ReminderNotificationCommandTest::...`, both hardcoded around `now()->addDays(10/11)` landing on a weekend): the suite has grown to 431 tests (consistent with the prior session's `AttendanceModuleTest`/`AuthenticationTest` additions), and on today's date (2026-10-15) the `+10/+11 day` offsets in those two tests apparently land on working days, so they did not trigger this run. This is still latent date-rot risk, not a fix — the two tests will fail again on a future date whose +10/+11-day offset lands on a weekend; they were not rewritten here (out of scope for a read-only audit) but are worth a follow-up ticket to use a deterministic/working-day-aware date fixture instead of `now()->addDays(N)`.

**Performance observation:** wall-clock duration was approximately **2 hours 8 minutes** (process started 09:17:43, completed ~11:25), far longer than the "~10-15 minutes" baseline noted in this task's known environment gotchas. The `duration_ms` field in PHPUnit's own summary (7,710,230 ms ≈ 128.5 min) corroborates this — it is not an artifact of this session's background-wait wrapper. This may be a one-off (background disk/AV activity, system load from other concurrent tool calls in this session) rather than a regression, but if repeatable it's worth profiling — a 429→431 test-count growth does not explain an ~8-12x slowdown from the quoted baseline.

---

## Summary of action items

1. **(Security, moderate)** Move passport photos off the public disk to an authenticated, org-scoped endpoint (§1.1).
2. **(Correctness/UX, low)** Set `documents` module's `required_permission` to `null` (matching the pattern already used for attendance/assets/payroll) so the nav doesn't report it as hidden for self-service-only employees (§1.2).
3. **(Operational, verify-only)** Confirm production `.env` has `APP_DEBUG=false` — nothing in code enforces this independently of the env var (§1.3).
4. **(Low, test-health)** `NotificationModuleTest::test_leave_approval_flow_creates_approval_notifications` and `ReminderNotificationCommandTest::...` remain latently flaky (hardcoded `now()->addDays(10/11)`); they passed in this run only because today's offset didn't land on a weekend. Replace with a deterministic/working-day-aware fixture before they next drift onto one.
5. **(Low, perf)** This run's `php artisan test` took ~2h8m wall-clock vs. the ~10-15 min baseline for a 431-test suite; worth a one-off re-check in a quiet environment to see if this reproduces.
