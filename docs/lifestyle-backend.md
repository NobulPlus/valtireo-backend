# Employee lifestyle backend — phase 1

This release adds optional milestones and colleague appreciation to employee self-service. It does not introduce a social feed, chat/Connect, job portal, event RSVP, rewards, rankings or performance metrics. Existing company events remain unchanged.

## Enablement

All routes require bearer authentication, an active organization and an active `employee_self_service` module subscription. Employee endpoints require an active employee linked to the signed-in user in that organization. Moderation uses the existing organization permission `workspace_settings.update`.

Both features default to disabled. An organization administrator enables them through `PATCH /api/workspace/settings`:

```json
{"lifestyle":{"milestones_enabled":true,"appreciation_enabled":true}}
```

These settings are also exposed through the existing workspace settings payload. Enabling a feature does **not** opt employees in.

## Preferences and consent

`GET /api/lifestyle/preferences` returns `preferences` and the two organization `features` flags. `PATCH` on the same path accepts any subset of:

```json
{"share_birthday":false,"share_anniversary":false,"receive_appreciation":false,"allow_shared_appreciation":false}
```

Every preference defaults to false. The authenticated employee can only change their own preferences. Changes remain available when the organization feature flags are off, provided the self-service subscription remains active.

Turning off either appreciation reception or shared visibility permanently changes existing shared appreciations addressed to that employee to private. Re-enabling consent does not republish those messages. Existing private messages remain available to their participants, and either participant can remove a message from all employee feeds.

## Milestones

`GET /api/lifestyle/milestones?days=30` returns `{ "data": [...] }`. `days` must be 1–90 and includes today, using the organization's timezone (Africa/Lagos by default).

Each item contains a minimal `employee` object (`id`, `name`), `type` (`birthday` or `anniversary`) and the upcoming occurrence's `date`. Anniversaries also include `years_of_service`. Birthdays never include the source birth date, birth year or age. Only opted-in, active employees in the same organization appear.

February 29 milestones occur on February 28 in non-leap years. New joiners do not have an anniversary on their initial start date. Results cross year boundaries and are sorted by occurrence date. The window is bounded; this endpoint returns all matching occurrences rather than paginating them.

## Appreciation

| Method and path | Behaviour |
|---|---|
| `GET /api/lifestyle/appreciation-recipients` | Paginated opted-in colleagues; optional `search`, `per_page` (1–100). Returns minimal identity and shared-visibility consent. |
| `GET /api/lifestyle/appreciations` | Paginated visible messages; `scope=all\|received\|sent\|shared`, `per_page` (1–100), standard `page`. |
| `POST /api/lifestyle/appreciations` | Send a thank-you to another opted-in, active employee in the same organization. |
| `DELETE /api/lifestyle/appreciations/{id}` | Sender or recipient removes it from employee feeds; returns 204. Available even when feature flags are disabled. |
| `POST /api/lifestyle/appreciations/{id}/report` | Report a message the employee can see, with a required `reason` (max 500). Repeat reports update that employee's original report. |
| `GET /api/lifestyle/reports` | Moderator-only paginated queue of reported, unhidden messages. |
| `PATCH /api/lifestyle/appreciations/{id}/hide` | Moderator hides a reported message with a required `reason` (max 500); returns 204. |

Send payload:

```json
{"recipient_employee_id":123,"message":"Thank you for helping with the enrolment queue.","visibility":"private"}
```

`visibility` defaults to `private`; `shared` requires recipient consent. Messages are plain text, required, and limited to 1,000 characters. Frontends must render them as text, never raw HTML. Sending and reporting each use a separate rate limit of 10 requests per minute per authenticated user.

Private messages are visible only to sender and recipient. Organization administrators do not gain access to unreported private messages. Reporting deliberately exposes that message to an organization moderator: **explain this before submission in the frontend**. Other employees never receive reporter information. Hidden messages are retained with actor, timestamp and reason for moderation, but excluded from employee feeds. There is no restore/publish action. Messages involving an inactive employee are excluded from employee feeds.

Appreciation uses its received/sent feed as the inbox. Employees can opt into generic in-app alerts with `appreciation_notifications` (default false). These alerts contain no message content and link to `/me/lifestyle`. The backend does not send email, native push notifications or automated birthday messages.

## Errors and frontend contract

- 401: authentication required.
- 403: disabled feature, unavailable subscription or insufficient moderation permission.
- 404: missing/inaccessible record or no active employee account.
- 422: invalid inputs, self-send, unavailable recipient or missing recipient consent.
- 429: rate limit reached.

Show employee consent settings before encouraging use. Keep the home section hidden when both features are disabled or there is no relevant content. Default send visibility to private and offer shared visibility only when the recipient permits it. Do not show birth years, rankings or recognition-based performance scores.

## Installation and validation

Run the additive migration with `php artisan migrate`. Existing accounts are not opted in and existing organization settings are not overwritten. No production data is seeded by this implementation.

Run `php artisan test --filter=EmployeeLifestyleTest`. Tests use the repository's isolated SQLite in-memory configuration and cover consent, local dates, leap birthdays, year boundaries, tenant isolation, private/shared access, withdrawal, moderation, input validation, pagination and subscription controls.

Validated on 13 October 2026: 21 tests and 146 assertions passed across `EmployeeLifestyleTest`, `WorkspaceSettingsTest` and `ModuleEntitlementTest`. On 14 October, web employee and moderation pages and mobile integration were added/validated, including optional in-app alerts. Both additive migrations were applied locally. Features remain disabled and employees opted out until explicitly enabled. Physical-phone acceptance remains pending; see the employee-experience validation report for the exact verification scope.
