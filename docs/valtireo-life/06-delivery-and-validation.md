# Implementation phases, risks and validation

Proposal only. Stop at review; do not implement from this document without authorization.

## Phases and estimates

Estimates are engineering person-days, including ordinary implementation tests and review, for an engineer familiar with this repository. They are planning ranges, not calendar promises. Dedicated QA/product review, infrastructure procurement and unexpected navigation migration can extend elapsed time. Parallel staffing does not remove integration dependencies.

| Phase | Scope / dependency | Complexity | Estimate | Exit gate |
|---|---|---|---|---|
| 0: decisions and contracts | Confirm MVP rules, retention/moderators; resolve router mismatch; production queue/storage capability review; approve privacy model | Medium | 3–5 days discovery follow-through | Signed-off contracts, tenant policy and navigation decision |
| 1A: Activities backend | Additive schema, audience policy, draft/publish/edit/cancel, scoped picker, invitations, capacity-safe RSVP, settings and privacy extensions | High | 7–10 days | API/tenant/state tests pass on actual production database engine |
| 1B: safety and delivery | Private cover pipeline, report queue, restrictions, event outbox, reminders, tenant-safe inbox integration, reconciliation/retention | High | 6–9 days | Media authorization, retry/deduplication and moderation proven |
| 1C: mobile and web | Mobile Life sections, Home preview, create/detail/RSVP/invites/preferences; web parity and moderator UI | High | 8–12 days | Critical journeys pass devices/web; existing Lifestyle unaffected |
| 1D: pilot hardening | Accessibility, low connectivity, load/concurrency, observability, moderator training, tenant-scoped rollout | Medium–high | 4–6 days | Release gates below and named operational owner |
| 2: lightweight social feed | Requires healthy pilot + moderation capacity; text/photo posts, fixed reactions, one-level comments, chronological feed | High | 15–23 days | Post/comment/media authorization, moderation and consent projection validated |
| 3: communities | Requires reusable audiences/media/moderation; open/approval/private clubs, membership, roles, scoped posts/activities | High | 15–24 days | Membership transitions, owner continuity and private club isolation validated |

Activities MVP estimate: **25–37 engineering person-days after phase 0**, excluding a full router migration and native push. With one engineer, allow roughly 5–8 working weeks plus review/operational contingencies. If Expo Router migration is selected, estimate it separately after a route inventory; do not hide it inside the Life screen estimate. Feed and communities are independently gated, not automatic commitments.

Order: approved phase 0 -> 1A -> 1B and contract-driven UI work -> integrated 1C -> 1D. Text-first development can start without image UI, but image security and operational moderation must pass before enabling the complete MVP. No feature is shipped just because its screen renders.

## Dependencies and compatibility

- Existing employee_self_service entitlement and active-employee resolution remain required. No new commercial module decision blocks the MVP.
- New permission grants are explicit per organization role. Do not run a blanket permissions or consent seed over customer data.
- Keep existing `/lifestyle` appreciation/preferences contracts backward-compatible. Old mobile builds ignore new preference fields and continue working. Do not require Activities requests from old clients.
- Database changes are additive; deploy migration before new code, keep flags off, then verify workers/storage and enable one pilot tenant. A schema rollback must not delete pilot data unexpectedly.
- Proposed notification tenant filtering touches shared inbox behavior: validate legacy non-Life alerts, unknown metadata, counts and mark-all-read semantics before release. This is a compatibility dependency, not incidental cleanup.
- Existing feature flags default off and existing consents stay false unless employees change them. New default settings must not implicitly enable Life in all organizations.
- Connect/live calls, payroll, time attendance, job portal and official company event changes are independent. No LiveKit account or RTC deployment is needed for this Activities MVP.

## Principal risks and edge cases

| Risk / edge case | Planned response |
|---|---|
| Same last seat requested simultaneously | Serialize per activity; unique participant constraint; real-engine concurrent test |
| Double tap, timeout after successful publish, replay | Durable idempotency keys; replay stable result; reject mismatched body |
| Concurrent host edit / cancellation / RSVP | Version check and common locking order; no ghost RSVP after cancellation |
| Department transfer / employee exit | Request-time live membership; future RSVP reconciliation and host auto-cancellation |
| Organization move while historical inbox remains | Explicit notification tenant filtering; generic payload; old-tenant links cannot grant access |
| Feature disablement or entitlement expiry | Suppress discovery/new writes/reminders; retain permitted withdrawal/report/support paths; no hidden billing bypass |
| Stale image URL or shared cache | Private authorization per delivery; no public URLs; clear client media on session/access changes |
| Hidden host/image still visible in feed/Home | All projections reuse parent policy; invalidate after actions; no permanent content duplication |
| Wrong timezone, DST ambiguity, device timezone change | Explicit offset + IANA zone; verify offset matches zone/date; reject ambiguous/invalid local time without selected offset; UTC schedule |
| Edited time/cost after RSVP | Material update reconfirmation with seats released and versioned reminders |
| Declined invitation still grants invite-only viewing | Deliberate product rule; revocation removes grant, decline alone changes response |
| Capacity reduced below bookings | 422; host must remove or obtain withdrawal first, never silently evict attendees |
| Worker outage or duplicate job delivery | Durable outbox, deterministic notification ID, lease/retry; missed reminders skipped after catch-up window |
| Image processing failure or malicious upload | Quarantine, byte/dimension limits, decode/re-encode, no remote fetching, clean retry/orphan pruning |
| Harassment / fake events / unwanted invitations | Named moderators, rate budgets, opt-in invitations, individual restrictions, report evidence |
| Photos or club membership expose sensitive interests | Explicit participation controls, private clubs, no HR exports, report/removal flow |
| Nonparticipation feels compulsory | Optional language, no manager engagement dashboards or performance scores |
| Empty community/feed | Delay phases until active organizers and content ownership exist; archive dormant communities |
| User switching accounts on shared phone | Clear query/image state; reject stale-session responses; no persisted private content |
| Physical deletion/retention clashes with evidence | Restrictive references, bounded case evidence and approved hold/review process |
| Evidence and report reasons leak through logs | Safe error codes only; redact content/URLs; audit access to moderation evidence |

