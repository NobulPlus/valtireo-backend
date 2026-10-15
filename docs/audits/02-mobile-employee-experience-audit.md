# Mobile employee experience audit — 15 October 2026

Scope: `mobile/` (Expo SDK 57, React Native 0.86.3, React Navigation v7, @tanstack/react-query v5, expo-secure-store). Read-only code audit plus local verification commands; no files outside this report were modified, nothing was committed, nothing was pushed.

## Verification run (exact commands and outcomes)

| Command | Result |
| --- | --- |
| `node --test tests/contracts.cjs` | **Pass.** `# tests 14`, `# pass 14`, `# fail 0`. Exit code `0`. |
| `npx tsc --noEmit` | **Pass.** No output, exit code `0`. |
| `npx expo lint` | **Pass with 1 warning.** `src/features/calendar/api.ts:3:10 'api' is defined but never used`. 0 errors, 1 warning. Exit code `0`. |
| `CI=1 npx expo export --platform android --output-dir <temp>` | **Pass.** Metro bundled 1185 modules in ~17.7s, produced a 3.1MB Hermes bytecode bundle (`index-4155bca1df07608f23a0e3dcc3c43c36.hbc`) plus 37 assets and `metadata.json`. Exit code `0`. Temp export directory deleted after inspection. |

The test count (14, in `mobile/tests/contracts.cjs`) is one higher than the brief's "~13" estimate — all are regression tests for previously-reported bugs (session-storage ordering, biometric hardening, overnight/timezone correction validation, calendar pagination, profile-clearing, directory `all` scope). Every one of those regression tests targets a finding from the 13 Oct review, which is itself strong evidence those fixes are real and not just claimed.

## Status of the 13 October 2026 review's findings

| # | Oct 13 finding | Status now | Evidence |
| --- | --- | --- | --- |
| P1 | Delayed token deletion emits a session-change event after a new token is saved; a late logout could clear a newer login. | **Fixed.** `secureToken.ts` now serializes all SecureStore writes through a `writeQueue` (`src/lib/secureToken.ts:69,90-110`) and publishes `notifySessionChange()` synchronously on the logical transition rather than after disk I/O. Covered by two new regression tests (`tests/contracts.cjs:102-137`: "late logout persistence cannot invalidate a newer login", "startup read cannot overwrite a newer login"). | `src/lib/secureToken.ts:66-110` |
| P1 | No session-recovery/offline-retry screen; reopening offline falls back to Login despite a valid token. | **Fixed.** `AuthContext` now has a distinct `reconnectError` state (kept, not cleared, on non-401 bootstrap failures) and `RootNavigator` renders a dedicated `ReconnectScreen` (cloud-offline icon, "Reconnect" retry, "Sign in with a different account") instead of Login. | `src/context/AuthContext.tsx:92-123`, `src/navigation/RootNavigator.tsx:48-57`, `src/screens/ReconnectScreen.tsx` |
| P2 | "All departments" / leave handover "Everyone" omit `department_id=all`, silently defaulting to the viewer's own department. | **Fixed.** `useEmployeeDirectory` sends `department_id: 'all'` explicitly whenever the filter value is `'all'` (truthy string), with an inline comment explaining the backend's omitted-vs-`"all"` contract. Regression-tested. | `src/features/directory/api.ts:11-23`, `tests/contracts.cjs:190-192` |
| P2 | Profile field clearing (email/address/next-of-kin) can show "Saved" while the server keeps the old value, because empty strings become `null` then get dropped by the multipart serializer. | **Fixed.** `useUpdateMyProfile` now always appends the key (sending `''` for an explicit `null`) instead of skipping it; only `undefined` (truly unchanged) is omitted. Regression-tested. | `src/features/profile/api.ts:32-44`, `tests/contracts.cjs:179-188` |
| P2 | History silently truncated: tickets/assets capped at 50, alerts at 30, calendar sources capped at 100 with no next-page path. | **Fixed for all four.** Tickets, assets and notifications now use the shared `useInfiniteList` hook (real `useInfiniteQuery` pagination, not a hard per_page cap) — `src/features/tickets/api.ts:11`, `src/features/assets/api.ts:7`, `src/features/notifications/api.ts:19-27`. Calendar uses `pagedResource` with an explicit "Load more" footer driven by `meta.total` — `src/features/calendar/api.ts:37-47`, `src/screens/CalendarScreen.tsx:46-52`. | as above |
| P2 | Handover recipient picker only shows the first 24 directory entries; no search. | **Fixed.** `NewLeaveRequestScreen` now uses `SearchableSelect` wired to `directoryQuery.fetchMore`/`onSearch`, a real paginated, searchable picker, not a chip list. | `src/screens/NewLeaveRequestScreen.tsx:44,137-152` |
| P2 | Attendance corrections can't express a next-day checkout; local validation accepts impossible times like `99:99`. | **Fixed.** `RequestCorrectionScreen` has an explicit "Check-out is the next day" toggle, and `correctionTimestamp()` validates with a strict `HH:MM` regex plus a real calendar round-trip check (rejects `99:99`, `24:00`, `12:60`, `2026-02-30`), and sends an explicit workspace `timezone`. Regression-tested. | `src/screens/RequestCorrectionScreen.tsx:21-44`, `src/lib/calendarDate.ts:1-8`, `tests/contracts.cjs:161-166` |
| P2 | Subscription/permission helpers (`hasPermission`, `moduleByKey`) exist but are unused; unavailable modules stay visible. | **Partially fixed.** `MainTabs` now conditionally registers the Leave/Attendance/Tickets tabs via `moduleByKey(...).can_access` (`src/navigation/MainTabs.tsx:42-44,69-71`); `MoreMenuScreen` and Home's Quick Access filter their tiles the same way (`src/screens/MoreMenuScreen.tsx:34`, `src/screens/HomeScreen.tsx:154`). Directory is correctly gated by the `allow_employee_directory` workspace setting rather than a module, with a comment explaining why. **Not done:** `hasPermission` itself is still declared on `AuthContext` but has zero call sites outside the context file — no screen uses it for action-level gating (e.g. hiding "Cancel ticket" if the permission were ever revoked independent of module access). | `src/navigation/MainTabs.tsx`, `src/screens/MoreMenuScreen.tsx:12-34`, `src/screens/HomeScreen.tsx:60-65,154` |

