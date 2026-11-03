# 10 — Notification, Audit, File-Storage & Background-Job Design

## 1. Notifications

Orbit adds new purpose-built methods to the existing `app/Services/NotificationDispatchService.php` (the single creation point for every in-app notification today — no new service class needed), each calling `$user->notify(new ValtireoNotification([...]))` exactly like the existing `ticketAssigned`/`approvalDecided`/`documentNeedsAcknowledgment` methods do:

| Method | `category` | `event` | Fires when |
|---|---|---|---|
| `workItemAssigned` | `orbit` | `orbit.item.assigned` | A work item's `assignee_id` changes |
| `workItemMentioned` | `orbit` | `orbit.comment.mentioned` | A comment's parsed `@mention` resolves to a user with project access |
| `workItemCommented` | `orbit` | `orbit.item.commented` | A new top-level or reply comment is posted (sent to watchers, not the whole project) |
| `workItemDueSoon` | `orbit` | `orbit.item.due_soon` | Scheduled scan finds an item due within 24h (see §5) |
| `workItemStatusChanged` | `orbit` | `orbit.item.status_changed` | A watched item's status changes |
| `iterationStarted` / `iterationEndingSoon` | `orbit` | `orbit.iteration.started` / `orbit.iteration.ending_soon` | Sent to all project members |

