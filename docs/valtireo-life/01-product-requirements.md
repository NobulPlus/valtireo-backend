# Product requirements

All functionality below is **proposed** unless marked existing. The repository inventory is the authority for what is implemented.

## Purpose and outcomes

Employees should be able to discover something relevant, invite colleagues, decide whether to attend and receive useful updates in a few clear steps. Life is optional participation; attendance, posts, appreciation and club membership must not become performance, payroll or disciplinary inputs.

Primary users are active employees, employee hosts and organization moderators. Administrators configure availability and nominate moderators; administrative rank does not confer access to private gatherings. Launch within one willing organization, across a few departments, with named hosts and moderators. Do not launch an empty feed or fabricate employee participation.

Measure aggregate pilot outcomes: published activities, activities receiving at least one RSVP, unique voluntary participants, invitation response rate, cancellations, failed reminders and unresolved reports. Collect no location tracking or inferred attendance. An RSVP is an intention, not evidence of presence. Avoid individual engagement scores and public leaderboards. Review weekly with pilot users; set numerical adoption targets after measuring the baseline. Reliability and privacy gates are mandatory regardless of uptake.

## MVP requirements and acceptance

| ID | Requirement | Acceptance |
|---|---|---|
| ACT-01 | Active employee creates a draft | Author and tenant come from session; other employees cannot find the draft |
| ACT-02 | Publish a valid activity | Title, description, future start/end, timezone, venue and audience required; invalid fields have actionable errors |
| ACT-03 | Discover eligible activities | Upcoming list, My activities and Invitations; filters never reveal inaccessible counts or titles |
| ACT-04 | Organization, department, invite-only visibility | Every list, detail, image, attendee and notification access uses the same policy |
| ACT-05 | Invite active eligible colleagues | Host selects individual employees, sees consent-respecting search, and can revoke invitations; no external addresses |
| ACT-06 | RSVP going or declined | Idempotent updates; last-seat race never exceeds capacity; host cannot mark others going |
| ACT-07 | Manage attendees | Host sees responses, removes attendees with a reason and can re-allow them explicitly; peers see only consented going names |
| ACT-08 | Change or cancel | Version conflict prevents silent overwrite; material edits notify affected participants; cancellation blocks new RSVP and reminders |
| ACT-09 | Informational cost and capacity | Display clear currency/amount and free label; no payment state or money handling |
| ACT-10 | Optional image | Only processed, authorized image is displayed; rejected/processing image never breaks publishing of a text-only activity |
| ACT-11 | Reminder and updates | Opt-in reminders at 24 hours and 1 hour before start; no duplicate delivery on retry; material updates visible in inbox |
| ACT-12 | Privacy and reporting | Preferences explain visibility; report explains moderator disclosure; hidden content disappears from discovery and images |
| ACT-13 | Home and full Life area | Small authorized preview links to detail; existing milestones and appreciation remain usable |
| ACT-14 | Accessible, resilient flows | Screen reader labels, large text, visible pending/error states; network failure never appears as confirmed RSVP |

## Activity fields and boundaries

- Title: trimmed plain text, 1–120 characters. Description: 1–3,000 characters, plain text; no HTML or link previews.
- Start and end: explicit timestamps with offsets plus an IANA timezone, default organization timezone (`Africa/Lagos` fallback). End after start; maximum 24-hour duration and scheduling up to 180 days ahead for the MVP. Display timezone next to time where it differs from the viewer's.
- Location: required name (1–160) and optional address (max 500). MVP is physical gatherings; no maps SDK, coordinates, geolocation, external meeting links or Connect integration. Only authorized viewers see the address; never include it in alert text.
- Cost: `free` or `estimated`, stored as non-negative integer minor units; `NGN` only initially, zero for free and positive for estimated. Show “Estimated per person; arranged by host outside Valtireo.” No transaction records, collection, expense approval or refund promise.
- Capacity: null for unlimited, otherwise 1–200 including the host. Host starts as going on publish, consuming a seat. Host can withdraw their own RSVP without ceasing to be organizer. Cannot reduce capacity below current going count.
- Image: optional one cover, JPEG/PNG/WebP, proposed 5 MB and 16-megapixel input limits; thumbnail plus resized display version. No SVG, GIF, remote image fetching, videos or attendee albums in MVP. Author confirms permission to use identifiable people's images; provide removal/report flow.
- Visibility: `organization`, `department`, `invite_only`; `community` reserved for phase 3 and rejected by MVP API. Department is the creator's current department; no cross-department custom audiences yet. Branch/cluster filters can follow measured demand.
- Invitation batch: up to 50 recipients per request and 200 unique invitees per activity. Invite-only draft must have at least one eligible invitee before publication. Invitations do not reserve seats.

## Lifecycle and interaction rules

Persist `draft -> published -> cancelled`; show completed when a published activity's end has passed. Moderation uses a separate hidden flag, not a fake cancellation by the host. Drafts can be edited/deleted. Published activities cannot be hard-deleted by a host; cancel them so participants retain understandable history. Cancel requires a 1–500 character reason shown only to eligible participants.

Audience is immutable after publication. To broaden or narrow it, cancel and create a new activity, with fresh invitations and RSVP. This avoids silently changing who can see an existing location or participation. Department membership is evaluated live. A department transfer revokes access if the employee is no longer eligible, including stale invitations and RSVP. Community membership will follow the same rule later.

After publication, host can update title, description, cover, venue, time, cost and capacity until start. A venue, time or cost change clears other employees' going responses to no response, frees their seats, and asks them to RSVP again; host remains going only if previously going. Their existing invitations remain active. Explain this before saving. Capacity-only or descriptive changes do not reset RSVP. Cannot move the start into the past. After start, only cancellation, participant removal, reporting and moderation are available; no late RSVP.

RSVP states: no response (absence/null), going, declined. No maybe or waitlist in MVP. Clearing a response releases its seat. Host removal creates an explicit exclusion which prevents rejoining even if the broader audience still matches; the employee sees only a generic removal notice, not the host's internal moderation reason. Host cannot remove their own organizer identity. Explicit re-allow permits a fresh voluntary RSVP, never automatic attendance.

Host suspension or exit blocks host actions immediately and triggers cancellation of future activities in reconciliation. Same for a department host moving out of the activity's department. No ownership transfer in MVP. Organization feature disablement suppresses discovery, publishing, RSVP and reminder delivery; hosts retain cancellation, participants retain withdrawal, and reporting/privacy access remains available while the underlying account/entitlement allows it. Entitlement lapse requires an organization support route for deletion/reporting; do not bypass global authentication safeguards.

## Later phases

Phase 2: chronological social feed with text posts, up to four processed photos, a small fixed reaction set, single-level comments, author edits/deletion and reporting. No DMs, anonymous posts, algorithmic ranking, follower graph, reposting or automatic milestone posts. Feed entry points can link to activities without copying private activity content. Display existing shared appreciation by reference only when current consent still permits it; no new reaction/comment surface on appreciation initially. Private appreciation stays in its participant-only view.

Phase 3: interest communities with name, description, cover, owner/moderators and explicit membership. Organization-discoverable communities can be open or approval-based; private communities are invite-only and undiscoverable to non-members. Community-scoped activities and posts reuse the audience policy and media system. No cross-organization federation. Archive dormant clubs instead of showing abandoned spaces. Community owners cannot grant organization-wide moderation rights.

Potential phase 4, subject to evidence: waitlists, recurring activities, calendar export, notification push, activity albums and optional Connect meeting references. Each needs its own acceptance criteria; none is a prerequisite for the Activities pilot.