### Findings from the 13 Oct review that are still valid (not addressed)

- **Alerts don't open their underlying record.** `NotificationsScreen` only calls `markRead.mutate(item.id)` on tap; `action_url`, `entity_type`, `entity_id` exist on `NotificationEntry` (`src/types/api.ts:658-661`) but are never read anywhere in the app. Still exactly as described in the Oct 13 review.
- **New ticket/leave/document submissions return to the list, not the created record.** `NewTicketScreen`, `NewLeaveRequestScreen`, `UploadDocumentScreen` all `Alert.alert(...)` then `navigation.goBack()` rather than opening the new item's detail screen. (Minor relative to the P1/P2 items above, but still unresolved.)
- **No show/hide password toggle on Login/reset forms.** Still a plain `secureTextEntry` input with no reveal affordance.
- **No dedicated Account/Help screen with app version.** Sign-out *is* now fixed to a discoverable spot (see "never actually true" section below) but there is still no About/Help/version screen anywhere in `mobile/src/screens/`.
- **Native push notifications remain absent** (in-app inbox only) — explicitly out of scope per the review and the priorities doc; unchanged.

### Findings that turned out to be already resolved by the time of this audit ("never actually true" relative to this audit, i.e. fixed before I could confirm the bug live)

All P1/P2 items in the table above fall in this bucket — I did not find any case where the Oct 13 review's description of the underlying code was simply inaccurate; every finding I checked matched a real prior defect that has since been fixed with matching regression tests. I found no claim in the Oct 13 review that was never true.

### New observations beyond the Oct 13 review