## Testing strategy

### Backend unit and feature tests

Add separate Activity, Audience, Media, Moderation and Notification test suites. Preserve `EmployeeLifestyleTest` and existing workspace/module/notification regressions. Test policy outcomes for org A/B, active/suspended/exited employees, platform admin without employee, department head, unrelated HR admin, host, invitee, excluded attendee and moderator. Include forged organization/host/employee/media IDs and nested resource mismatches.

Cover draft isolation; publish field requirements; invalid/duplicate/ineligible invitees; all-or-none publish; audience immutability; invitations vs seats; going/declined/clear response; capacity null/1/full; material edit RSVP reset; cancellation; after-start restrictions; inactive host; subscription and flag changes. Test cost integer handling (not floating point), max lengths, timezone offsets, invalid DST local times and cancellation across midnight.

Test opt-out and re-opt-in: existing appreciation stays private; existing attendance names do not reappear; old reminders stay off; pending invitation access is explicitly unchanged by invitation preference. Verify generic notifications never contain title/address/photo/message content. Test same user after organization transfer: list, unread count, read-one and read-all cannot expose/alter old-tenant Life entries improperly.

### Real database concurrency

SQLite feature tests alone cannot prove row locking. On the production database engine, run two independent connections for last-seat RSVP; concurrent revoke/RSVP; cancel/RSVP; edit/publish; consent withdrawal/invite; worker duplicate insertion and stale lease recovery. Assert capacity invariant, unique constraints and one inbox entry per event key. Exercise deadlock retries with a consistent lock order. Run migration up on a production-shaped anonymized dataset and verify index creation time and existing table constraints; no production migration in discovery.

### Media and worker tests

Use malformed MIME, SVG disguised as JPEG, oversize dimensions, truncated image and GPS-tagged samples. Check metadata removal, authorized thumbnail/full delivery, cross-tenant attachment denial, unbound upload access, hidden target denial and storage deletion retry. Report evidence must remain case-scoped after original deletion, then be purged at its retention boundary.

Freeze clocks for 24h/1h reminders, late RSVP, reschedule, outdated versions, worker outage recovery and event already started. Crash after inbox insert and before acknowledgment; replay must not duplicate. Revoke access or consent between scheduling and execution; delivery must skip. Verify queue team context resets between tenants and no worker reuse leaks permissions.

### Mobile and web acceptance

Use independent host/invitee/outsider accounts across two tenants on physical Android and iOS devices plus desktop/mobile web. Verify login -> Home -> Life -> create -> invite -> RSVP -> edit/reconfirm -> cancel -> history. Include notification cold start, already signed-in wrong tenant, expired session, deleted target, denied photo permission, image retry, dark/light mode, screen reader, large text and low bandwidth. Ensure keyboard never hides save/RSVP/report controls.

Test missing network before submit and timeout after server success; a retry must not publish twice. No UI should claim Going before server confirmation. Verify no content survives logout/account switch. Test the router decision explicitly: deep links, back stack, tab preservation, entitlement changes and existing non-Life screens.

### Load, observability and pilot gates

Use a synthetic 2,000-employee tenant, 500 upcoming activities and 100 concurrent RSVP attempts. Proposed staging goals: list/detail p95 under 500 ms excluding image transfer; initial mobile list interactive under 2 seconds on agreed test network; no N+1 attendee/permission queries; reminder queue age under 2 minutes when healthy. These are targets to benchmark, not current measured capabilities.

Release requires: no cross-tenant/audience leak, no overbooking, no duplicate inbox delivery on replay, existing Lifestyle regressions green, mobile/web critical flows passing, queue/storage/retention monitors active and a staffed moderation process. Pilot analytics should be minimal and aggregate. Review incidents, participation and user feedback before adding Feed. Disable Activities by tenant flag on a critical incident, stop pending reminders, retain evidence and repair; do not erase data to roll back.

## What this discovery validated

Source inventory, proposed integration boundaries, documented contracts and repository isolation only. No code was edited, tests executed, migrations applied, workers installed or features enabled. Documentation references and repository diff are checked separately. Application lint/typecheck are not claimed: this assignment adds no application files and installs no dependencies. Implementation must run the required backend checks and mobile lint/typecheck plus the acceptance matrix above.