Delivery is **best-effort**, matching the existing convention exactly (`NotificationDispatchService`'s existing methods wrap `$user->notify(...)` in try/catch, log-only on failure, never roll back the triggering transaction) — a broken push transport must never block a work-item move or comment from saving.

Web delivery: no new mechanism — the existing `/notifications/unread-count` 60-second poll picks up Orbit notifications automatically, since they land in the same `notifications` table every other feature uses.

Mobile delivery: `ValtireoNotification::via()` already returns `['database', ExpoPushChannel::class]` for every notification regardless of category — Orbit notifications are pushed through `ExpoPushChannel` with zero changes to that channel. The only new mobile work is extending `notificationNavigation.ts::resolveNotificationDestination()`'s allowlist `switch` with `orbitWorkItemDetail` and `orbitMyWork` destination kinds, matching its existing `action_url` regex-match style (e.g. a new case matching `/orbit/work-items/([A-Z]+-\d+)`).

### Notification preferences

The spec asks for user notification preferences. Today, preference granularity exists only inside Connect (`connect_preferences` table: `availability`, `notifications`, `allow_calls`). There is **no general, cross-feature notification-preferences table** — every other feature's notifications are simply always-on. Recommendation: **do not build a new general preferences system for Orbit's MVP.** Ship Orbit's notifications always-on, matching every other feature's current behavior (consistency over building new infrastructure prematurely). A general "notification preferences" feature, if wanted, is an app-wide concern that should be designed once and applied everywhere — not bootstrapped inside one module. Flagged here, not solved here.

## 2. Audit

Two layers, both already established patterns, both applied to Orbit with zero new infrastructure:

1. **Generic field-level auditing**: `OrbitWorkspace`, `OrbitProject`, and `OrbitWorkItem` implement `OwenIt\Auditing\Contracts\Auditable` (`use Auditable;`), exactly like `Organization`/`Role`/`User` do today. This automatically populates the existing `audits` table with before/after field diffs, redacted through the existing `AuditRedactor`/`SafeAuditUrl` helpers — no Orbit-specific redaction logic needed since Orbit has no especially sensitive fields (no bank numbers, no tax IDs, unlike Payroll/Documents).
2. **Narrative activity log**: `orbit_work_item_activities` + `OrbitWorkItemActivityService::record()`, the fourth instance of the exact `RoleActivity`/`TicketActivity`/`EmployeeProfileActivity` pattern. This is what satisfies the spec's explicit requirement that board movement, membership changes, iteration changes, assignment, and priority/status movement each carry previous-and-new-state — the `from_value`/`to_value` json columns exist specifically for this.

Both feed the existing `client/src/features/audit/AuditActivityPage.tsx` automatically — `GET /audit-logs` already surfaces any `Auditable` model's rows, and `GET /activity-feed` can be extended to include `orbit_work_item_activities` the same way it presumably already unions `TicketActivity`/`RoleActivity`/`EmployeeProfileActivity` (confirmed pattern, not a new screen).

**Retention**: no existing feature in this app has an automated audit-retention/purge policy (confirmed — no purge job for `audits` or any `*_activities` table was found). Orbit does not need to invent one either; this is an app-wide data-retention decision, not something to solve unilaterally inside one module. What Orbit **does** need, per the spec's explicit caution, is to avoid overclaiming: audit rows are durable application data, not a tamper-evident/immutable ledger — nothing about `owen-it/laravel-auditing` or the narrative-activity pattern provides cryptographic immutability, and documentation/UI copy should never imply otherwise.

## 3. File storage

Follows the confirmed existing pattern exactly — no S3, no signed URLs anywhere in this app today, and no reason for Orbit to be the first:

- Disk: `local` (`config/filesystems.php`), same as Documents/passport-photos/Connect-chat-files.
- Path convention: `storage/app/private/organizations/{organizationId}/orbit/work-items/{workItemId}/attachments/{filename}` (mirrors the existing `organizations/{org}/employees/{employee}/documents/...` nesting convention).
- Serving: a new `OrbitAttachmentController::file()` method doing `response()->file(Storage::disk('local')->path($attachment->file_path), [...])`, gated by an `authorizeAttachmentAccess()` helper that checks organization match + project membership — copy of `EmployeeDocumentController`'s `authorizeDocumentAccess()` pattern, adapted to Orbit's membership model instead of employee-visibility.
- `file_path` is `$hidden` on the `OrbitAttachment` model's API resource, matching `ConnectMessage::$hidden = ['file_path']` exactly — raw storage paths never leave the backend.

**Upload limits/abuse controls**: no existing feature's upload size limit was independently confirmed in this research pass; whatever file-size/mime-type validation rule the Documents or Connect upload endpoints use today should be copied verbatim for Orbit's attachment endpoints (same validation rule object, not a bespoke new limit) — consistency here matters more than Orbit picking its own number.

## 4. Audit/moderation of comments

Deferred to Phase 2+ (see [02](02-operations-centre-vs-orbit-boundary.md) and [11](11-mvp-and-phase-plan.md)) — `connect_reports`' shape (`message_id`/`reporter_id`/`reason`/`status`/`reviewer_id`/`resolution`) is the template to copy when a reporting flow is needed for comments; MVP ships without it, since project membership is already a much smaller, more trusted circle than open Connect channels.

## 5. Background jobs & scheduler — the one place Orbit genuinely breaks new ground

This is worth stating plainly: **no `ShouldQueue` job class has ever been written in this codebase.** The `database` queue connection and the `queue:work`/`schedule:work` supervisor processes exist and run in production (`server/docker/supervisord.conf`), but nothing has ever been dispatched onto that queue. Orbit's due-date reminders and overdue escalation are good, low-risk candidates to be the **first real jobs** — but this means Phase 1 implementation should explicitly budget time to prove out queue dispatch end-to-end (a job that fails silently because nothing has ever exercised this path before would be a bad first impression), not assume it "just works" because the infrastructure is configured.

**Scheduled commands** (added the same way the existing four are: closures in `routes/console.php`, registered in `bootstrap/app.php`'s `withSchedule()`):

```php
$schedule->command('orbit:due-date-reminders')->daily();
$schedule->command('orbit:escalate-overdue')->hourly()->withoutOverlapping();
$schedule->command('orbit:iteration-reminders')->daily(); // "sprint starts tomorrow" / "sprint ends tomorrow"
```

Each command's body should **dispatch a queued job per affected organization or per batch of work items** (e.g. `DispatchOrbitDueSoonNotifications::dispatch($workItemIds)`) rather than doing the notification fan-out synchronously inside the scheduled command itself — this is the first real justification in this app for actually using the `database` queue driver instead of running everything inline inside a `routes/console.php` closure the way `valtireo:send-reminders` and `valtireo:run-operational-automations` currently do. If that feels like too much new surface area for Phase 1, the fallback is to do what the existing two scheduled commands already do (run the fan-out synchronously, inline, in the scheduled command) — slower under load, but zero new infrastructure risk. **Recommendation: start synchronous (matching existing precedent exactly), introduce real queued jobs only once Orbit's notification volume demonstrably needs it.** Don't build new queue-dispatch infrastructure speculatively.

**Attachment cleanup**: when a work item or comment is archived/soft-deleted, its attachments' files are not immediately deleted from disk (matching the existing pattern — no feature in this app eagerly deletes files on soft-delete, e.g. `EmployeeController`'s passport-photo swap only deletes the *old* file after a successful *new* upload, never deletes on record deletion). A scheduled `orbit:prune-attachments` command, modeled directly on the existing `PrunePublicPassportPhotos` console command, removes orphaned files for attachments whose parent record has been soft-deleted past the retention window (see [12](12-risks-edge-cases-testing.md)).
