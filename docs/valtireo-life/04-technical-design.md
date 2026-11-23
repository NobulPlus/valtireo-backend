# Proposed database, API and processing design

All schema names, contracts and services in this document are **new proposals** except explicitly identified existing components. No migrations or application code are included in this assignment.

## Architecture

Use the existing Laravel application and database. Proposed boundaries: `LifeActivityService` for lifecycle/RSVP transactions, `LifeAudienceService` for query scoping and access predicates, `LifeMediaService` for private image ingestion/delivery, `LifeModerationService` for cases/actions and `LifeNotificationService` for durable database inbox delivery. Thin controllers use request validation, policies and explicit resources. Do not add a separate social microservice or realtime feed infrastructure for the MVP.

Existing authentication, organization permission context and module middleware remain outer gates. Each Life service must explicitly accept actor and organization context. Jobs receive IDs and organization ID, reload current state and reset permission team context after each job. Never serialize sensitive content or trust stale model relationships in job payloads.

Do not add Life models to HR visibility rules as a shortcut. Scoped queries and policies must agree on list/detail/media access; all totals and relation loading occur after authorization. Build a single policy contract used by discovery, reminders, images and later feeds.

## Data model and invariants

Use UUID primary keys for new content/activity/media/report IDs, matching the existing Connect precedent; existing organization/user/employee/department IDs stay unsigned big integers. UUIDs are not an authorization mechanism. Every new tenant-owned table carries non-null `organization_id`, including child rows. Timestamps are UTC; store the activity's IANA timezone separately. Strings use validated enum values rather than assuming database-specific enums.

| Proposed table | Key fields | Constraints / indexes |
|---|---|---|
| `life_activities` | id, organization_id, host_employee_id, title, description, status, visibility, department_id nullable, starts_at, ends_at, timezone, location_name, location_address nullable, cost_type, cost_minor, currency, capacity nullable, version, cancelled_at/by/reason, hidden_at/by/reason, created_at, updated_at | `(organization_id,id)` unique; indexes `(organization_id,status,starts_at,id)`, `(organization_id,host_employee_id,starts_at)`, `(organization_id,visibility,department_id,starts_at)` |
| `life_activity_participants` | id, organization_id, activity_id, employee_id, invitation_state nullable (`pending/active/revoked`), invited_by_employee_id nullable, invited_at, response nullable (`going/declined`), responded_at, show_attendance false, excluded_at/by/reason nullable, reminder_enabled false, created_at, updated_at | Unique `(organization_id,activity_id,employee_id)`; index `(organization_id,employee_id,response,activity_id)`; parent/employee checked same-tenant |
| `life_media` | id, organization_id, uploader_employee_id, activity_id nullable, state (`pending/processing/ready/rejected/deleting`), private source/variant keys, verified MIME, bytes, width/height, alt_text max 200, checksum, expires_at, created_at | One ready/attached cover per activity enforced while locking activity; tenant/state/expiry index; storage keys never serialized |
| `life_reports` | id, organization_id, reporter_employee_id, activity_id, media_id nullable, category, reason max 1000, status (`open/in_review/resolved/dismissed`), assigned_user_id nullable, evidence_json, resolved_at, created_at, updated_at | Unique `(organization_id,activity_id,reporter_employee_id)` in MVP, with latest reported media/reason recorded; index `(organization_id,status,created_at)` |
| `life_moderation_actions` | id, organization_id, report_id nullable, activity_id, actor_user_id, action, reason, created_at | Append-only audit; tenant/target/time index; no employee-facing reason serialization |
| `life_employee_restrictions` | id, organization_id, employee_id, capability (`create/invite/post/comment`), reason, imposed_by_user_id, expires_at nullable, revoked_at nullable | Query effective restrictions per employee/capability; current state enforced in transaction; audit all changes |
| `life_notification_deliveries` | id, organization_id, activity_id, activity_version, recipient_employee_id, recipient_user_id, event, channel (`database` MVP), due_at, state (`pending/processing/delivered/skipped/failed`), attempts, lease_until, notification_id, delivered_at, last_error_code | Unique event key `(organization_id,activity_id,activity_version,recipient_employee_id,event,channel)`; index `(state,due_at,lease_until)`; deterministic inbox notification UUID |

