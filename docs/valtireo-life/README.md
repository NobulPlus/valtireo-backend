# Valtireo Life: discovery and architecture proposal

Status: **proposed, for review; nothing implemented**. Prepared 18 October 2026.

Valtireo Life should help employees arrange time together, celebrate colleagues and build connections without turning workforce records into a public social network. Start with employee-created Activities. Retain existing milestones and appreciation. Add a lightweight feed only after the Activities pilot demonstrates demand and moderation capacity; add communities after that.

## Documents

1. [Product requirements](01-product-requirements.md): MVP boundaries, rules and acceptance criteria.
2. [Repository inventory and gaps](02-repository-inventory.md): implemented capabilities and source evidence.
3. [Journeys and mobile information architecture](03-journeys-and-navigation.md): employee flows, Home previews, navigation and component reuse.
4. [Database, APIs and background processing](04-technical-design.md): proposed schemas, contracts, transactions and notification delivery.
5. [Permissions, privacy and moderation](05-permissions-and-privacy.md): audience rules and tenant isolation.
6. [Delivery plan, risks and validation](06-delivery-and-validation.md): dependencies, complexity and release gates.

## Recommended decisions

- Keep the existing `employee_self_service` entitlement for the MVP. Add separate, default-off organization settings for Activities, feeds and communities; enabling one never changes existing employee consent.
- Introduce `life_activities`; do not repurpose `company_events`, employee profile activity logs or Connect meetings.
- MVP: timed, single-occurrence activities; organization, own-department or invite-only audiences; optional cover image; informational cost; capacity; invitations; going/declined RSVP; cancellation; database inbox reminders; basic reporting and moderation.
- No payments, waitlists, recurring events, external guests, public links, comments, reactions, chat, native push or communities in the MVP.
- Keep Life under More and preview it on Home. Do not displace the existing primary work tabs for an unvalidated feature.
- Start with initials for colleague avatars. Do not expose HR passport photos to support a social experience.
- Keep private appreciation private. Neither feeds nor communities may silently republish it.

## Review decisions before implementation

| Decision | Recommended default | Owner |
|---|---|---|
| Employee creation policy | Any active employee in an enabled pilot organization, subject to individual restriction | Product + organization administrator |
| Cost | Free or informational NGN amount; no collection, refunds or payment links | Product |
| Audience | Own department, entire organization, or explicit invitees; locked once published | Product + privacy owner |
| Attendee names | Host sees responses; peers see only attendees who opt to show their participation | Product + privacy owner |
| Moderation staffing | Named organization moderators and escalation contact before enablement | Organization |
| Retention | Proposed periods in privacy document; approve before launch | Organization + privacy owner |
| Mobile navigation | Resolve React Navigation versus Expo Router guidance in a separate prerequisite decision | Mobile owner |
| Native push | Later independent workstream; MVP reminders are in-app inbox items | Product |

These are recommendations for review, not requests to begin implementation.

## Inspection and isolation

Repository snapshot: `440250a4bb3f07c170ef78e20987e94f6f135ed7` (18 October inspection). Separate branch: `codex/valtireo-life-discovery`. Worktree: `C:/Users/USer/Desktop/valtireo/.worktrees/valtireo-life-discovery`.

Initial inspection included the current working checkout; source references were checked against the isolated snapshot. Existing uncommitted Connect work and `.claude/` were not copied into the proposal branch. Claude's existing tracked work in the snapshot is only a read-only baseline. The original checkout remains on its original branch. This proposal changes only new files under this documentation directory; nothing is staged, committed, merged, migrated or deployed.

Findings are based on source inspection, not a new runtime or security certification. No application tests were run for this documentation-only assignment. Existing tests are identified as coverage to preserve, not claimed to have passed today. Library choices and implementation syntax must be checked against installed versions when implementation is authorized.

Documentation checks: all six linked documents resolve; the isolated worktree has only the new `docs/valtireo-life/` directory as an untracked change, with no tracked or staged diff. The original checkout's pre-existing modified/untracked work remains present; the only added entry there is the nested `.worktrees/` directory. Do not stage that directory from the original checkout. Review these files from the documentation worktree; no commit was made.
