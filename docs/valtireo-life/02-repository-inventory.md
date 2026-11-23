# Existing capabilities and gaps

Source inspection at commit `440250a4bb3f07c170ef78e20987e94f6f135ed7`. Paths below are relative to repository root. “Existing” means source is present; it does not assert deployment or current test success.

## Inventory

| Area | Existing evidence | Gap / proposed response |
|---|---|---|
| Stack | `server/composer.json`: Laravel ^13.8, Sanctum ^4.3, Spatie permission ^8.3, auditing ^14.0. `mobile/package.json`: Expo ~57.0.28, RN 0.86.3, React 19.2.3, TanStack Query; web React application in `client/` | No new service or framework needed for Activities. Check installed-version APIs at implementation time |
| Lifestyle backend | `server/app/Http/Controllers/Api/EmployeeLifestyleController.php`, `server/app/Services/EmployeeLifestyleService.php` | Extend through new controllers/services rather than making the appreciation controller a generic social controller |
| Milestones | Opt-in active same-organization employees; birthdays omit birth year/age; anniversaries include service years; timezone windows 1–90 days, Feb 29 policy | Preserve computed milestones and consent. Do not persist birthday posts or duplicate personal dates |
| Appreciation | Private/shared text, recipient opt-in, paginated scopes, withdrawal permanently privatizes shared messages; participant removal | Not a general feed: no arbitrary posts, reactions, comments, photos or activities |
| Reporting | Report visible appreciation; repeated report updates existing row; only reported content reaches moderators; hide records actor/reason/time | Need activity report cases, resolutions, restrictions, media removal and operational moderation workflow |
| Database | `2026_10_13_200000_create_employee_lifestyle_tables.php`: preferences, appreciations, reports. `2026_10_14_200000_add_appreciation_alert_preference.php`: alert opt-in | New additive Life tables; no change to historical migrations or consent defaults |
| Organization controls | `WorkspaceSettingsService.php`, `UpdateWorkspaceSettingsRequest.php`: only `milestones_enabled` and `appreciation_enabled` are accepted lifestyle setting keys | Add validated Activities controls; adding a client switch alone will not work |
| Web | `client/src/features/lifestyle/LifestylePage.tsx`; `/me/lifestyle`, `/settings/lifestyle` in `client/src/App.tsx`; `navConfig.ts` | Employee preferences, appreciation and moderator hide UI exist; add Activities UI and proper moderation queue alongside them |
| Mobile | `mobile/src/screens/LifestyleScreen.tsx`, `SendAppreciationScreen.tsx`, `LifestylePreferencesScreen.tsx`; feature hooks `features/lifestyle/api.ts` | Existing milestones and appreciation list, filters, send/remove/report/preferences. Add activity discovery/create/detail/invitation flows |
| Home | `HomeScreen.tsx`, `lib/lifestyleHomeSummary.ts`: nearest milestone and received appreciation count; hides empty content, marks capped counts honestly | Add an authorized activities preview. No existing true appreciation unread count; do not label it “new” |
| Navigation | `MainTabs.tsx`: Home, Leave, Attendance, Tickets, More with entitlement gates. `MoreStack.tsx` embeds `LifestyleStack.tsx` (React Navigation native stack) | `mobile/AGENTS.md` requires Expo Router, but package and implementation are React Navigation. Explicit prerequisite decision needed; no silent migration or assumption that Expo Router exists |
| Authentication | `User.php` uses Sanctum and team roles; `AuthController.php` session payload; mobile `secureToken.ts`, `apiClient.ts`, `AuthContext.tsx`; web equivalents | Reuse bearer sessions. Mobile SecureStore and web localStorage are current mechanisms, not new recommendations. Plain-text rendering and XSS prevention matter especially on web |
| Session isolation | Mobile `lib/queryClient.ts` clears queries on token transitions; API client rejects responses for old tokens; web auth/session infrastructure | New caches and image loaders must preserve this and include tenant/session identity; do not persist private Life content offline |
| Tenant/employee checks | `routes/api.php`: auth + `SetPermissionsTeamId`, `EnsureOrganizationIsActive`, `EnsureEmployeeVisibility`. Lifestyle service explicitly resolves active employee in actor organization | Middleware is not a universal tenant row filter. New Life models are not covered by `EnsureEmployeeVisibility`'s HR-record list; explicit Life policies are required |
| Permissions | `SetPermissionsTeamId.php` scopes Spatie to organization; `2026_08_17_020000_add_teams_support_to_permission_tables.php` | Preserve team scoping; jobs must set and reset context themselves. New `life.moderate` and `life.configure` permissions proposed |
| Entitlements | Lifestyle route group uses `employee_self_service`; `EnsureModuleIsSubscribed.php` bypasses checks for platform admins | Do not interpret bypass as permission to browse private Life content. Require active same-tenant employee for employee APIs |
| Official company events | `CompanyEventService.php`, `CompanyEventController.php`, `CompanyEvent.php`, `2026_09_07_020000_create_company_events_table.php` | Date-only start/end, org/department visibility, manager/admin creation, publication notifications. No timed social venue/cost/capacity/invite/RSVP. Keep intact; optionally aggregate separately in calendar later |
| Naming collision | `/employees/{employee}/profile-activities`, `/me/activities` concern profile history; role activities are audit history | Use `/lifestyle/activities`, never reinterpret existing activity log routes |
| Notifications | `NotificationController.php` lists and marks current user's notifications; `ValtireoNotification.php` supports DB and optional global mail. `NotificationDispatchService.php` delivers best-effort, catches failure | No durable Activities event outbox or exact-once inbox delivery. Lifestyle appreciation deliberately inserts DB-only generic notifications; do not accidentally enable mail through the general dispatcher |
| Notification tenant gap | Inbox list/count/read APIs are scoped to notifiable user, without an explicit `data.organization_id` filter | Existing alerts can survive a user changing organization. New alerts must be generic; propose scoped filtering/count/read compatibility work before Life pilot, with legacy tests |
| Deep links | `mobile/src/lib/notificationNavigation.ts` explicitly maps appreciation to More > Lifestyle; contract tests exist | Activity UUID destinations need new allowlisted mapping, access recheck and unavailable fallback; never navigate arbitrary server URLs |
| Media | `EmployeeController::photo` uses private local storage, self or `employees.view` checks, and HR visibility middleware; `EmployeeDocumentController.php` has protected streams. Web `useAuthenticatedImage.ts` handles authenticated images | Existing passport photos are not general social avatars. New private activity media storage/processing/policy is needed; do not weaken HR image authorization |
| Background processing | `server/config/queue.php` defaults to database, `after_commit=false`; `bootstrap/app.php` declares reminders/operational schedules. `ReminderNotificationService.php` exists | No evidence workers/scheduler are running in deployment. Explicit after-commit handling, durable retry/deduplication and health monitoring required |
| Connect | Committed Connect meeting backend/web exists; local uncommitted follow-up work excluded from branch | RTC is a separate capability, not a dependency for physical Activities or community membership |

## Existing validation assets

`server/tests/Feature/Employees/EmployeeLifestyleTest.php` covers default consent, generic opt-in alerts, milestone dates, leap/year boundaries, private/shared access, consent withdrawal, cross-organization sends, reported-only moderator access, subscription gates, invalid inputs and send throttling.

`mobile/tests/contracts.cjs` includes Home Lifestyle summary semantics, feature gating, notification navigation allowlisting, profile media origins and session-related contracts. These are useful regression coverage, not a substitute for new device tests or concurrent database tests.

## Integration conclusions

1. Extend the Lifestyle namespace and design language; avoid rewriting working appreciation or milestones.
2. Reuse authentication and UI state patterns, but write audience authorization specifically for social content. HR hierarchy is not the social visibility graph.
3. Keep Activity RSVP separate from attendance records, payroll and official event management.
4. Plan safe media, reports and reminders as MVP dependencies, not cosmetic follow-ups.
5. Treat deployment configuration, devices and notification infrastructure as unverified until implementation acceptance; this discovery did not access production or run migrations.