Participant interpretation: invitation pending is a pre-publication draft entry; publication changes it to active. An invitation remains active after a response, so Invitations pending is `invitation_state=active AND response IS NULL AND excluded_at IS NULL`. For org/department activities, self-RSVP creates a row with no invitation. Host has a participant row. Revoke sets invitation revoked and clears response; exclusion additionally prevents self-RSVP for broader audiences. Empty response is not an attendance record.

Extend existing `employee_lifestyle_preferences` additively with `allow_activity_invitations=false`, `activity_reminders=false`, `share_activity_attendance=false`, `show_life_on_home=true`. These are proposed defaults; existing celebration/appreciation columns retain their values. Per-activity reminder/attendance values are copied when an employee responds but a later global opt-out overrides them and clears existing enabled values; re-enabling never republishes old attendance or reenables old reminders automatically. Global invitation opt-out blocks future invitation creation only.

Add validated organization settings under `lifestyle`: `activities_enabled=false`, `employee_activity_creation_enabled=true`, `feed_enabled=false`, `communities_enabled=false`. Do not accept feed/community activation before those phases ship. Assign named moderators through existing tenant roles with new permissions, not a free-form user ID array in settings.

### Referential safety

Foreign keys prevent orphaned rows; services also enforce that employee, department, activity and media all belong to the current organization. For new child-to-parent relations use composite `(organization_id,activity_id)` references to the activity unique key. Existing employees/departments do not yet advertise composite unique tenant keys: either add supporting `(organization_id,id)` unique indexes in a separately reviewed additive migration and use composite FKs, or explicitly document the enforced service checks and integration tests until this is done. Recommended: add those indexes and composite FKs, measuring index creation time on production-sized tables first.

Use restrictive deletes for referenced employees/activities; employment exit changes status, not physical deletion. Deletion/anonymization runs through a coordinated retention process. Do not cascade-delete moderation evidence accidentally. Organization deletion purges its Life data and media through an explicit cleanup operation consistent with platform deletion policy. Prevent changing an employee's organization while tenant-linked child records remain: offboard/anonymize old participation then provision membership in the new tenant through an approved transfer flow.

Drafts need not satisfy publication requirements. Publication validation requires all fields, permissible audience, ready attached image if supplied and eligible invitees. Database/application checks enforce nonnegative cost, valid capacity, end after start, and department present only for department visibility. Department deletion must restrict while activities reference it, not null the department and accidentally broaden visibility.

### Migration sequence (proposed only)

1. Supporting tenant composite indexes; new activity and participant tables; preferences columns and permission catalog additions with no blanket employee opt-in.
2. Private media table, report/actions/restrictions and delivery outbox tables; indexes and checks verified on production database engine.
3. Code rollout behind disabled flags; existing rows require no migration to activities. Set roles/moderators explicitly for pilot tenant only.
4. Phase 2 adds posts/comments/reactions and extends report/media target fields using explicit checked target columns.
5. Phase 3 adds communities/memberships and nullable `community_id` on activities/posts; enable new enum audience only then.

Never edit existing migration files or import existing company events/appreciations into new social records. Prefer forward fixes after data exists; destructive down migrations are not a production rollback. Roll back feature flags and app compatibility first, preserving data for recovery.

## Concurrency and lifecycle

All mutations scope the activity by tenant, lock it first, check actor/access/status and verify expected version. Lock dependent participant rows consistently afterwards. Recheck active employee status and membership inside the mutation; coordinate with lifecycle revocation, and reconcile later changes.

For going: under the activity lock count eligible, non-excluded going rows (including host), excluding the actor when updating; reject full with 409; upsert the actor's unique row. All operations freeing/changing seats use the same activity lock. Counters can be derived for MVP; add cached counters only with transactionally maintained invariants. Membership changes must not leave stale participants occupying seats: compute eligibility in counts and enqueue reconciliation to clear stale rows.

