# Phase 2B: approval security and HR Director payroll approval

## Scope and starting state

Started on `feature/design-system-v2-login` at reviewed commit `6ce07f0`. Only unrelated `.claude/` and `.worktrees/valtireo-life-discovery` changes were present; neither was changed or staged. No production records, existing organization grants, mobile code, Connect code, or Phase 1/2A implementation were changed.

## Execution and compatibility

`ApprovalDecisionAuthorizationService` supplies the same restrictions for human execution and API capabilities. A requester, personal subject employee, or recorded source uploader/requester cannot approve their own request. Source ownership is checked even when the approval's subject pointer is absent. Missing requester ownership fails closed for approval; it is never interpreted as a system request.

Payroll approval requires `payroll.runs.approve` at execution and rejects every recorded submitter of that same run, including earlier cancelled/rejected submission attempts. A missing requester anywhere in that run's approval history requires investigation. Organization Admin, platform-admin, and combined-role users cannot bypass these checks. The run creator is not automatically treated as its submitter. Existing step authorization still applies, including the existing administrative override for another person's request.

Human decisions lock the source record first, then reload and lock the approval request, check its fresh status and expected step, reload the actor, and authorize before writing any decision. Unknown actions are rejected inside the service. Source submission uses the same source lock and refuses a duplicate pending request. Payroll submission rechecks status, exceptions and submission permission under its source lock.

Leave's existing cancellation endpoint now locks and reloads the leave and cancels any pending approval with an actual-actor cancellation decision before applying balances. Its existing cancellation authority and note policy are retained. A stale approval cannot subsequently approve cancelled leave. Repeated cancellation cannot apply balances again. Cancellation of already-approved leave retains the previous historical approved decision.

Document review reuses pending requests. The fallback only recovers a submitted document with no prior approval history and a known same-tenant uploader; the uploader remains requester and recovery initiator is metadata. Completed/rejected/cancelled histories are not silently reopened. Unknown ownership requires resubmission. A configured automatic document workflow can complete recovery as a system action.

Automatic non-payroll approval remains available only through the existing explicit empty-workflow configuration. It records a system-origin decision with null actor; document review records no longer incorrectly attribute automatic approval to the uploader. Human payroll rejects empty workflows and workflows with automatic approval enabled, both during workflow configuration and submission. Existing invalid configuration is not rewritten.

Administrative approval when the configured step is unavailable now requires an explanatory note and records `administrative_recovery=true`. This still cannot approve the administrator's own request or bypass payroll permission. Other authorized rejection, request-changes and cancellation paths retain their existing authorization and note requirements.

## API and web

`POST /api/approvals/{id}/actions` preserves `action` and optional `note`; optional `expected_step_order` allows clients to reject a stale page's decision after another reviewer advances the workflow. Existing clients remain compatible without that field, using the request model's step snapshot at execution entry.

Approval resources add `allowed_actions` and `action_restrictions`. Restriction codes include `self_approval_not_allowed`, `payroll_submitter_cannot_approve`, `payroll_approval_permission_required`, `submission_owner_unknown`, `approval_step_unavailable`, and `source_not_pending`. The web approval and ticket dialogs filter actions, explain self-approval, and retain other allowed decisions. Server enforcement is authoritative. Approval detail/list, payroll, ticket and dashboard queries are invalidated after successful decisions.

HR Director already has run detail, compensation and report read access. Only `payroll.runs.approve` is added to freshly created default HR Director roles. Existing grants are preserved. No default submission, management, finalization or banking powers are added. Payroll Administrator retains existing preparation/submission/finalization responsibilities without default approval.

## Modified files

