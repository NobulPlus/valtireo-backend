# Valtireo mobile: next feature priorities

The mobile app should cover short, frequent employee tasks and time-sensitive manager decisions. The existing web application and Laravel API are the source of truth for permissions, subscriptions, approval rules and employee visibility.

## Current foundation

Implemented screens cover sign-in, employee dashboard, profile, leave requests, attendance history/corrections, documents, payslips and an in-app notification inbox. Compilation and focused contract checks are available; installed-device acceptance remains necessary.

The profile-photo fix resolves local Laravel storage URLs against the configured mobile API origin, preserves external CDN URLs, renders the saved photo on Home and Profile, and displays initials if an image cannot load. Saving updates the cached profile immediately; selecting a photo alone does not upload it.

## Recommended delivery order

| Phase | Feature | Mobile experience | Existing support and remaining work |
| --- | --- | --- | --- |
| 1 | Service requests | Submit HR/IT requests, attach a photo or document, track status, read and reply to comments | Web tickets screens and `/tickets` API exist. Port employee flows, pagination, attachments and permitted transitions. |
| 1 | Colleague directory | Search by name/department, view work contact details, tap to call or email | `/employees/directory` and web directory exist. Preserve the API's visibility scope; do not use broad employee-list responses. |
| 1 | Calendar | Upcoming holidays, company events and personal leave in a compact agenda | Company events and leave APIs exist. Combine these in a mobile agenda with consistent date/time handling. |
| 1 | My assets | View assigned equipment and report a fault with context | Asset list and report-fault API exist. Keep scope to the signed-in employee and respect the assets subscription. |
| 2 | Manager approvals | View permitted pending requests, inspect details, approve/reject/request changes with required notes | Approval APIs exist. Use server authorization and actionable state; prevent repeated submission and refresh after a decision. |
| 2 | Actionable Home and inbox | Open the relevant request/document from an alert; show next actions and unread count | Dashboard and notification APIs exist. Map supported destinations, handle missing or no-longer-permitted items. |
| 3 | Push notifications | Timely approval, request and document updates that open the correct screen | Requires device-token registration, backend delivery, notification permissions and installed-build testing. An in-app inbox alone is not push delivery. |

## Improve the existing flows alongside phase 1

- Use date/time pickers for leave and corrections; show leave balances, evidence requirements and handover fields before submission.
- Surface attendance correction status. Treat clock-in/out as a separate change: first establish server-authoritative time, duplicate-request handling and whether company policy allows mobile attendance. Do not imply GPS attendance exists.
- Gate navigation and actions by module availability and permissions, and explain unavailable features.
- Keep loading, empty, error and offline states distinct; preserve form drafts on recoverable failures and prevent duplicate submissions.
- Use a small set of primary tabs with a More area for less frequent features. Follow `mobile/AGENTS.md` and migrate navigation to Expo Router before expanding routes.

## Release acceptance

Each delivered feature must be tested on a physical phone with an ordinary employee and, where applicable, a scoped manager. Verify another employee's private records are inaccessible, missing subscriptions are handled, attachment upload/download works, expired sessions recover, and failures do not appear as success or empty data. Run lint, typecheck, contract tests and both platform exports. Configure stable HTTPS API hosting before distribution outside the local Wi-Fi environment.

The recommended next implementation batch is service requests and the colleague directory. These provide daily utility using existing server capabilities; calendar and assets follow without expanding into full desktop administration.