Publish, updates and cancellation increment version and insert delivery intents within the same transaction. A material update clears other going responses and marks old reminder intents skipped; new RSVP schedules reminders for the new version. Idempotency keys on create/publish/invite/cancel must map user+tenant+route+key to a request hash and response for 24 hours; reuse with different body returns 409. This requires a small `life_idempotency_keys` table (key hash, request hash, status, response/resource reference, expires_at; unique actor/tenant/route/key), or a proven existing durable facility if found during implementation. Do not use an in-memory lock as the durable record.

RSVP PUT itself is idempotent. Concurrent edit version mismatch returns `version_conflict`; return current version only if still accessible. Cancellation state is persisted before delivery, and delivery failure never resurrects the activity. Hide blocks ordinary reads/media/RSVP immediately. Draft deletion marks attached media for cleanup; physical deletion is asynchronous.

## Proposed API contracts

Base `/api/lifestyle`. Existing `/preferences`, `/milestones` and appreciation routes keep their contracts. New lists use Laravel-compatible `{data,meta:{current_page,last_page,per_page,total}}`, default 20, max 50, deterministic ordering. MVP activity order is start then ID. Later high-write feeds use opaque cursor pagination. No client-supplied organization or creator fields; reject rather than silently accepting them.

| Method / suffix | Input / result | Access |
|---|---|---|
| GET `/summary` | At most 2 activity previews, eligible pending invitation count, feature flags; existing milestones/appreciation can remain separate queries | Active employee, entitlement; no roster/location address |
| GET `/activities` | `scope=explore/hosting/going/invitations`, `period=upcoming/past`, optional date window <=90 days, search <=100; paginated | Visible published/cancelled history as appropriate; own drafts in hosting |
| POST `/activities` | Editable fields, always creates draft; idempotency header; 201 resource | Creation enabled, unrestricted employee |
| GET `/activities/{id}` | Detail resource and viewer capabilities | Audience policy, draft owner only |
| PATCH `/activities/{id}` | Editable fields + `expected_version`; 200 resource | Host; restrictions/status rules |
| DELETE `/activities/{id}` | 204 | Host draft only; 409 for published |
| POST `/activities/{id}/publish` | `expected_version`; 200 published resource | Host, valid draft; atomic invite validation |
| POST `/activities/{id}/cancel` | `expected_version`, reason; 200 cancelled resource | Host; available for published or draft abandonment by DELETE instead |
| GET `/activity-invitees` | `activity_id`, search, page; `{id,name}` only | Host; eligible active consenting employees; no HR directory reuse |
| POST `/activities/{id}/invitations` | `employee_ids` <=50, `expected_version`; 200 resource + invited count | Host; idempotent; all-or-none validation |
| DELETE `/activities/{id}/invitations/{employeeId}` | `expected_version`; 204 | Host; clears invite and RSVP, schedules generic revoked notice |
| PUT `/activities/{id}/rsvp` | `response=going/declined/null`, `show_attendance`, `reminder_enabled`; 200 current RSVP/count | Eligible self only; toggles constrained by global preferences |
| GET `/activities/{id}/attendees` | Paginated role-filtered summaries | Host response list; peers only opted-in going names |
| POST `/activities/{id}/attendees/{employeeId}/remove` | reason, expected_version; 204 | Host; excludes employee and clears response |
| DELETE `/activities/{id}/attendees/{employeeId}/exclusion` | expected_version; 204 | Host; re-allows only, no automatic RSVP |
| POST `/media` | Multipart image + alt_text; 202 `{data:{id,state}}` | Active unrestricted creator; bounded quota |
| GET `/media/{id}` | Processing metadata | Uploader for unbound asset; parent policy after attachment |
| GET `/media/{id}/content?variant=thumbnail/display` | Private image stream, `Cache-Control: private, no-store` | Parent visibility and ready/not-hidden state; no public storage URL |
| DELETE `/media/{id}` | 204, detach under activity lock if used | Uploader/host with edit rights; report evidence retained separately |
| POST `/activities/{id}/reports` | category, reason, optional bound media_id; 201 or 200 repeated report | Current viewer; bounded evidence snapshot |
| GET `/moderation/reports` | status/page; paginated cases | `life.moderate`, same tenant |
| PATCH `/moderation/reports/{id}` | action=claim/dismiss/hide, reason; 200 case | Same-tenant moderator; audited |
| POST `/moderation/restrictions` | employee_id, capability, expiry, reason; 201 | Same-tenant moderator |
| DELETE `/moderation/restrictions/{id}` | reason; 204 | Same-tenant moderator; audited |

