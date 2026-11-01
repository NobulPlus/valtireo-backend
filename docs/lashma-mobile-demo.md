# LASHMA mobile testing and demo guide

This is the local synthetic `LASHMA-DEMO` workspace, not real agency data. All accounts below use **`LashmaDemo2026!`**. Append **`@lashma.test`** to each account name.

The enrichment adds 21 employees to the original 163: **184 total**, spanning the existing 12 departments, 36 units and 12 locations, with one additional Lagos demo cluster (six clusters total). Existing accounts, passwords, role permissions, payroll history and Connect records are preserved.

## Choose a persona

| Account | Purpose and expected behaviour |
|---|---|
| `employee` | Original full-history employee: documents, assets, three payslips, 60 tickets and 40 notifications. |
| `manager` | Supervisor role with four direct reports and the Lagos Mobile Demo Cluster. Manager Home available. |
| `team.lagos`, `team.ikeja`, `team.lekki`, `team.ikorodu` | Employees reporting to `manager`, assigned to different Lagos locations. Each has a submitted leave request awaiting approval. |
| `supervisor` | Medical team supervisor with two direct reports. Manager Home available. |
| `medical.day`, `medical.night` | Medical reports with day/overnight attendance histories. Night records span midnight. |
| `manager.empty` | Supervisor role, no reports or cluster leadership. Manager Home must be unavailable. |
| `structural.lead` | Employee role with one reporting employee. Structural assignment alone must not unlock Manager Home. |
| `ict.report` | Reports to `structural.lead`; useful for distinguishing reporting relationships from permission grants. |
| `csc.head`, `med.head` | Existing department heads; compare department scope against supervisor scope. |
| `hr.director` | HR Director; can participate in the existing HR final leave-approval step. No automatic payroll approval grant added. |
| `hr` | Existing HR Officer; test HR access separately from management scope. |
| `compliance` | Compliance Officer for document/compliance access testing. |
| `payroll` | Existing Payroll Administrator: preparation/finalization responsibilities, no default approval authority. |
| `ict` | Existing ICT Admin for support and assets. |
| `admin` | Existing Organization Admin. Self-approval restrictions still apply. |
| `new.starter` | Active employee with draft profile, leave entitlements and empty attendance/leave history. |
| `contract`, `nysc`, `intern` | Employment-type variations; NYSC/intern staff are on probation. |
| `private` | Birthday/anniversary sharing and receiving appreciation disabled. Must not appear in milestone listings. |
| `onboarding` | Onboarding employee with draft profile. Login succeeds; active-employee-only features should remain unavailable. |
| `suspended`, `exited` | Login must be rejected (current API returns 422 without a token). |

The complete roster is [lashma-test-accounts.md](lashma-test-accounts.md).

## Recommended mobile walkthrough

1. Sign in as `employee`: profile, documents, download, tickets and pagination, notifications, assets, leave and payslips.
2. Sign in as `team.lagos`: inspect the submitted leave and lifestyle milestones, then compare shared and private appreciation.
3. Sign in as `manager`: open Manager Home, inspect the four reports and pending leave. Compare against `supervisor`, which must not manage the Lagos team.
4. Follow the configured leave stages: reporting manager, department head, then HR Director. A first-step decision is not necessarily final approval. Use different people; self-approval is prohibited.
5. Compare `manager.empty` and `structural.lead`: neither has Manager Home eligibility, for different reasons.
6. Check `medical.night` across the date boundary and compare late/present days against `medical.day`.
7. Compare `new.starter` empty states with the original `employee` history. Upload a profile photo manually to test persistence across logout/login and app restart.
8. Check lifestyle privacy using `private`; other active personas have opted-in synthetic birthdays/anniversaries around the seed date. Private appreciation is only visible to sender and recipient.
9. Exercise onboarding and blocked login with the dedicated status accounts.

## Seed and verification

From `server`:

```sh
php artisan db:seed --class=LashmaMobileDemoSeeder --no-interaction
php ../outputs/verify-lashma-mobile.php
php ../outputs/verify-lashma.php
```

The additive seeder is restricted to the local MySQL `valtireo` database on loopback and requires the original synthetic fixture marker. It reserves the 21 persona emails and refuses conflicts; creation is transactional. Reruns preserve persona edits rather than resetting data. Dates are anchored once, not refreshed on rerun. No invitations, email or push notifications are dispatched by this seeder.

The seeder also repairs old synthetic leave/attendance sources incorrectly labelled `pending` to `submitted`, only when the linked approval remains pending and has no decisions. It leaves genuine user-created requests and decided history alone.

Lifestyle milestones and appreciation are enabled for this demo organization. Only new synthetic personas receive preference rows; existing employees' preferences are preserved. Two appreciation examples (one shared, one private) and a future welcome event are included.

Verification scripts sign in through the HTTP kernel, inspect API responses and remove their own temporary tokens. JSON results are written to `outputs/lashma-mobile-verification.json` and `outputs/lashma-verification.json`. The latter regenerates the account roster. They do not approve or cancel the demo requests.

Validation completed: **261/261 mobile fixture checks passed**, and the original fixture verifier reported **zero errors** across all 184 employees, document files, payroll totals and existing account API checks. This includes manager eligibility, team visibility, self-approval denial, requester cancellation eligibility and hidden private milestones. Seeder rerun preserved the existing personas without duplicates; targeted PHP formatting passed.

## Deliberate limits and follow-up scenarios

- Existing HR Director role grants predate Phase 2B and lack `payroll.runs.approve`. No existing role was expanded. Use `admin` as a separate payroll approver; enabling HR Director approval requires a deliberate organization permission change.
- New personas have lean histories: entitlements, submitted leave and five attendance records where applicable. Use the original `employee` account for rich payslip/document/ticket/asset scenarios; new starters and the empty-team supervisor deliberately lack request histories.
- Existing default workflow configuration is preserved. This fixture does not create an administrative approval bypass or alter permission scope.
- Local backend verification does not prove Expo Go connectivity, visual layout, photo persistence, push delivery, camera/file permissions, offline recovery, cross-tenant isolation or concurrency. These require separate device/regression tests.
- No synthetic bank details, statutory payroll calculations, new Connect meetings, multi-role administration or future community/feed features are added.
- Existing older fixture dates remain historical. New milestones and events are time-sensitive; rerunning intentionally does not reset them or overwrite demo changes.
