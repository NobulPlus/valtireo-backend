# Mobile employee experience review — 13 October 2026

## Verdict and scope

The app now covers a substantial employee self-service scope: login, dashboard, profile, leave and handover, attendance corrections, documents and signatures, payslips, tickets and comments, directory, calendar, and assigned assets/fault reporting. The next investment should be reliability and completing these journeys before adding more modules.

This is a review of the current implementation, API contracts, styles and navigation. It is not a visual certification of an installed Android/iOS build. Keyboard overlap, safe-area behavior, text scaling, touch targets and screen-reader behavior require device testing. No application code was changed by this review.

Verification: current lint and TypeScript checks passed; all six existing mobile contract tests passed. Additional isolated probes reproduced the directory filter, profile clearing and delayed token-event issues below. Those probes use mocked dependencies, not a live employee account. Existing tests do not exercise the new tickets, directory, calendar or asset screens end to end.

## Confirmed functional issues, in priority order

| Priority | Finding and employee impact | Evidence | Required correction |
| --- | --- | --- | --- |
| P1 | Session storage operations can complete out of order. A delayed token deletion emits a session-change event after a new token is saved; AuthContext responds by clearing the new session. | `src/lib/secureToken.ts:29`, `src/context/AuthContext.tsx:61`; reproduced by `outputs/mobile-review-probes.cjs`. | Serialize persistence, make session transitions deterministic, handle storage failures, and test delayed logout/re-login and offline reauthentication. |
| P1 | Reopening while offline or during a server failure shows Login despite retaining the token. There is no session-recovery retry screen. | `src/context/AuthContext.tsx` bootstrap keeps the token for non-401 errors; `src/navigation/RootNavigator.tsx` uses only session presence. | Separate checking-session, connection-failure and signed-out states. Offer retry without requiring credentials again. |
| P2 | “All departments” and leave handover “Everyone” omit `department_id=all`, so Laravel applies the viewer's department default. | `src/features/directory/api.ts:14`; backend `EmployeeController::directory`; probe confirms omitted parameter. | Send the explicit `all` value and reflect the API's returned scope. |
| P2 | Clearing email/address/next-of-kin fields can show Saved while preserving the old server value. Empty inputs become null, then the multipart serializer drops nulls. | `src/screens/ProfileScreen.tsx`, `src/features/profile/api.ts:37`; probe sends only `_method` for cleared fields. | Distinguish unchanged from intentionally cleared values and verify the persisted response. |
| P2 | History is silently truncated: tickets and assets fetch only 50 records; alerts only 30. Calendar only considers the first 100 records from its sources. | Feature hooks and list screens have no next-page path for these datasets. | Add pagination/load more; fetch the relevant date range for the agenda and disclose partial results. |
| P2 | Handover recipient selection exposes only the first 24 directory entries. A valid colleague may never be selectable. | `NewLeaveRequestScreen.tsx:29` always requests page 1; directory hook uses 24 per page. | Use a searchable, paginated person picker with loading/error states. |
| P2 | Attendance corrections cannot specify next-day checkout. Both times are combined with the same attendance date; local validation also accepts impossible values such as 99:99. | `RequestCorrectionScreen.tsx:20`. | Date-and-time selection, valid ranges, explicit company timezone and overnight-shift support. Server validation remains authoritative. |
| P2 | Subscription and permission helpers exist but are unused by the navigation/screens. Unavailable modules remain visible and lead to generic errors. | `hasPermission` and `moduleByKey` are only declared in AuthContext; Home, More and tabs use unconditional item lists. | Gate destinations and actions using entitlements and employee-experience settings, with a clear unavailable state. This is a UX finding, not evidence of bypassed server authorization. |

## Employee journey, from login to sign-out

### 1. Login and returning to the app

Keep the compact brand treatment and one clear sign-in action. Add show/hide password, password-manager hints, keyboard Next/Done behavior, field-level validation and a clear distinction between connection failure and invalid credentials. Add an account-help route; only offer password recovery once its backend flow exists. Show organization identity after authentication so the employee knows which workspace they entered.

On return, restore the session with an explicit retry state if connectivity fails. Expired sessions should explain why sign-in is required. Test temporary storage failure and session switching. Do not erase unfinished work merely because a request briefly fails.

### 2. Home and navigation

The consistent pine/lime palette, module icons, unread badge and four-tab layout are useful foundations. Home currently puts quick-access tiles before pending tasks, then repeats information across several cards. “Needs your attention” entries are plain text rather than actions.

Recommended order: greeting/workspace → urgent tasks → a small set of frequently used actions → current leave/attendance summary → upcoming events. Make each task lead to its specific item. Use plain labels such as “Documents to complete” instead of “Doc items.” Keep role/tenure information in Profile or lower on Home.

Keep navigation predictable. Test Home shortcuts into nested More stacks, Back from their first screens, and returning to a tab with a previously open form. The app uses React Navigation despite `AGENTS.md` requiring Expo Router; reconcile this before extending routing/deep links, rather than combining an unplanned migration with visual changes.

### 3. Profile and photo

The earlier photo fix remains: local storage URLs resolve against the mobile API address, Home renders the saved avatar, and image errors show initials. Still test save → leave screen → reopen → restart app on a phone. Add photo permission/error feedback, crop/preview, a remove/replace choice where supported, and visible upload progress.

