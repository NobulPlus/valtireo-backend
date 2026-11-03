# 14 — Acceptance Criteria Per Phase

## Phase 1 (MVP)

**Entitlement & permissions**
- [ ] An organization not subscribed to Orbit gets a 403 with a clear message on every `/orbit/*` route, and the Orbit nav item does not render on web or appear in the mobile More menu.
- [ ] A user without `orbit.access` cannot reach Orbit even if their org is subscribed.
- [ ] A user who is a Viewer on a project can read its board/backlog-equivalent/items/comments but every write action (move, edit, comment, attach) is rejected server-side with 403, regardless of frontend state.
- [ ] Removing the last admin-role member of a project is blocked with a clear error.
- [ ] A user from Organization A can never be added to Organization B's workspace/project membership, even by an org admin, even via a crafted request with a correct-looking ID.

**Workspaces & projects**
- [ ] Creating a project with a `key_prefix` already used by another project in the same organization returns 422 with a specific, actionable message.
- [ ] Archiving a workspace with active (non-archived) projects either cascades the archive or is blocked with a clear message — never leaves an active project under an archived workspace.
- [ ] A `private`-visibility project does not appear in any list/search response for a non-member, and a direct URL hit returns the same 404 shown for a nonexistent project (not a distinguishable "forbidden" response).

**Work items**
- [ ] Two near-simultaneous "create work item" requests in the same project never produce the same `key`.
- [ ] Updating a work item with a stale `version` returns 409 with the current server state; the same request with the correct current `version` succeeds.
- [ ] Moving a card between columns creates an `orbit_work_item_activities` row recording the previous and new status.
- [ ] A `simple`-mode project's work-item create/edit form never displays epic, estimate, or sprint fields; the underlying API does not require them.
- [ ] Deleting a board column (`orbit_statuses`) that any work item currently references is blocked (422).

**Comments & attachments**
- [ ] A comment mentioning a user without project access does not notify that user and does not persist a mention reference to them.
- [ ] Attachment files are served only through the authenticated `GET /orbit/attachments/{id}/file` endpoint; the raw `file_path` never appears in any JSON response.
- [ ] A user without project access cannot download a work item's attachment by guessing or reusing its URL.

**Links to existing records**
- [ ] A user without permission to view a linked ticket sees "Linked record unavailable" with no label text — not the ticket's subject, not a generic error that differs from the "doesn't exist" case.
- [ ] Creating a link from a work item to a record in a different organization is rejected.
- [ ] Deleting the linked record (or losing permission to it) causes the link to render as unavailable on the next fetch, without needing to delete the link row itself.

**Notifications & audit**
- [ ] Assignment, mention, comment, and due-date notifications appear in the existing web notification bell (60s poll) and as a mobile push within a reasonable delay, using the existing `ExpoPushChannel`.
- [ ] Tapping an Orbit push notification on mobile deep-links to the correct work item or My Work screen.
- [ ] Every status/priority/assignment/iteration change for a work item is visible in the existing Audit/Activity page, scoped to the viewer's organization.
- [ ] Assignment, mention, comment, and due-date notifications are dispatched synchronously (inline in the triggering request/scheduled command), not through a queued job — Phase 1 does not depend on this app's never-yet-exercised job queue being proven in the deployed environment. Introducing real queued jobs for Orbit is an explicit, separately-reviewed Phase 2+ decision, not a Phase 1 dependency.

**Mobile**
- [ ] A user without `orbit.access`, or whose org isn't subscribed, never sees an Orbit row in the More menu.
- [ ] My Work correctly separates assigned/mentioned/watched/overdue/due-soon items.
- [ ] Workspace/project administration, column configuration, and backlog/iteration screens are not reachable from mobile in Phase 1.

## Phase 2

- [ ] A Scrum-mode project exposes backlog, epics, iterations, and estimates; a Kanban/Simple-mode project never does.
- [ ] Starting an iteration locks its `starts_at`/`ends_at`/name against further edits until it's completed.
- [ ] Completing an iteration produces an accurate planned/completed/incomplete/estimate-total/scope-change summary, and every incomplete item is either carried to a named target iteration or returned to the backlog — recorded in `orbit_iteration_carryovers`, never silently re-parented.
- [ ] A completed iteration's history cannot be edited by any user, including org admins, through the normal API (only through an explicit, separately-reviewed data-correction path if one is ever built).
- [ ] The "Create linked Orbit work item" button on an Operations Centre task creates a correctly-linked work item without altering the OperationTask's own status or assignment.

## Phase 3

- [ ] Cloning a project template reproduces its statuses/labels/workflow configuration on the new project without copying any work items.
- [ ] A "blocks"/"blocked by" dependency prevents (or clearly warns on) moving a blocked item to a "done"-category status while its blocker is incomplete.
- [ ] Cross-project/cross-workspace reporting dashboards respect the same visibility rules as every individual project (no dashboard aggregation silently bypasses a private project's visibility).

## Phase 4

- [ ] External guest access, if built, is gated behind its own separate security review and cannot be enabled by a simple permission toggle without that review having occurred — a deliberate process gate, not a feature flag anyone can flip.
- [ ] Any AI-assisted feature is off by default per organization and clearly labeled as AI-generated wherever its output appears.
