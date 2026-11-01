# Phase 2B existing-organization rollout audit

This is a read-only audit procedure, not a backfill. Execute SELECTs using a read-only account against the intended environment, with an organization scope where appropriate. Record organization/request/workflow IDs in an access-controlled report; do not export payroll amounts or document contents. No production audit was run during development.

## 1. Missing HR Director payroll approval grants

```sql
SELECT r.organization_id, r.id AS role_id, r.name
FROM roles r
WHERE r.`key` = 'hr_director'
AND NOT EXISTS (
  SELECT 1 FROM role_has_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.role_id = r.id AND p.name = 'payroll.runs.approve'
);
```

Review renamed standard roles and custom payroll reviewer roles as well. Missing default-role permission is not itself consent to grant it. Obtain an organization-approved reviewer decision and use the existing audited role editor. Do not rerun seeders expecting a backfill and do not bulk UPDATE role pivots.

## 2. Empty or automatic payroll workflows

```sql
SELECT w.organization_id, w.id, w.name, w.is_active, w.auto_approve_when_no_steps
FROM approval_workflows w
WHERE w.module = 'payroll'
AND (w.auto_approve_when_no_steps = 1 OR NOT EXISTS (
  SELECT 1 FROM approval_workflow_steps s
  WHERE s.approval_workflow_id = w.id AND s.is_active = 1
));
```

Also identify organizations with payroll enabled but no active `payroll/approve_run` workflow. Configure an active human reviewer and disable automatic approval before their next submission. Workflow step edits remain blocked while requests are pending; resolve or cancel those requests first. Never silently change configuration as part of deployment.

## 3. Single-approver workflows and pending self-dependent requests

For each active workflow, enumerate same-organization users eligible for every active step under the existing permission, role, direct-manager or department-head rules. Include administrative recovery authority separately, not as proof of a normal assigned reviewer. For payroll, intersect candidates with `payroll.runs.approve` even for administrators. Account for permission unions and direct grants, not role names alone.

Flag any step with zero or one candidate. Structural steps depend on the subject employee: evaluate them per pending request and per applicable employee scope, rather than assuming a global candidate count. Exclude inactive/suspended accounts using the deployment's authentication eligibility rules.

For each pending request, establish its permission-team context and evaluate `ApprovalDecisionAuthorizationService::restriction($candidate, $request, 'approve')` in a read-only application session for each candidate. This method only reads data. Restore the previous permission-team context after each organization. Do not invoke `act`, `submit`, workflow updates, seeders or role writers during the audit.

Flag requests with no eligible non-owner reviewer. Record whether excluded candidates are the requester, personal subject, or a recorded payroll submitter. Inspect every payroll request history for that run, not just the current submission. Review role/manager/head reassignment as possible remediation, but never alter requester identity or treat reassignment as an exemption. An administrator who submitted the request cannot recover it by self-approval.

## 4. Unresolved ownership and document recovery

```sql
SELECT organization_id, id, module, approvable_type, approvable_id
FROM approval_requests
WHERE status = 'pending' AND requester_id IS NULL;

SELECT d.organization_id, d.id, d.uploaded_by_id
FROM employee_documents d
LEFT JOIN users u ON u.id = d.uploaded_by_id
WHERE d.status = 'submitted'
AND (u.id IS NULL OR u.organization_id <> d.organization_id);
```

For submitted documents without a pending request, inspect their approval history. Recovery is allowed only when no history exists and the original uploader is known in the same organization. Existing completed/rejected/cancelled history requires an explicit new submission, not automatic reopening. Inspect pending document requests whose requester differs from the source uploader: the historical fallback may have attributed the reviewer as requester. Do not infer or rewrite historical identities from role names; establish evidence or resubmit. Preserve prior records.

For personal requests, compare source employee and approval subject tenant IDs. Any mismatch must be investigated; do not resolve it by broadening reviewer permissions.

## 5. Deployment sequence and rollback

1. Run the read-only audit and agree independent reviewers with each affected organization.
2. Validate on a staging copy with the deployment MySQL engine, including payroll resubmission and leave balance races.
3. Apply explicitly approved role/configuration changes through audited application flows. There is no Phase 2B schema migration and no automatic permission backfill.
4. Deploy backend and compatible web assets. Older clients remain protected server-side and can receive new authorization errors.
5. Verify another user's approval succeeds, self-approval fails, and actual actors appear in decision/audit records.

Completed historical approvals are not modified. Pending requests immediately follow the new rules. A code rollback restores the old authorization weakness; do not use rollback as a way to approve a blocked request. Permission grants separately approved during rollout require their own reviewed rollback decision.

## 6. MySQL race harness

Run `php tests/Support/approval-concurrency.php` from `server/` with a local test-only MySQL account allowed to create/drop uniquely named `codex_phase2b_*` databases. It refuses non-local hosts and database URLs. It creates a new schema, migrates/seeds only that schema, starts two PHP workers with a barrier, checks one decision and one source review, and drops only its generated schema. It does not migrate, truncate or drop the configured application database.

The application-account attempt was blocked by CREATE DATABASE permission (1044). Do not expand that account's privileges. An alternative is a separate disposable MySQL instance bound to localhost on a different high port: `php tests/Support/approval-concurrency.php 33367`. This explicitly uses the new instance's test-only root account with an empty password; use it only with a freshly initialized, local disposable server, never an application/production server. Shut that server down after testing.

Development validation used this isolated-server mode on MySQL 8.0.43. All six two-process races passed: document approve/approve and approve/cancel; payroll approve/approve; leave approve/approve, approve/cancel and approve/domain-cancel. The leave cases verify pending/used balances. The original application service and account privileges remained unchanged. Repeat on staging when deployment engine/version/isolation settings differ, and retain results and engine version as evidence.
