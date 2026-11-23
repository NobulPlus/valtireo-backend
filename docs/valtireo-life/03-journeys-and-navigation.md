# Employee journeys and mobile information architecture

This is a proposed experience, not implemented screens. Existing entry points are More > Lifestyle and Home > Life at work. Keep current web routes as compatibility entry points when introducing the label “Valtireo Life.”

## MVP navigation

Keep the existing bottom tabs. Within Life, use three sections: **Activities**, **Celebrations**, **Appreciation**. Place Preferences in the header. Activities opens an upcoming list with filters **Explore**, **My activities**, **Invitations**; My activities includes Hosting and Going, with a separate Past view. Celebrations wraps the existing birthdays/anniversaries experience; Appreciation retains Received, Sent and Shared, including private messages only in the appropriate personal views.

Logical destinations (not framework-specific route code):

| Destination | Entry | Important behavior |
|---|---|---|
| Life overview | More; Home preview | Activities default when enabled; retain existing enabled sections if Activities off |
| Activity detail | Card; invitation; inbox | Audience, host, date/time/zone, venue, cost, seats, image, own response; sticky RSVP |
| Activity composer | Create activity; own draft | Details -> audience/invitees -> review -> publish; retain draft after errors |
| Invite colleagues | Draft or host detail | Server-scoped paginated search; selected recipients; unavailable recipients flagged |
| Attendees | Detail | Host responses/manage view; peers only opt-in going names; no rejected/declined list for peers |
| Edit/cancel | Host overflow | Explain RSVP reset for material edits; cancellation confirmation and reason |
| Report | Detail/media overflow | Explain evidence disclosure; reason; confirmation; never leak reporter identity |
| Preferences | Life header | Existing consent plus invitations, reminders, participation visibility and Home preview toggle |
| Later Feed | Phase 2 only | Chronological list -> post detail -> comments; compose text/photos |
| Later Communities | Phase 3 only | Discover/My communities -> community -> posts, activities, members, rules |

Proposed web paths: `/me/lifestyle/activities`, `/me/lifestyle/activities/{uuid}`, `/me/lifestyle/activities/new`, with moderation at `/settings/lifestyle/reports`. Mobile must resolve these through an explicit internal destination map and confirm entity type/ID. Do not treat them as arbitrary external links. Preserve `/me/lifestyle` for existing appreciation alerts and bookmarks.

Mobile routing implementation is a phase-0 gate: the actual app uses React Navigation, while `mobile/AGENTS.md` mandates Expo Router. Prefer a separately planned, tested routing alignment before new routes; if the project owner instead authorizes retaining current navigation, document that decision first. Do not implement two independent routers. This proposal specifies navigation semantics and leaves framework migration unimplemented.

## Journey 1: discover and join

Amaka sees “ICT games evening · Friday · 8 places left” on Home, opens the detail, reads cost and venue, then taps Going. The confirmation displays current response and “Send me reminders” with its privacy default respected. Returning Home shows the next activity she is going to.

If another employee takes the last seat, the server returns `capacity_full`. Show the refreshed count and retain a clear Not going state; no optimistic success. If the activity is cancelled, show its cancellation state and reason only if Amaka remains eligible. If membership changed, show “This activity is no longer available” without old title, address or image.

## Journey 2: create a hangout

Babatunde chooses Create, enters “Saturday board games,” a future date/time in Africa/Lagos, venue, free or estimated cost, capacity and optional cover. He selects Invite only, chooses colleagues who permit invitations, reviews exactly who can see it, and publishes. His own going RSVP consumes one seat. The publication result lists successful invitations and any invalid entries through atomic validation: if any supplied invitee is invalid, publishing fails with a generic recipient error and the draft stays editable. No partially announced event.

Uploading a cover shows Processing, Ready or Failed. A failed image can be removed and the activity published without it. Closing the composer leaves a private server draft; cancelling the composer never accidentally publishes. Repeated publish taps use the same idempotency key.

## Journey 3: respond to an invitation

