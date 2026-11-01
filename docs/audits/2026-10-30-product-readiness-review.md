# Valtireo product readiness review — 30 October 2026

## Conclusion and review boundary

Valtireo is a substantial HR operations and employee self-service product with an emerging collaboration layer. It is beyond a UI prototype. It is not yet defensible to describe the whole platform as complete or production-proven.

Reviewed the working tree on `feature/design-system-v2-login`, HEAD `2822fd3`, including uncommitted files. This is not a certification of that commit alone. Important Connect and profile-photo files are untracked; a clean checkout cannot reproduce this working tree. Other work is present, so this review does not stage, commit, or alter application behavior.

Evidence: API routes, service implementations, web routes/features, mobile screens/navigation, website content, deployment configuration, existing tests and fresh checks below. No production access, physical-device walkthrough, visual accessibility audit, real media session, load test, or full backend-suite rerun was performed in this review. Existing test files are evidence of coverage intent, not evidence that every test passes today.

## Product inventory

| Area | Implemented surface | Remaining qualification |
|---|---|---|
| Platform and organizations | Provisioning, verification, subscriptions/module access, branding/settings, platform oversight | Validate deployment, onboarding emails and subscription transitions in staging |
| People and structure | Employee records, departments/units/locations/clusters, reporting relationships, onboarding/status history, invitations, directory and organization chart | Exercise the complete lifecycle using each LASHMA persona, including suspension and exit |
| Roles and privacy | Tenant-scoped permissions, structural employee visibility, assignment guardrails, administrator lockout protection | Role assignment still uses a single-role synchronization flow; multi-role administration remains deferred |
| Approvals | Shared workflow engine, step authorization, requester/subject self-approval restrictions, payroll submitter restrictions, cancellation source-state guards, capabilities | Current whole-suite and deployment-engine regression pass still required before release |
| Employee self-service | Profile/photo, dependents, emergency contacts, documents, leave, attendance corrections, tickets, assigned assets, payslips | Device testing and failure/retry journeys remain separate from compilation |
| Leave and attendance | Requests, balances/entitlements, approval routing, attendance records/shifts/corrections | Validate actual organization policy, overnight shifts, timezone and payroll interactions |
| Documents and compliance | Requirements, uploads, approval/acknowledgement, expiry/reminders, private photo delivery | Verify private storage migration and removal of legacy public originals in each deployment |
| Service desk and assets | Categorized routing, ticket lifecycle/comments/watchers, SLAs/reporting, asset custody/faults | No full knowledge-base implementation found in API surface; do not equate ticketing with a knowledge base |
| Payroll | Compensation, calculation, approval, finalization, payslips, payment CSV and journals | Payment export is not direct bank disbursement. PAYE defaults disabled until verified configuration is entered |
| Reporting and operations | Organization/manager/personal dashboards, reports/exports, audit visibility, operational tasks/automations | Production-scale performance and scheduled execution require verification |
| Lifestyle | Birthdays/anniversaries, appreciation, privacy preferences, reporting/moderation; separate company calendar/events | Employee-created activities, invitations/RSVP, clubs and social feed are not implemented in the reviewed main application |
| Connect | Direct/group/channel messaging, replies/reactions/mentions, files, voice notes, search/pins/unread/preferences, moderation, one-to-one voice code | Background call handling and robust disconnect lifecycle are incomplete; see findings |
| Website | Astro product/industry/contact pages; 22 pages build | Several descriptions exceed implemented scope; public destinations remain configuration-dependent |

Primary inventory references: `server/routes/api.php`, `client/src/App.tsx`, `mobile/src/screens`, `mobile/src/navigation`, `server/app/Services`, and `website/src/data/site.ts`.

## Prioritized findings

### 1. High: Connect does not yet provide reliable incoming calls when the app is closed

`ConnectChatService::notify()` (`server/app/Services/ConnectChatService.php:84`) inserts notification rows directly. It does not dispatch `ValtireoNotification` through its channels, so these messages and call notifications bypass `ExpoPushChannel`. General application push infrastructure exists; Connect is not integrated with it.

