# Permissions, privacy and moderation

This is a proposed product security model, not a legal compliance opinion or a claim that these controls already exist. Privacy/retention decisions need organizational review before rollout.

## Authorization order

1. Authenticate through existing Sanctum session and apply account/organization revocation middleware.
2. Derive organization from authenticated user, never request body/query/header. Require non-null organization. Employee APIs resolve an active same-organization employee.
3. Check `employee_self_service` entitlement and relevant Life feature flag. Existing platform-admin entitlement bypass does not bypass Life row policies.
4. Scope resource lookup to tenant, then evaluate audience, status, exclusions and ownership. Return 404 for inaccessible records to avoid revealing their existence.
5. Check action permission and individual restrictions. For mutations, repeat state-dependent checks within the transaction; request-time authorization alone is insufficient.

New permission proposals: `life.configure` for organization feature configuration, `life.moderate` for cases/hide/restrictions. Existing appreciation moderation retains `workspace_settings.update`; do not silently broaden or remove current behavior. New Life settings must also pass any existing workspace-settings route/request authorization; grant both required rights to the appropriate configuration role or introduce a separately scoped configuration endpoint in implementation review. `company_events.manage`, `employees.view_all` and `organizations.administer` do not automatically grant access to private Life content.

## Audience matrix

| Audience | Discovery / detail | Creation | Invitations |
|---|---|---|---|
| Organization | Active employees in same tenant, excluding removed participants | Active unrestricted employee when enabled | Active same-tenant employees who allow invitations |
| Department | Active same-tenant employees with current matching department | Creator's current department only | Same department and invitation opt-in; invitation never overrides audience |
| Invite only | Host or explicitly active invitee, all currently active in same tenant | Active unrestricted employee | Individually selected consenting employees; no shared links or invite chains |
| Community (later) | Current active members in same tenant; private club existence also restricted | Active member, subject to club posting rules | Current members only for community-scoped activity |

Drafts are host-only regardless of intended audience. Published audience cannot change. Responses do not confer access by themselves. A forwarded URL, old notification, employee relationship, former department, former membership or knowledge of UUID is not a grant. Counters, thumbnails, search suggestions and Home previews apply the same audience rules.

## Action matrix

| Action | Ordinary employee | Host / author | Organization moderator |
|---|---|---|---|
| Read content | Only if audience permits | Own drafts and permitted published content; loses access if account revoked | Normal audience or bounded reported target; no private browsing privilege |
| Create/publish | If enabled and unrestricted | Same | No automatic host impersonation |
| Edit/cancel activity | No | Own activity within lifecycle rules | Hide reported content; no silent edits or attendance changes |
| RSVP | Self only if eligible | Self only, same seat rules | Cannot force RSVP |
| List responses | Own response; consented going peer names | All responses for own activity, minimal identities | Not automatically; only evidence necessary for reported conduct |
| Invite/remove/re-allow | No | Own activity, within audience | Restrict abusive actors through audited moderation, not host impersonation |
| Report | Any visible published target | Same, excluding frivolous self-report workflow | Can triage same-tenant cases |
| Hide | No | Cancel activity or delete own draft; does not erase reports | Reported target only, reason and audit required |
| Configure feature | No | No | Only with separate configuration permission |

Platform support has no default content access. If support access is later needed, design a separate time-bounded, tenant-authorized, audited process rather than adding a superuser bypass. Employees with moderation rights still use ordinary audience rules in employee endpoints; moderator endpoints expose only case-scoped evidence.

## Employee privacy

- Preserve all existing opt-outs and private appreciation defaults. Enabling Life never opts employees into birthdays, anniversaries, appreciation, invitations or public participation.
- Invitation opt-in defaults false. First-use explanation offers an explicit switch. Employees can still discover eligible organization/department activities and RSVP without enabling invitations. Hosts see a neutral “No eligible colleagues found” when none permit invitations; never expose why an individual is absent.
- Going count is visible to eligible activity viewers to explain capacity. Attendee names are optional to peers and off by default; explain that the host sees the employee's identity and response regardless. Peers never see declined responses, non-responders, contact details or reasons for withdrawal/removal.
- Individual participation is not exported to HR/performance tools. Aggregate metrics suppress small groups (proposed minimum group size 10) and exclude private activity breakdowns from management dashboards.
- Store free-text venue only; do not request device location. Encourage public/workplace venues and warn hosts before posting a personal home address to an organization-wide audience.
- Start with initials. Existing passport photo remains an HR asset under its current permissions. A later optional Life avatar needs separate consent, private media authorization and explicit synchronization policy; never silently mirror HR photos.
- Cover photos may contain other people. Require uploader rights acknowledgment, clear reporting/removal, strip GPS metadata and prohibit face recognition/tagging in the MVP. Acknowledgment alone is not proof of consent.
- Preferences remain editable while individual feature flags are off. Withdrawal clears existing shared attendance visibility and pending optional reminders; opting back in affects future actions only. Cache invalidation removes loaded content on the next revalidation/session transition; screenshots and previously received bytes cannot be recalled.
- No shared device persistent Life cache, public media URL or personal content in push/email/logs. Generic inbox entries still need current-tenant filtering and should be purged/anonymized under retention.