Preference extensions use existing GET/PATCH `/preferences`. Configuration extends existing PATCH `/workspace/settings`, requiring `life.configure` for new Life keys; preserve `workspace_settings.update` behavior for existing keys, with explicit mixed-payload authorization rather than bypassing either check.

Successful 204 host mutations invalidate the activity detail and lists; clients refetch before another versioned mutation. Each API resource must define required/nullable fields in implementation-time OpenAPI contracts, with fixtures shared by mobile and web. The examples below are representative payloads, not a claim that an executable OpenAPI specification or these endpoints already exist.

Example draft payload (illustrative future date):

```json
{
  "title": "Board games in Ikeja",
  "description": "Bring a favourite board game.",
  "starts_at": "2026-11-07T15:00:00+01:00",
  "ends_at": "2026-11-07T18:00:00+01:00",
  "timezone": "Africa/Lagos",
  "location_name": "Staff recreation room",
  "location_address": "Ikeja office",
  "cost_type": "free",
  "cost_minor": 0,
  "currency": "NGN",
  "capacity": 12,
  "visibility": "invite_only",
  "cover_media_id": null
}
```

Detail resource shape:

```json
{
  "data": {
    "id": "2c067d79-036f-4e77-a647-e62617d4a28a",
    "version": 2,
    "title": "Board games in Ikeja",
    "status": "published",
    "visibility": "invite_only",
    "starts_at": "2026-11-07T14:00:00Z",
    "ends_at": "2026-11-07T17:00:00Z",
    "timezone": "Africa/Lagos",
    "host": {"id": 123, "name": "Amaka Okafor"},
    "capacity": 12,
    "going_count": 1,
    "remaining_places": 11,
    "viewer": {"response": null, "invitation_state": "active", "can_rsvp": true, "can_edit": false, "can_report": true}
  }
}
```

Full authorized detail also includes description, venue, cost and authorized cover reference; lists omit address and attendee identities. IDs/names are minimal summaries; no work email, phone, HR profile, birth date, pay or reporting line. Capability booleans are presentation hints, never substitutes for mutation authorization.

Errors: 401 unauthenticated/revoked account; 403 feature/module or known action forbidden; 404 inaccessible tenant/audience resource, including image; 409 capacity_full/version_conflict/activity_closed/idempotency_conflict; 413 upload too large; 422 field validation; 429 throttled with retry guidance. For 409 use `{message,code}` and optionally current authorized counts; for 422 retain Laravel `{message,errors}`. Do not reveal whether a rejected invitee belongs to another organization.

## Media processing and delivery

Upload to private quarantine; validate decoded image dimensions, signature and size, not just client MIME. Process in a bounded worker: decode/re-encode, strip EXIF/GPS, resize, generate thumbnail, mark ready. Reject decompression bombs, invalid content and unsupported formats. No remote URL import (avoids SSRF) and no shared public CDN cache. Uploader can preview pending assets only through authorized endpoints; only ready assets can attach. On attachment lock media and activity, verify same tenant/uploader and no prior binding.

MVP streams through authorized backend requests for revocation checks. Reuse authenticated-image mechanics with distinct Life policies; existing HR photo endpoint remains unchanged. Uploader consent does not guarantee consent of photographed colleagues; reporting/removal and organization rules are required. Store at most bounded evidence copies for reported media, accessible only through the report policy. Purge orphan uploads after 24 hours and failed uploads sooner; cleanup is idempotent and retries storage failures.

## Notifications and jobs

Reuse the inbox payload shape: organization_id, category=`lifestyle`, event, severity, generic title/message, action_url, entity_type=`life_activity`, entity_id=UUID. Example event `life.activity.invited`: “You have an activity invitation. Open Valtireo Life to review it.” Do not include title, location, membership or attendee names. Include organization filtering in notification list/count/read paths before pilot, explicitly handling legacy notifications without tenant metadata; default exclude unknown-tenant Life entries. Add regression tests for existing system notifications rather than silently breaking them.