`mobile/src/features/connect/ConnectCallWatcher.tsx:7` explicitly describes foreground polling and the absence of background/closed-app call handling. The mobile API and web call dock poll at four-second intervals.

Required outcome: define ordinary chat push separately from native incoming-call presentation; integrate delivery with preferences and revocation, then test foreground, background, locked and terminated states on real devices. Do not promise Teams-like ringing yet.

### 2. High: accepted calls can leave users busy after an ungraceful disconnect

`ConnectVoiceController::action()` sets accepted calls active with a two-hour expiry (`server/app/Http/Controllers/Api/ConnectVoiceController.php:57`). `ConnectVoiceService::reconcile()` checks eligibility and expiry, but not actual media participant presence. No media webhook/heartbeat reconciliation was found in the reviewed backend routes/services.

If an app is killed or loses connectivity without sending end, server state can remain active and block new calls until expiry or explicit termination. This is a code-path finding, not a reproduced physical-device incident.

Required outcome: reconcile provider disconnection/room closure with a sensible reconnect grace period; verify idempotent cleanup and simultaneous call attempts. Real provider tests must supplement fake-provider tests.

Related UI gap: `mobile/src/features/connect/NativeVoiceRoom.tsx` renders “Voice call connected” unconditionally inside its controls, rather than deriving that label from actual connection state. Connecting, reconnecting and disconnected states should be explicit.

### 3. High: website claims need alignment with shipped capabilities

`website/src/data/site.ts:16-25` describes candidate pipelines/career portals, performance/OKRs/360 reviews, course catalogs/learning paths and AI policy answers/summaries as available capabilities. Matching implementations were not found in the reviewed backend routes, web features or mobile screens. Product detail pages render these descriptions without a module availability designation. An “illustrative concept” image label is not a clear roadmap label.

The same file advertises a knowledge base and a tamper-evident audit trail. Existing database auditing (`server/config/audit.php`) is not by itself evidence of cryptographic tamper detection or immutable retention.

Required outcome: explicitly label planned modules and qualify security/integration claims. Keep the website ambitious without creating demo or customer expectations the product cannot meet.

### 4. High: release reproducibility and current regression evidence are incomplete

The working tree contains many modified files and untracked Connect, profile-photo and fixture files. No root `.github` workflow directory was found. This does not prove external CI is absent, but repository-managed CI was not evidenced here.

Required outcome: coordinate the pending work, review and commit coherent changes, run the full backend suite plus web/mobile checks from a clean revision, and record the exact release artifact. Do not use an older Phase 2B suite result as proof of the current product.

### 5. Medium: mobile is employee self-service, not yet a manager workbench

The mobile screen/navigation inventory includes employee transactions and Connect but no dedicated approval inbox, approval detail/decision flow or manager team overview. Web has manager dashboards and approval routes. Mobile notification routing supports only selected destinations and cannot substitute for these missing workflows.

This is a product scope gap, not automatically a defect: the current mobile app serves employees. The highest-value next functional increment is scoped manager approvals and team availability, preserving server-side separation of duties.

### 6. Medium: notification delivery is best-effort and synchronous

`ValtireoNotification` does not implement `ShouldQueue`; `ExpoPushChannel::send()` makes an HTTP request with a ten-second timeout. Immediate provider errors are logged, but no receipt-polling or invalid-token removal is implemented in that channel. A queue worker exists in deployment configuration, but this notification class does not automatically use it.

Required outcome: move delivery off business requests with transaction-safe dispatch, add retry/receipt/token cleanup, and monitor delivery failures. Test duplicate delivery and account logout/revocation.

### 7. Medium: payroll needs an explicit operational readiness gate

`PayrollService::defaultStatutoryRules()` deliberately leaves PAYE disabled with empty brackets (`server/app/Services/PayrollService.php:378`). `PayrollOutputService` produces payment CSV and journals; that is not an integrated money-movement service.

Before a live payroll demonstration, distinguish sample calculations from approved organization configuration. Before live operation, obtain verified effective-dated rules, reconcile sample runs, confirm bank export requirements, and test approval/finalization with separate actors. This review does not validate statutory correctness.

### 8. Medium: retention, recovery and operational evidence need completion