Separate work details from editable personal/contact details. Keep Save available near the edited section, show inline errors, and warn before discarding edits. Fix intentional field clearing before further polish.

### 4. Leave and handover

The form now supports evidence, handover recipient, notes and a handover attachment. Improve the sequence: leave type and balance → dates → calculated days/policy requirements → handover → review → submit. Use date pickers; show evidence requirements from the selected leave type instead of always calling evidence optional. Replace long employee chip lists with a searchable selector. Allow removing an attachment.

After submission, show the actual request and its approval status rather than only an alert and a return to the list. Display approver/current step and rejection/change reasons where the API supplies them. Guard unsaved drafts and distinguish cancellation from editing.

### 5. Attendance

History and correction submission exist. Add period filters, a clear summary, and a correction-status view—the correction query exists but is not displayed. Fix overnight dates/timezone handling before expanding attendance entry. Do not label this as mobile clock-in/out: that journey is not implemented and needs company policy and server-side rules.

### 6. Service requests

This is now a strong functional addition: categories, attachments, routing, comments, cancellation and changes-requested resubmission exist. Simplify initial submission to category, issue and attachment; reveal optional routing under an advanced section or derive defaults from category. Explain urgency labels in employee language.

Open the created request after submission, showing its reference, status, owner and next step. Add searchable history, clear resolution/change reasons and a status timeline using available API data. Refresh detail on return/pull-to-refresh so a manager's reply becomes visible. Comment attachments need removal controls and consistent file-size/type feedback. Long badge rows and comments need narrow-screen/text-scaling tests.

### 7. Documents

Upload, open/share, acknowledgment and signed-copy submission exist. Group items by Needs action, Under review and Completed. Show why a file was rejected and provide the appropriate replacement/resubmission action. Explain signed-copy workflow: download → sign → upload → await review. Add a confirmation before acknowledgment, clear supported formats/size limits, and preview where feasible. Label share-sheet behavior accurately rather than implying every tap opens an in-app viewer.

### 8. Payslips

List pagination, net/gross/deduction details and download/share are present. Prioritize the latest payslip, add year/period filters, format dates naturally and distinguish earnings from deductions. Test PDF sharing and long amounts on small screens. A later “Ask payroll about this payslip” action should create a permission-scoped service request with explicit employee intent.

### 9. Directory

Search, department filters, contact actions and pagination exist. Fix the All-departments parameter first. Debounce search, replace a large wrapped department chip area with a picker, display the actual scope, and handle unavailable phone/email applications. Show only approved work-contact information.

### 10. Calendar

The combined agenda is a useful mobile format. Group by Today/This week/Upcoming and let employees filter holidays, events and leave. Show descriptions and distinguish pending leave from approved leave. Fix pagination/date-range coverage and use an explicit local/company date rather than UTC-derived “today” at midnight boundaries. If one source fails, identify the missing source while retaining successful results.

### 11. My assets

Employees can view assigned assets and report a fault. Add equipment detail and a clear post-report state explaining who handles it and what happens next. Photo evidence and incident tracking are valuable later additions but require corresponding API support. Fix pagination and test employee ownership checks against the changed backend controller/request files before release.

### 12. Alerts, help and sign-out

Alerts currently mark read but do not open the underlying request/document. Make the destination the primary tap action; handle removed or inaccessible records gracefully. Add pagination, feedback when mark-read fails, and reliable unread-count updates. Native push delivery is still absent and should be a separate backend/native-build phase.

Move sign-out into a discoverable Account area instead of the bottom of a potentially long Home feed. Include help, app version and account information. Protect unsaved drafts, clear private cached state on logout and verify that re-login never restores another employee's data.

## Shared UI and flow improvements

- Use consistent form fields, status badges, attachment rows, error messages, loading states and primary buttons rather than maintaining many near-identical screen styles.
- Review keyboard handling across all forms; only Login currently uses KeyboardAvoidingView. Preserve inputs on failed submission and add discard protection when leaving.
- Replace raw YYYY-MM-DD and backend status strings with readable dates and labels. Keep timezones explicit where times affect attendance.
- More uses a non-scrollable grid; Directory has a growing non-scrollable filter area. Test both with many departments, small screens and large text. Test fixed tab heights and device bottom insets.
- Make icon-only controls accessible, expose selected/disabled states, provide adequate touch areas and verify contrast, screen readers and large text on actual devices.
- Refresh stale data when the app becomes active or connectivity returns; no native AppState/focus/online integration is currently present. Avoid introducing sensitive offline caches without a deliberate policy.

## Recommended execution sequence

1. **Reliability:** session storage/recovery, directory scope, profile clearing, full history, handover search and correction dates. Add regression coverage for these bugs and new modules.
2. **Complete journeys:** actionable Home/inbox, request detail after submission, status/reason visibility, draft protection and consistent attachment handling.
3. **UI refinement:** simplify Home, introduce reusable form components and date/person pickers, improve keyboard/safe-area/accessibility behavior, consolidate Account/Help.
4. **Expansion:** scoped manager approvals and native push after the employee flows pass installed-device acceptance.

Before calling the experience ready, walk through each journey on an ordinary employee account, a restricted-module account and a scoped manager account, on Android and iOS. Include offline launch, server errors, token expiry, more-than-one-page datasets, rejected requests, failed uploads, large text and logout/re-login. The entire `mobile/` directory is still untracked in the root repository at review time; preserve this work in version control before release.