| Event | Recipients | Preference / eligibility |
|---|---|---|
| `life.activity.invited` | Newly activated invitees | New invitations opt-in, current audience |
| `life.activity.updated` | Active invitees and employees with responses | Generic operational update; non-declined responders requested to reconfirm after material change |
| `life.activity.cancelled` | Active invitees and responders | Generic operational notice; deduplicated union |
| `life.activity.invitation_revoked` / `participant_removed` | Affected employee | Generic, no detail after access loss |
| `life.activity.reminder_24h` / `reminder_1h` | Current going participants | Global + per-activity reminder opt-in, current audience |
| `life.activity.unavailable` | Prior invited/responding participants | Hidden/offboarding cancellation; generic only |
| Existing `appreciation.received` | Existing recipient | Existing opt-in and behavior unchanged |

Operational updates for an existing invitation/RSVP stay visible in the database inbox even when optional reminders are off. Explain this in preferences. No mail or native push in MVP; do not route new events through the generic notifier's global mail switch.

Proposed jobs: `DeliverLifeNotification`, `ProcessLifeMedia`, `ReconcileLifeActivities`, `PruneLifeMedia`, `PruneLifeData`. Scheduler scans due delivery rows each minute, batches with leases/locks, and dispatches delivery after commit. Database queue config currently has after_commit false: opt in per dispatch or rely on committed outbox polling; never enqueue work that can observe uncommitted records. This is an explicit design requirement, not an assumption about current queue safety.

Delivery transaction rechecks employee/account/tenant, activity state/version, audience and preferences. Insert inbox notification with deterministic UUID and mark delivered atomically in the same database; unique keys prevent duplicates after a crash. Cancellation/revocation notices are the only exception to current-content visibility and contain no content. Retry bounded transient failures with backoff; record safe error codes and expose failed jobs for operators. Proposed reminder catch-up window: 15 minutes; skip stale due times and any reminder after activity start. Late RSVPs only schedule reminders whose due time is still future. Reschedule invalidates old-version reminder intents.

Reconciliation cancels future events with invalid hosts, clears ineligible participant responses, suppresses expired/disabled reminders and handles missed lifecycle hooks. Request-time policy remains authoritative so access revocation does not depend on scheduler health. Monitor queue age, scheduler heartbeat, image processing latency, failures and duplicate delivery attempts. Real production worker/scheduler installation is a release dependency.

## Later data and contracts

Phase 2: `life_posts` (tenant, author, body <=3000, visibility org/department, department_id, version, hidden/deleted timestamps); `life_comments` (tenant, post, author, body <=1000, no nested replies, hidden/deleted timestamps); `life_reactions` (tenant, post, employee, fixed reaction enum, unique post+employee). Media gains mutually exclusive activity_id/post_id with max four per post. Reports gain mutually exclusive activity_id/post_id/comment_id targets; validate all parent/tenant associations, no arbitrary polymorphic class input. Add audience-filtered `GET /feed`, CRUD `/posts`, paginated `/posts/{id}/comments`, CRUD comments, idempotent PUT/DELETE `/posts/{id}/reaction` and report endpoints. Fetch counts after audience filtering; hidden parents hide descendants. No likes leaderboard.

Phase 3: `life_communities` (tenant, name, description, owner, discoverability org/private, joining open/approval/invite, status active/archived); `life_community_memberships` (tenant, community, employee, role owner/moderator/member, state invited/requested/active/removed, unique community+employee). Add explicit community invitations and membership transitions via POST `/communities/{id}/join`, POST `/communities/{id}/invitations`, PATCH `/communities/{id}/members/{employeeId}`, DELETE `/communities/{id}/membership`; list/detail/create/update/archive routes. Lock last-owner changes; require successor before owner leaves. Community-scoped posts/activities require active membership for both authoring and reading. Removing a member revokes children/media access immediately. Archive stops new posting/activities and cancels future community activities through a reviewed transaction/outbox flow.

Feed aggregation references existing shared appreciation only through `EmployeeLifestyleService` visibility logic and current consent. Never copy private messages or generated birthday text into persistent posts. Return typed reference cards; revalidate each source on access. Keep personal appreciation outside the general feed. Existing milestone display remains a separate computed section.