Ngozi opens a generic inbox alert, signs in if needed, then sees the activity after authorization. She can choose Going or Declined; declining frees capacity and does not notify peers. Pending invitation is not a reserved seat. Invite-only access survives a declined RSVP while the invitation remains active; she can reconsider before start if space remains. Revoked invitation removes access and cancels future reminders.

Turning off new invitations prevents future invitations but does not silently remove existing participation. Add “Leave activity” or clear RSVP to withdraw explicitly. Turn off reminders independently. No nudges for non-response in MVP.

## Journey 4: host updates or cancels

The host changes venue. A review step explains that other going attendees must reconfirm. Saving performs one versioned transaction, frees their seats, updates the detail and schedules generic update alerts. Employees reopen the current detail and RSVP again. A stale host screen receives a conflict and must reload before editing.

Cancellation immediately disables RSVP and pending reminders. Participants receive a generic cancellation alert, the detail displays Cancelled, and the event moves out of upcoming discovery. A notification delivery failure never reverses cancellation; background retry catches up.

## Journey 5: celebrate or appreciate

An opted-in colleague's anniversary appears in Celebrations using the existing computed data. “Send appreciation” may preselect the colleague only if appreciation reception is allowed. Default visibility remains private. No automatic public congratulation post, age, birthday year, tagging or photo disclosure. Withdrawing sharing consent removes eligibility from later feed projections as well as current appreciation views.

## Journey 6: report and moderate

An employee reports an activity or image they can view. The explanation states that the report and relevant content become visible to an organization moderator. The moderator sees a case with a bounded evidence snapshot, reason and audit history, and can dismiss or hide with a reason. Private content outside the reported target stays inaccessible. Hiding removes content and media from normal access; affected participants get a generic unavailable notice. Appeals use the named organization contact in MVP.

## Journey 7: later communities and posts

An employee joins an open Walking Club, or requests membership in an approval-based one. Only after membership approval can they view member posts or community activities. A private club is visible only through an accepted invitation. Leaving revokes access to club media and activities and clears future going RSVP. Community deletion becomes archive first; do not strand activities under an audience that no longer exists.

## Home previews

- Show at most two Activities items and one existing celebration/appreciation summary, below core work actions. Prioritize next Going activity, then pending invitation count, then nearest discoverable activity. Hide disabled/empty sections; show a low-key “Explore Life” entry only inside More when empty.
- Home and full lists consume the same backend visibility policy. Never fetch organization-wide content and filter it on the phone. Summary returns authorized counts and minimal fields; no location address, attendee roster or private appreciation excerpt.
- Invitation count means pending invitations; appreciation count means received, not unread. Separate the global notification unread badge.
- A user can hide Life previews without turning off participation or changing celebration consent. Avoid photo-heavy Home cards and autoplay.
- Reload on foreground and after mutations; purge cached details/media when access is revoked or session changes. Do not promise immediate removal of screenshots or already downloaded bytes.

## Reusable UI and states

Reuse mobile theme tokens, QueryError, ListFooterLoader, typed API wrappers and paginated query patterns; reuse web PageHeader, form controls, confirmation and toast patterns. Share API types, validation terminology and pure presentation logic where practical, not web/native rendering components.

Proposed components: ActivityCard, ActivityStatusBadge, AudienceSummary, DateTimeZoneField, CostField, CapacitySummary, EmployeePicker, RsvpControl, PrivateCoverImage, ReportSheet, EmptyState and PrivacyDisclosure. Cover images must use their own authorization-aware loader; do not reuse HR photo permissions by accident. Initially render employee initials consistently.

Every screen needs loading, retry, empty, disabled, offline and inaccessible states. Save errors retain entered text; no offline RSVP queue or automatic publish retry. Confirmation buttons disable while pending. Use local date labels with explicit zone, generous touch targets, screen reader announcements for RSVP and image progress, text alternatives for images, dynamic text and sufficient contrast. Test low-bandwidth Android devices and keyboard/screen-reader web flows before pilot.