- `server/app/Services/ApprovalDecisionAuthorizationService.php` (new)
- `server/app/Services/ApprovalRequestService.php`
- `server/app/Services/ApprovalWorkflowService.php`
- `server/app/Services/DefaultRoleSeedingService.php`
- `server/app/Services/DocumentComplianceService.php`
- `server/app/Services/LeaveRequestService.php`
- `server/app/Services/PayrollService.php`
- `server/app/Http/Controllers/Api/ApprovalRequestController.php`
- `server/app/Http/Requests/Approvals/ActOnApprovalRequestRequest.php`
- `server/app/Http/Resources/ApprovalRequestResource.php`
- `server/tests/Feature/Approvals/ApprovalSeparationOfDutiesTest.php` (new)
- `server/tests/Feature/Approvals/ApprovalWorkflowTest.php`
- `server/tests/Feature/Payroll/PayrollFoundationTest.php`
- `server/tests/Feature/Documents/DocumentComplianceTest.php`
- `server/tests/Feature/Notifications/ReminderNotificationCommandTest.php`
- `server/tests/Support/approval-concurrency.php` (new)
- `client/src/features/approvals/api.ts`
- `client/src/features/settings/SetupDataPages.tsx`
- `client/src/features/tickets/TicketDetailModal.tsx`
- `client/src/types/api.ts`
- This delivery report and `docs/roles-permissions-phase-2b-rollout.md`.

## Validation

Initial focused command: `php -d opcache.enable_cli=1 vendor/phpunit/phpunit/phpunit --filter='ApprovalSeparationOfDutiesTest|ApprovalWorkflowTest|PayrollFoundationTest' --log-junit tmp/phase2b-focused.xml`: 34/35 passed, 194 assertions. The remaining fixture expected missing-step recovery without a note; it was updated for the approved recovery-note rule. Five further regression tests were then added.

Full backend command: `php -d opcache.enable_cli=1 vendor/phpunit/phpunit/phpunit --log-junit tmp/phase2b-full.xml`. The run completed with **520/522 passing, 3,406 assertions**, including all 20 new separation-of-duties tests. The two failures were fixtures: a document test uploaded and approved as the same administrator, and a reminder test selected a weekend-only leave period. The first now uses an independent HR reviewer; the second explicitly selects Monday/Tuesday. No application code changed after this full run.

Targeted rerun: `php -d opcache.enable_cli=1 vendor/phpunit/phpunit/phpunit --filter='test_hr_admin_can_review_employee_document|test_reminder_command_sends_document_onboarding_and_pending_approval_reminders_without_duplicates' --log-junit tmp/phase2b-fixtures.xml` passed **2/2, 15 assertions**. Thus all cases have passing evidence across the full run and corrected-fixture rerun; a second complete 522-test run was not performed. PHP 8.4 vendor Faker nullable-parameter deprecations remain unchanged.

Web `node node_modules/typescript/bin/tsc -b` passed after the final web changes. `npm run lint` passed with 15 existing warnings and no errors. No mobile checks were necessary because no mobile code was changed.

MySQL concurrency: the configured application's account correctly denied CREATE DATABASE (1044); its privileges were not changed. A separate temporary MySQL 8.0.43 instance was initialized in an ignored test directory and bound to localhost port 33367. `php -d opcache.enable_cli=1 tests/Support/approval-concurrency.php 33367` then passed **six two-process barrier races**: document approve/approve and approve/cancel; payroll approve/approve; leave approve/approve, approve/cancel and approve/domain-cancel. Each verified one decision and the expected source effects; leave tests verified pending and used balances. Domain cancellation may validly succeed after approval and reverse future leave days, with the original approval retained as history.

The harness dropped its own randomly named schema and the temporary server was shut down afterward. The installed application service and database were not altered. These are real local InnoDB tests, not SQLite concurrency claims. They establish the tested interleavings on MySQL 8.0.43, not exhaustive proof for every production configuration. The harness also explicitly reports uncaught exceptions with nonzero exit status.

## Remaining limits

Before deployment, run the documented audit and resolve organizations that lack an independent reviewer. Repeat the harness in staging if its engine/version/isolation settings differ from local MySQL 8.0.43. Production configuration, real-user browser acceptance and production rollout were not verified. No Phase 2C work is included.
