# 12 — Risks, Edge Cases, Security Concerns & Testing Strategy

## Risks

1. **Tenant isolation regression** — the exact bug class already seen once in this codebase ("My Assets leaked the whole org's asset list," `cd5b14a`). Mitigation: the `BelongsToOrganization` global-scope trait recommended in [06](06-permissions-privacy-tenant-isolation.md) §1, plus a mandatory feature test asserting cross-org 404s for every new Orbit endpoint (see Testing below).
2. **Membership-role layer is new, unproven code.** Unlike every other permission check in this app (which reuses Spatie, already battle-tested), `OrbitAuthorizationService`'s workspace/project role resolution is genuinely new logic. Mitigation: isolate it in one small, fully-unit-tested service class rather than inlining the role logic into controllers — matches the existing `EmployeeVisibility` precedent of concentrating a tricky scoping rule in one tested place.
3. **First real use of the job queue.** Section [10](10-notifications-audit-files-jobs.md) §5 recommends starting synchronous specifically to avoid this risk in Phase 1; if queued jobs are introduced anyway, a stuck/failed job must not silently swallow a due-date reminder — add a `failed_jobs` monitoring check (the table already exists per Laravel's default queue setup) to whatever operational monitoring this app already has.
4. **Linked-record information leakage.** The single sharpest security requirement in the spec — getting §7 of [06](06-permissions-privacy-tenant-isolation.md) wrong (e.g. accidentally embedding a linked ticket's subject line in the work item response before checking the viewer's ticket permission) would quietly leak data through a side channel. Mitigation: a dedicated test suite specifically for the link-metadata endpoint, asserting a user without ticket access gets `viewer_can_access: false` and **no label**, not just a generic "forbidden."
5. **Drag-and-drop concurrency UX.** Optimistic-concurrency `409`s are correct but can feel jarring if two people are actively working the same board — a conflict should be rare in practice (small project teams), but the frontend must handle it gracefully (toast + silent refetch + re-render, not a blocking error modal) or Orbit's board will feel fragile on day one.
6. **Key-prefix collisions across organizations are impossible by design** (uniqueness is per-organization), but a prefix collision *within* one org across two workspaces is a real UX risk if not validated clearly at project-creation time — the `422` on duplicate prefix must surface a clear, specific error message, not a generic validation failure.
7. **Scope creep back into Operations Centre.** The single biggest product risk per the spec's own framing. Mitigation: [02](02-operations-centre-vs-orbit-boundary.md) is written as a hard rule precisely so that a future "just add one Orbit-like field to OperationTask" request has a documented reason to say no.

## Edge cases to explicitly handle

- **Archived workspace with active projects**: archiving a workspace must archive-cascade its projects (or be blocked with a clear error if projects are still active) — never leave orphaned "active" projects inside an "archived" workspace, which would be confusing in list views and ambiguous for permission checks.
- **Deleting the last Project Administrator**: mirror the existing `OrganizationRoleGuardrailService::wouldCauseLockout()` pattern — a project must always retain at least one admin-role member; removing the last one (or demoting them) should be blocked with a clear error, not silently leave a project unadministerable.
- **Work item whose epic is archived**: the story/bug/task remains fully functional; the UI shows the epic as "(archived)" rather than hiding the link or erroring.
- **Comment mentioning a user who isn't a project member**: silently dropped (no notification, no mention chip persists), mirroring Connect's `direct`-conversation mention-drop precedent — mentioning a non-member must not itself reveal the work item's existence to them.
- **Linked record is later deleted or the viewer's permission to it is revoked**: the link row persists (for audit/history purposes) but the link now renders as "Linked record unavailable" on next fetch — this must be re-evaluated on every read, not cached from creation time.
- **Offboarded user who was a project admin**: their membership row is preserved for historical attribution, but `EnsureOrganizationIsActive` already revokes their platform access entirely — the project is left with however many other admins remain; if they were the last one, the "last admin" guardrail above should have already blocked their own self-removal while active, but an *admin-initiated offboarding* (which bypasses that self-service guardrail) can still leave a project adminless. Recommendation: the employee-offboarding flow should check for this and warn the offboarding admin, rather than Orbit silently ending up with an unadministerable project.
- **Simultaneous board-column deletion and work-item creation targeting that column**: the `orbit_statuses` delete endpoint is blocked (422) while any work item references it ([07](07-database-design-and-migrations.md) §1) — but a work item being created in the same instant a column is deleted is a genuine race; the work-item-creation transaction should re-validate the status still exists before committing, inside the same transaction, not just at request-start validation time.
- **Iteration carry-forward into an iteration that itself gets deleted/never started**: carry-forward targets must be validated as `planned` or the backlog (never a `completed` iteration) at the moment of carry-forward, not just at UI-render time.

## Abuse controls

- File upload size/mime-type limits: reuse whatever validation rule Documents/Connect already enforce (not a bespoke Orbit number — see [10](10-notifications-audit-files-jobs.md) §3).
- Comment length limits and rate-limiting on comment creation: match whatever throttle (if any) Connect's message-send endpoint already applies — if none exists there today, that's a pre-existing app-wide gap, not something to solve only inside Orbit.
- Attachment retention/purge: `orbit:prune-attachments`, modeled on the existing `PrunePublicPassportPhotos` command (see [10](10-notifications-audit-files-jobs.md) §5).

## Testing strategy

Follow the existing Laravel Feature-test convention exactly (confirmed pattern: e.g. `ConnectChatTest.php`, `PayrollSelfServiceCompensationTest.php` — real HTTP-level tests against real routes, not unit tests mocking the database).

**Required test files** (new, under `server/tests/Feature/Orbit/`):

- `OrbitWorkspaceTest.php` — create/update/archive, cross-org 404s, visibility filtering for non-members.
- `OrbitProjectTest.php` — create with duplicate key_prefix → 422, mode-gated field visibility (simple-mode project rejects epic/estimate fields being meaningfully used — or at minimum the frontend never renders them; verify the API doesn't *require* them for simple-mode items).
- `OrbitWorkItemTest.php` — key generation under concurrent creation (the exact race `lockForUpdate()` is meant to prevent — a real concurrency test, two near-simultaneous requests, assert two distinct keys), optimistic-concurrency `409` on stale `version`, parent/epic linkage.
- `OrbitBoardMoveTest.php` — move audits previous/new state correctly, position midpoint insertion, synchronous renumber when positions exhaust precision.
- `OrbitMembershipRoleTest.php` — the new `OrbitAuthorizationService` union/escalation logic in isolation; last-admin lockout guardrail.
- `OrbitCommentMentionTest.php` — mention of a non-member is dropped (mirrors the existing `ConnectChatTest`'s direct-conversation mention-drop assertion almost exactly — same pattern, new feature).
- `OrbitWorkItemLinkTest.php` — the sharpest one: assert a user without ticket-view permission gets `viewer_can_access: false` and no label; assert cross-org link creation is rejected; assert a deleted linked record fails safely.
- `OrbitAttachmentTest.php` — private-disk delivery authorization, `file_path` hidden from API responses.
- `OrbitModuleEntitlementTest.php` — unsubscribed org gets 403 with the standard module-not-subscribed message on every Orbit route prefix.

Mobile/web: no automated UI test infrastructure exists in this app today for either client (confirmed — no RN component tests, no web component/e2e tests found in prior research this session). Orbit should not be the first to introduce one speculatively; manual QA against the real running app (as this session has done for every other feature this cycle) remains the verification method for UI work, consistent with how the rest of this app has always shipped.
