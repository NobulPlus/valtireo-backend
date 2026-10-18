# Connect: first web implementation

Connect uses Laravel for meeting ownership, membership and authorization, and LiveKit for media transport. The React meeting controls load only when a user joins. The API is reusable by a future native client.

## Included

- Immediate or scheduled private meetings, with a title, agenda and up to 24 invited colleagues plus the host.
- Searchable, paginated colleague selection and meeting history.
- Database inbox invitations linking to the meeting; no invitation emails or ringing.
- Membership and organization isolation on every meeting operation. Only active employees can use Connect. Connect has its own subscription module.
- Host starts, cancels and ends meetings; invitees wait for the host. Joining is allowed from 15 minutes before the start until the scheduled end.
- LiveKit web controls for audio/video, screen sharing, device selection and temporary in-meeting chat. Camera and microphone are off on entry.
- Server-generated, room-scoped JWTs with a 60-second initial connection lifetime. No media administrator grant or API secret reaches the client. Token responses are not cacheable.
- An ended meeting stays ended if media deletion fails; the host can retry closing the live room.
- A scheduled reconciliation command closes expired meetings, retries failed room cleanup, closes calls when the host or company loses access, and removes connected participants who are no longer eligible.

## Local setup

From `server`, using PHP 8.3+:

```sh
php artisan migrate
php artisan connect:enable-demo
```

The second command only enables the existing synthetic `LASHMA-DEMO` workspace and refuses non-local/non-testing environments. It does not seed employees or change other organizations. For a real organization, register the module using the existing module catalog workflow and explicitly enable its subscription in the platform console.

Set these values in the backend's private environment, then refresh Laravel configuration:

```dotenv
LIVEKIT_URL=wss://your-media-server.example
LIVEKIT_API_KEY=your-server-api-key
LIVEKIT_API_SECRET=your-server-api-secret
```

Never put these credentials in frontend environment variables or commit them. `LIVEKIT_URL` must be the root WebSocket URL; the backend derives the HTTP RoomService endpoint from it. Use WSS/HTTPS outside local development. No LiveKit account, paid service or production server is provisioned by this implementation.

The web page remains usable for scheduling when media configuration is absent, and explains why joining is unavailable. Configure the media service before testing real calls. Use a supported Node runtime (22.22+); the installed RTC dependency reports that minimum. Build with `npm run build` in `client`.

For the local preview, point `VITE_API_PROXY_TARGET` at the API actually running on the machine (for this validation, `http://127.0.0.1:8000`). A saved port-80 target will cause 502 responses if Herd is not serving the API there. The validation preview uses a process-only override; saved environment files were not changed.

## API

All routes require the existing Sanctum authentication and active organization middleware, Connect subscription, and an active employee account.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/connect/people` | Search colleagues, 20 per page |
| GET | `/api/connect/meetings` | Invited meetings, 15 per page, media readiness |
| POST | `/api/connect/meetings` | Create with title, optional description/start, duration_minutes, member_ids |
| GET | `/api/connect/meetings/{uuid}` | Member-visible meeting detail |
| POST | `/api/connect/meetings/{uuid}/join` | Host start / member join token |
| POST | `/api/connect/meetings/{uuid}/end` | Host cancellation or end and media deletion |

`member_ids` are user IDs from `/connect/people`, not employee IDs. Scheduled timestamps should include an offset or use UTC; the web form converts the browser's local time to UTC. `last_join_requested_at` is a token request timestamp, not verified attendance.

## Boundaries before production rollout

This is an initial web meetings release, not the full Teams-style product. Native calls, background ringing, persistent direct/group messaging, presence, external guests, recordings, transcripts, meeting editing/RSVPs and calendar integration remain separate work.

Joining closes immediately at the scheduled end. `php artisan connect:reconcile` closes expired live rooms, cancels unused expired invitations, retries failed media cleanup and checks ongoing access. It is registered every minute with overlap prevention. Production must run Laravel's scheduler (`schedule:run` every minute or a managed `schedule:work` process). No operating-system scheduler was installed locally. Media outages can delay closure; failed work remains retryable. LiveKit empty-room cleanup is set to five minutes. Polling refreshes meeting lists/details; there is no Laravel real-time signalling service yet.

An already-issued media credential can remain usable independently of Valtireo until it expires or is revoked by LiveKit. Token expiry limits initial connection and does not terminate an existing session. Reconciliation detects and removes ineligible participants on the next successful sweep, not instantly. Strict no-rejoin semantics still require provider-specific revocation/webhooks before a high-assurance rollout; self-hosted removal does not revoke every previously issued token. LiveKit Cloud and self-hosted deployments differ here. Do not claim instant revocation or zero replay exposure.

## Validation

16 October 2026: Connect integration tests passed (7 tests, 52 assertions); production web build passed; web lint reported no errors and 15 existing warnings outside Connect. The dependency update resolved the reported source-map advisory; npm reported zero vulnerabilities. The Connect migration and local demo enablement command were applied to LASHMA-DEMO.

17 October browser check: signed in as the synthetic LASHMA employee, opened Connect, selected a colleague, created an immediate meeting, verified the detail/membership and unavailable-media state, and cancelled it through the confirmation flow. The cancelled synthetic meeting remains in history. Reviewed the desktop list visually. Scheduled timing is covered by backend tests; the browser automation could not populate the native datetime field, and that scheduled browser path is not claimed as passed. Invalid-date feedback was made explicit. No real two-party media session was run.

17 October final backend pass: 12 tests and 88 assertions passed, including expiration, suspended host/module, ineligible participants, cleanup retry and 105-meeting batch processing. The local reconciliation command also exited successfully. Web TypeScript and Connect-specific lint passed after the date-validation change. The scheduler registration is code only; a production scheduler and real media acceptance are still required.

Run `php artisan test --filter=ConnectMeetingTest` and the web build/lint. Integration tests use fake media responses and cover room-scoped signing, host-only controls, tenant/member isolation, opt-in module access, invalid invitees, scheduling windows, missing configuration and retry after media failure.

Real media acceptance must use two independent authenticated browsers: join as host and invitee; verify audio, video, screen sharing, chat, microphone/camera denial, disconnect/reconnect, leave, host-end, stale token replay, and behavior on company suspension. Repeat on different networks through TURN. These checks cannot be replaced by the fake-provider tests.

Reference: [LiveKit token grants](https://docs.livekit.io/frontends/reference/tokens-grants/), [RoomService API](https://docs.livekit.io/reference/other/roomservice-api/), [React meeting components](https://docs.livekit.io/reference/components/react/component/videoconference/).