## Moderation and abuse prevention

Activities launch only with a named moderator, visible rules and a support/escalation contact. Reports require current target visibility and a category (`harassment`, `inappropriate_content`, `privacy`, `spam`, `other`) plus explanation. Display: “Reporting shares this activity and relevant images with your organization's moderator.” Preserve a bounded snapshot at report time so edits cannot erase evidence; exclude unrelated attendees and private activity history. Reporter identity is available only where needed for case handling, never in public responses or host-facing notifications. Default moderator case UI uses a case ID rather than advertising the reporter's name.

Report states: open -> in_review -> resolved (hide/restrict) or dismissed, with actor/reason/time. Repeated reports update the existing employee/target case and audit that change, avoiding duplicate queue flooding. No automatic hide based purely on report count. A moderator cannot review a report about their own activity; route to another authorized moderator or configured escalation contact. If no alternate exists, report stays open with an escalation alert; do not expose it to an unauthorized platform employee.

Hiding denies content/media/RSVP and suppresses reminders. Keep generic participant notice and report evidence; do not pretend the host cancelled. No restore feature in MVP; mistaken hiding is handled through the organization escalation process and a new activity if approved. Restrictions can be temporary or indefinite with explicit reason; employees retain reporting, preference withdrawal and cancellation rights while creation/inviting is restricted.

Suggested pilot limits (configurable server-side, not contractual promises): 5 publishes per employee/day, 10 writes/minute, 50 invitation recipients/request, 200/activity, 100 new invitations/employee/day, 10 uploads/hour, 20 reports/day. Apply employee and tenant budgets so many accounts cannot overwhelm one organization. Return 429 with retry information. Avoid exposing another employee's opt-out through validation or picker results. Invitations are individual, not organization-wide notification blasts; published organization activities appear in discovery without notifying every employee.

Plain-text render all user content. No link previews, arbitrary URLs in image import, executable uploads, payment links in structured fields, external guests or anonymous posting. Later posts/comments inherit the same controls plus fixed reaction types, single-level comments, author edit history for moderation and club owner limits.

## Retention and deletion proposal

These periods are design defaults to approve, not a statement of statutory requirements:

| Data | Proposed policy |
|---|---|
| Abandoned drafts | Delete after 30 days inactivity; attached unreported media purged |
| Unattached uploads | Purge after 24 hours; rejected files purged promptly |
| Completed/cancelled activities and participant responses | Retain 180 days after end/cancellation, then purge/anonymize identifiable content and media |
| Life inbox notifications / delivery rows | Purge 90 days after delivery or skip, unless needed for an active case |
| Resolved reports and moderation actions/evidence | Retain 180 days after resolution, then purge unless documented organizational hold applies |
| Security/operational logs | Proposed 30 days; identifiers/error codes only, no message or image content |

Retention jobs are tenant-aware, idempotent, audited and remove object storage as well as database references. Pending reports pause deletion only for bounded case evidence, not all employee records. Holds must have owner, reason and review date. Employee exit blocks access immediately; public identity may be anonymized, while required case evidence stays restricted until expiry. Handle organization deletion and backup expiration through the existing platform retention process; deletion cannot truthfully be promised instant across backups without operational verification.

## Security invariants to test

- Tenant A cannot enumerate Tenant B content, media, attendee counts, search, reports or delivery records using guessed IDs.
- List visibility equals detail/media visibility; parent hide/revocation also hides descendants and references in later feeds.
- Employee directory/HR permissions never grant social private access; moderator private access is report-scoped.
- Mutation payloads cannot set tenant, host, author, hidden status or someone else's RSVP.
- Background jobs cannot leak data after transfer, exit, consent withdrawal, membership removal, flag disablement or subscription lapse.
- A stale authenticated response or image request cannot populate another signed-in user's cache.