Chat deletion removes content from normal access but retains attachment storage (`ConnectChatController::change`, delete action). No retention/purge lifecycle was found in the reviewed Connect code. Agree retention and moderation evidence requirements before adding a purge mechanism.

Docker supervisor does include queue and scheduler processes (`server/docker/supervisord.conf`), and `server/bootstrap/app.php` schedules reminders, automations and Connect cleanup. These are implemented configuration, not evidence the deployed processes are healthy. Backup restoration, storage persistence, alerts, mail delivery and app-store/native signing were not verified here.

### 9. Medium: web initial bundle deserves performance attention

The production build reports the main JavaScript chunk at approximately 1.74 MB minified / 445 KB gzip and warns about chunks over 500 KB. This is a measurable build concern, not a measured user-perceived delay. Profile low-end phones and slow networks, then split routes/features based on measurements.

### 10. Planned work should remain explicitly planned

Life activities/RSVP and later communities/feed, multi-role management, recruitment, learning, performance and AI are separate increments. Their absence should not hide the substantial core already implemented. Video/recording remain excluded from the latest requested Connect scope, but legacy meeting/video routes and components still exist; decide whether to hide or separately gate that surface before presenting voice-only Connect.

## Strong foundations to preserve

- Server-side approval identity checks and payroll permission checks rather than UI-only restrictions.
- Tenant and structural scope services, plus dedicated isolation/privacy regression suites.
- Authenticated photo delivery, versioned photo URLs and replacement/upload coverage across clients.
- Encrypted bank-account/statutory identifiers in relevant models.
- Broad employee self-service coverage with common navigation and design primitives.
- Real domain services and migrations behind the UI, not only demonstration screens.
- Rich synthetic LASHMA fixtures supporting employee, manager, HR and restricted-state journeys.

## Fresh validation

| Command | Result |
|---|---|
| `client: npm run build` | Passed; large-chunk warning noted above |
| `client: npm run lint` | Passed with warnings; no lint errors |
| `client: node --test tests/*.mjs` | 10 passed, 0 failed |
| `mobile: npm run typecheck` | Passed |
| `mobile: npm test` | 29 passed, 0 failed |
| `mobile: npm run lint` | 0 errors, 2 warnings: unused calendar import; voice recorder effect dependency |
| `website: npm run build` | Passed; 22 static pages |
| `server: vendor/bin/phpunit tests/Feature/Connect/ConnectVoiceCallTest.php --log-junit tmp/product-audit-voice.xml` | 10 tests, 65 assertions, 0 failures/errors; SQLite and fake media |
| `server: vendor/bin/phpunit tests/Feature/Connect/ConnectChatTest.php tests/Feature/Employees/EmployeePhotoAccessTest.php --log-junit tmp/product-audit-chat-photo.xml` | 31 tests, 182 assertions, 0 failures/errors; isolated test database |

Fresh backend total for these selected suites: **41 tests, 247 assertions, zero failures/errors**. This is not the full backend suite.

Local LiveKit URL/key/secret entries are populated. Values were not exposed, and connectivity, account validity and real voice transport were not tested. This supersedes the earlier missing-configuration state, but does not prove calls work.

## Recommended next sequence

1. Stabilize the current revision and align public website descriptions with the actual scope.
2. Close Connect push/disconnect gaps and complete a two-device, two-network voice acceptance pass. Keep video and recording deferred.
3. Run a staging acceptance matrix using LASHMA: ordinary employee, scoped manager, HR Officer/Director, Payroll Administrator, Organization Admin, no-team manager, onboarding, suspended/exited and a different tenant.
4. For each persona test login/reset, navigation, profile/photo replacement, documents, leave, attendance, tickets/assets, payslips, notification destinations and logout/revocation. Test rejection, cancellation, poor connectivity and repeated submissions, not only success.
5. Complete clean-revision backend regression, deployed-database concurrency checks where applicable, backup restoration and production configuration checks.
6. Then add the mobile manager approval journey, followed by the minimal Life Activities MVP. Keep broader communities and new enterprise modules as later product decisions.

No part of this review declares visual design, security, statutory correctness or production readiness “perfect.” Those require targeted acceptance evidence beyond successful builds.