- **Mobile has no top-level error boundary.** Commit `4811d41` ("Fix cross-session cache leakage and add a top-level error boundary") only touched `client/` (the web app — `client/src/components/ErrorBoundary.tsx`); there is no equivalent `ErrorBoundary` anywhere under `mobile/` (confirmed via repo-wide search). An unhandled render error in the mobile app has no recovery screen, unlike web.
- **Mobile's own cross-session cache leak protection is in place independently of the web fix**: `queryClient.ts` clears/cancels all React Query cache on every `onSessionChange` event (`src/lib/queryClient.ts:25-28`), and `AuthContext.clearSession`/`login` do the same before/after token writes (`src/context/AuthContext.tsx:86-90,148-149`). This looks solid and is exercised by the "late logout" and "download after logout" regression tests.
- **`goIntoMoreTab` nested-stack-reset helper is applied consistently** everywhere it is currently needed: all three Home-screen jumps into the More tab's nested stack (Quick Access → Assets/Documents/Payslips, header → Directory, document-compliance card → Documents) go through it (`src/screens/HomeScreen.tsx:48-53,62-64,183,323`). No other screen navigates into `MoreTab`'s nested routes from outside `HomeStack`, so there is no un-converted call site today — the pattern is small by scope but is not missing anywhere it should be.
- **Payslip filename and lifestyle in-app-alert-only preference are confirmed fixed** (per the task's stated recent-fix list): `downloadMyPayslip` now names the shared file `payslip-${reference}.html` (`src/features/payroll/api.ts:31-33`), matching the backend's actual HTML response; `LifestylePreferencesScreen`'s `appreciation_notifications` row explicitly states "No email or push notification is sent" (`src/screens/LifestylePreferencesScreen.tsx:9`).
- **Biometric sign-in hardening is real and tested.** `secureToken.ts` stores the biometric credential under `requireAuthentication: true` with a distinct keychain service (`BIOMETRIC_OPTIONS`, `src/lib/secureToken.ts:7`), splits the always-readable "identity" (email/name, for the Login screen's shortcut) from the gated "credential" (email/password, released only after native biometric auth), and migrates/deletes the old ungated key. Regression-tested (`tests/contracts.cjs:139-159`).
- **Sign-out location is fixed relative to the Oct 13 critique.** Sign-out is now an icon-only header button on the Home screen (`src/navigation/HomeStack.tsx:34-50`) with a confirmation `Alert`, not buried at the bottom of the Home scroll feed as previously described. It is still not inside a dedicated "Account" area with help/version info, which the review also recommended — that part remains outstanding.
- **No `react-native-safe-area-context` usage in app code**, despite it being a direct dependency. `SafeAreaProvider` wraps the app root (`App.tsx:60`), which is sufficient for React Navigation's own chrome (tab bar, native-stack headers), but custom full-bleed headers with hardcoded top padding — Login's hero (`paddingTop: 52`, `src/screens/LoginScreen.tsx:215`) and Home's hero (`paddingTop: spacing.lg` = 24, `src/screens/HomeScreen.tsx:390`) — never call `useSafeAreaInsets()`. This is unverified without a device/notch simulator, but is a real risk: on a tall-notch/dynamic-island device the greeting text or brand mark could sit closer to the status bar than on others, since the padding is a fixed constant rather than inset-aware.

## Screen-by-screen review

### Auth: Login, biometric, forgot/reset password
`src/screens/LoginScreen.tsx`, `src/screens/ForgotPasswordScreen.tsx`, `src/features/auth/api.ts`, `src/lib/biometrics.ts`, `src/lib/secureToken.ts`

- **Complete and verified.** Password login calls real `/auth/login` with `device_name` (`AuthContext.tsx:142-146`); forgot/reset password calls real `/auth/forgot-password` and `/auth/reset-password` (`features/auth/api.ts`) with a two-step email → 6-digit-code UI matching the described backend contract.
- Biometric sign-in is "unlock-then-normal-login": `loginWithSavedCredential` reads the gated SecureStore credential (native biometric prompt happens inside `SecureStore.getItemAsync(..., {requireAuthentication: true})`) then calls the same `login()` path as manual entry (`AuthContext.tsx:178-192`). If the server rejects the saved credential with a 4xx, the saved credential is dropped (`err.status !== 0 && err.status < 500`) rather than offered again forever.
- Login screen has `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`; same for ForgotPassword and SendAppreciation. (Three screens use `KeyboardAvoidingView`, not just Login as the Oct 13 review stated — grep confirms `LoginScreen.tsx`, `ForgotPasswordScreen.tsx`, `SendAppreciationScreen.tsx` are the only three.) Most other forms (leave, tickets, documents, profile, corrections) rely on a plain `ScrollView` with no `KeyboardAvoidingView`, so a focused multi-line field near the bottom of a long form (e.g. the ticket description, leave reason) can still be covered by the keyboard on some devices — unverified without a device.
- Missing: show/hide password toggle; no "which workspace am I in" identity shown before login (only after, in the Home header).

### Home dashboard
`src/screens/HomeScreen.tsx`, `src/features/dashboard/api.ts`

- **Complete and verified** against `/dashboard/me` (`useMyDashboard`). Renders pending actions, leave/attendance/document stat tiles, role card, attendance-this-month card (only if there's something to show), document-compliance list with a Documents link, handover-coverage card with a real handover-document download, leave balances, and next-holiday banner — all conditionally rendered on real payload fields (`data.pending_actions`, `data.leave`, `data.attendance`, `data.document_compliance`, `data.work`, `data.tenure`, `data.next_holiday`).
- Quick Access tiles (`My assets`, `Documents`, `Payslips`) are filtered by `moduleByKey(...).can_access`, addressing the module-gating gap from Oct 13.
- "Needs your attention" pending actions are still plain text bullets (`data.pending_actions.map(...)`, no per-item tap target) — unchanged from the Oct 13 critique.
- Pull-to-refresh wired (`RefreshControl` → `refetch`).

### Leave (`LeaveStack`)
`LeaveListScreen.tsx`, `NewLeaveRequestScreen.tsx`, `src/features/leave/api.ts`

- **Complete and verified.** Real infinite list against `/leave/requests`; cancel (`PATCH .../cancel`) with confirmation; evidence/handover document view via authenticated download+share (`downloadAndShare`); handover-to picker is a real searchable, paginated `SearchableSelect` against `/employees/directory`; leave-type list filters by the employee's own gender against `restricted_to_gender`, matching the web app and noting the backend still enforces this independently.
- Submission still ends in `Alert` + `navigation.goBack()` rather than opening the new request.
- Dates are raw `YYYY-MM-DD` text inputs, not a date picker (unchanged from Oct 13).

### Attendance (`AttendanceStack`)
`AttendanceListScreen.tsx`, `RequestCorrectionScreen.tsx`, `src/features/attendance/api.ts`

- **Complete and verified.** Infinite-scroll `/attendance/records`; correction submission posts a real `timezone` + validated ISO-ish timestamps to `/attendance/corrections`, with overnight-shift support and regex+calendar validation (see table above).
- `useMyAttendanceCorrections()` (querying `/attendance/corrections`) exists in `features/attendance/api.ts` but **has no screen that renders it** — there is no "my pending corrections" status view anywhere in the attendance stack. This specific Oct 13 complaint ("the correction query exists but is not displayed") is **still true**.
- No clock-in/out mobile action exists, correctly — matches the explicit scope decision to defer that.

### Tickets (`TicketsStack`) — "Service Desk" employee side
`TicketsListScreen.tsx`, `NewTicketScreen.tsx`, `TicketDetailScreen.tsx`, `src/features/tickets/api.ts`

- **Complete and verified.** This is the most fully built-out flow: category/priority/department/assignee selection with cascading resolver filtering, attachment upload, cancel with confirmation, changes-requested resubmission with pre-filled fields, threaded comments with attachments, and authenticated attachment open/share for both the ticket and each comment. Sectioned Open/History list via `isActiveTicket`.
- Matches the "strong functional addition" verdict from Oct 13; the earlier recommended simplifications (collapse routing into an advanced section, explain urgency labels) are UX polish, not functional gaps, and remain unaddressed but non-blocking.

### Documents (`DocumentsStack`)
`DocumentsListScreen.tsx`, `UploadDocumentScreen.tsx`, `src/features/profile/api.ts`

- **Complete and verified.** Upload, authenticated open/share, acknowledge (for `signature_method: 'acknowledge'`), and signed-copy submission (for `signature_method: 'signed_copy'`, gated to `awaiting_signature|rejected|changes_requested`) all call real endpoints. Client-side 10MB size check before upload.
- Not grouped into Needs action / Under review / Completed sections as recommended — still a flat list ordered by API response.
- No visible reason/comment surfaced for a rejected/changes-requested document beyond the status badge — the Oct 13 "explain why rejected" recommendation is unaddressed.

### Payslips (`PayslipsStack`)
`PayslipsListScreen.tsx`, `PayslipDetailScreen.tsx`, `src/features/payroll/api.ts`

- **Complete and verified.** Infinite-scroll `/payroll/me/payslips`; detail view breaks out gross/deductions/net and line items; download now correctly names the file `.html` (fixed, see above) and shares via the OS sheet.
- No year/period filter on the list (still a flat chronological list) — unaddressed from Oct 13.

### Directory
`DirectoryScreen.tsx`, `src/features/directory/api.ts`

- **Complete and verified**, and the P2 "All departments" bug is fixed (see table). Search is a plain controlled `TextInput` with no debounce — every keystroke re-fires `useEmployeeDirectory`'s query (React Query will dedupe/cancel in-flight requests via its own key change, but there is no explicit `setTimeout`/`useDeferredValue` debounce) — still matches the Oct 13 "debounce search" suggestion, unaddressed.
- Department filter is now a `SearchableSelect` modal picker, not a wrapped chip row — the Oct 13 "replace with a picker" recommendation is done.
- Tap-to-call/email uses `Linking.openURL('tel:'/'mailto:')` with no guard for "no app available" (`Linking.canOpenURL` not checked) — unverified failure path.

### Calendar
`CalendarScreen.tsx`, `src/features/calendar/api.ts`, `src/lib/calendarDate.ts`

- **Complete and verified.** Combines company events, (leave-module-gated) holidays and the employee's own active leave into one sorted agenda; "today" is computed via `Intl.DateTimeFormat` against the workspace's actual timezone (`todayInZone`), not local-device-midnight-UTC. Real "Load more" pagination driven by each source's `meta.total`. If the leave module is disabled, holiday/leave sources are cleanly skipped (`leaveEnabled` gate) rather than erroring.
- Not grouped into Today/This week/Upcoming sections, and there's no filter to show/hide holidays vs. events vs. leave — both Oct 13 suggestions remain unaddressed (cosmetic, not functional).

### My assets
`AssetsListScreen.tsx`, `ReportFaultScreen.tsx`, `src/features/assets/api.ts`

- **Complete and verified.** Infinite-scroll `/assets`; fault reporting posts to `/assets/{id}/report-fault` and invalidates the list. No equipment detail screen (specs, assignment history) and no explicit "what happens after you report a fault" messaging beyond the submit confirmation — both still open per Oct 13.

### Profile, dependents, emergency contacts
`ProfileScreen.tsx`, `DependentsScreen.tsx`/`DependentFormScreen.tsx`, `EmergencyContactsScreen.tsx`/`EmergencyContactFormScreen.tsx`, `src/features/profile/api.ts`

- **Complete and verified.** Read-only work fields separated from editable personal fields; gender capture explained ("Used to show you the right leave types"); photo picker with "Photo selected, tap Save to upload" messaging; the field-clearing bug is fixed (see table). Dependents/emergency contacts are full CRUD with icon-only edit/delete actions (both carry `accessibilityLabel`, consistent with the icon-only-action-button rule) and delete confirmation dialogs.
- No crop/preview step for the picked photo, no visible upload-progress indicator during the actual multipart POST (only a disabled-button spinner) — unaddressed from Oct 13.

### Notifications
`NotificationsScreen.tsx`, `src/features/notifications/api.ts`

- **Partially implemented.** List/filter (All/Unread)/mark-one-read/mark-all-read and real infinite-scroll pagination (fixing the Oct 13 "only 30 alerts" truncation) all work against real endpoints. **Tapping a notification still only marks it read and never navigates anywhere**, even though the API payload (`action_url`, `entity_type`, `entity_id`) supports it — this is the one Oct 13 finding I can confirm is still fully live, unchanged, with no partial progress.

### Lifestyle / appreciation
`LifestyleScreen.tsx`, `SendAppreciationScreen.tsx`, `LifestylePreferencesScreen.tsx`, `src/features/lifestyle/api.ts`

- **Complete and verified.** Feature-flag-gated (`features.milestones_enabled`, `features.appreciation_enabled`) with correct messaging when a flag is off rather than an empty/error state; scoped appreciation feed (all/received/sent/shared) with infinite scroll; send flow with a searchable recipient picker and a shared-visibility toggle that's disabled client-side when the recipient hasn't opted in; report-message modal; delete-own-message with confirmation; preferences screen uses real accessible switch semantics (`accessibilityRole="switch"`, `accessibilityState={{checked, disabled}}`) and explicitly documents the in-app-only alert preference (confirms the task's stated recent fix).

## UX quality dimensions (cross-cutting)

- **Navigation correctness.** `goIntoMoreTab`'s nested-stack-reset trick is correctly and consistently applied everywhere it's needed (see above); no stray tab registration gaps — `MainTabs` only registers Leave/Attendance/Tickets tabs when the module is accessible, avoiding the "hidden tabBarButton still reserves a flex slot" bug the code comments describe guarding against.
- **Accessibility.** Icon-only action buttons consistently carry `accessibilityLabel` (header icons, lifestyle/ dependents/emergency-contacts row actions, sign-out). Only 12 files use `accessibilityLabel`/`accessibilityRole` at all (22 occurrences total, repo-wide grep) — most screens' primary CTA `Pressable`s (Submit, Save, Send) have no explicit `accessibilityRole="button"`, relying on RN's implicit role inference for `Pressable`, which is inconsistent across platforms/screen readers. Touch targets generally meet ~44px via `spacing.sm+2`/`spacing.md` vertical padding, but this is unverified on a real device/VoiceOver-TalkBack pass.
- **Keyboard handling.** Only 3 of ~20+ form-bearing screens use `KeyboardAvoidingView` (Login, ForgotPassword, SendAppreciation); the rest are plain `ScrollView`s. Not necessarily broken (short forms, `ScrollView` + `keyboardShouldPersistTaps` often suffices), but unverified for longer forms (new ticket, new leave request) on small screens.
- **Safe-area handling.** `SafeAreaProvider` wraps the app (`App.tsx:60`), covering React Navigation's own chrome, but no screen calls `useSafeAreaInsets()` directly; Login's and Home's custom hero headers use fixed pixel padding. Unverified risk on notch/dynamic-island devices, not a confirmed bug.
- **Loading/error/offline recovery.** Every list screen consistently distinguishes loading (`ActivityIndicator`)/error (`QueryError` with retry)/empty states. `apiClient.ts`'s response interceptor correctly scopes 401/403 handling to the *current* token (`belongsToCurrentSession` check) so a stale in-flight request from a just-replaced session can't force-logout the new one — directly defends against the class of bug the Oct 13 P1 findings described. `ReconnectScreen` closes the "offline reopen shows Login" gap.
- **User feedback.** Destructive actions (cancel ticket/leave, delete contact/dependent/appreciation) are consistently behind a confirming `Alert.alert` with a `style: 'destructive'` option. Async submissions consistently disable their button and swap in an `ActivityIndicator` while pending.

## Classification table

| Area | Classification | Notes |
| --- | --- | --- |
| Login (password) | Complete and verified | Real `/auth/login`, error surfaced from `ApiError` |
| Biometric sign-in | Complete and verified | Gated SecureStore credential, regression-tested, drops dead credential on 4xx |
| Forgot/reset password | Complete and verified | Real `/auth/forgot-password`, `/auth/reset-password`, 6-digit code flow |
| Session bootstrap / reconnect | Complete and verified | `ReconnectScreen` + generation-tracked bootstrap |
| Home dashboard | Complete and verified | Fully data-driven off `/dashboard/me`, module-gated quick access |
| Leave list/request | Complete and verified | Full CRUD-ish flow; minor polish gaps (no date picker, no post-submit detail) |
| Attendance history/correction | Complete and verified | Overnight/timezone handling fixed; correction *status* view is **Missing** |
| Tickets (service desk) | Complete and verified | Most complete flow in the app |
| Documents | Complete and verified | Upload/ack/signed-copy all wired; no rejection-reason display |
| Payslips | Complete and verified | Filename bug fixed; no period filter |
| Directory | Complete and verified | "All departments" bug fixed; search unthrottled |
| Calendar | Complete and verified | Real pagination, correct timezone-aware "today" |
| My assets / report fault | Complete and verified | No asset detail screen |
| Profile / dependents / emergency contacts | Complete and verified | Field-clearing bug fixed; no photo crop/progress UI |
| Notifications | Partially implemented | Pagination/mark-read work; tap-to-open destination is **Missing** |
| Lifestyle / appreciation | Complete and verified | Feature-flag aware, in-app-only alert preference confirmed |
| Push notifications | Missing | Explicitly out of scope; in-app inbox only |
| Manager approvals | Missing | Not part of this employee-facing build (per priorities doc, Phase 2) |
| Clock-in/out (GPS/biometric attendance) | Missing | Deliberately not implemented; correctly not implied anywhere in the UI |
| Top-level error boundary (mobile) | Missing | Web has one (`client/src/components/ErrorBoundary.tsx`); mobile does not |
| Account/Help/About screen | Missing | No version/help surface found anywhere under `mobile/src/screens/` |

## Key file references

- Session/storage hardening: `mobile/src/lib/secureToken.ts`, `mobile/src/context/AuthContext.tsx`, `mobile/src/lib/apiClient.ts`, `mobile/src/lib/queryClient.ts`, `mobile/src/lib/sessionEvents.ts`
- Navigation: `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/MainTabs.tsx`, `mobile/src/navigation/MoreStack.tsx`, `mobile/src/screens/HomeScreen.tsx` (`goIntoMoreTab`)
- Regression tests: `mobile/tests/contracts.cjs` (14 tests, all passing)
- Notifications gap: `mobile/src/screens/NotificationsScreen.tsx`, `mobile/src/types/api.ts:650-665`
- Attendance correction status gap: `mobile/src/features/attendance/api.ts:11-16` (`useMyAttendanceCorrections`, unused by any screen)
