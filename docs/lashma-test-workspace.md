# LASHMA test workspace

Created locally on 13 October 2026. Organization code: **LASHMA-DEMO**. Display name: **Lagos State Health Management Agency (Test)**.

All people, contacts, office addresses, reporting structures, salaries and policies are synthetic. They do not represent the agency's actual staff or policies. Email addresses use the reserved `.test` domain. No invitations or emails are sent by this seeder.

## Sign in

Shared local test password: **`LashmaDemo2026!`**

| Account | Purpose |
|---|---|
| admin@lashma.test | Organization administrator |
| employee@lashma.test | Main employee journey, including 60 tickets and 40 notifications |
| hr@lashma.test | HR officer |
| payroll@lashma.test | Payroll administrator |
| ict@lashma.test | ICT administrator |
| csc.head@lashma.test | Client Service department head |

Other department heads use `acc.head`, `fin.head`, `adm.head`, `sal.head`, `ict.head`, `med.head`, `reg.head`, `pre.head`, `aud.head`, `act.head`, and `exe.head`, all at `@lashma.test`. The complete employee roster is in [lashma-test-accounts.md](lashma-test-accounts.md).

Use the existing local web application or mobile app connected to this backend. These credentials are local fixtures, not accounts on a deployed service.

## Organization and scenarios

- 163 employees: 160 active, one onboarding, one suspended and one exited. The latter two deliberately cannot sign in.
- All 11 requested departments, plus Executive Office; 36 units and reporting managers.
- 12 locations: Alausa headquarters; Ikeja, Yaba, Surulere, Lagos Island, Lekki, Ikorodu, Epe, Badagry and Alimosho branches; Abuja and Abeokuta liaison offices.
- Five operational test clusters, with managers, supervisors and linked locations.
- Nigerian names and locations; Africa/Lagos timezone; NGN salaries; permanent, contract, NYSC and internship employment types.
- Six leave types, entitlements, approved/pending/rejected requests and handover notes.
- Recent attendance with present, late and absent days, plus pending correction requests. Day and overnight shift definitions are available; seeded attendance uses the day shift.
- Downloadable synthetic documents: approved, submitted, expired, expiring, missing, awaiting acknowledgement and awaiting signed-copy scenarios.
- Support requests in multiple statuses with comments, assigned laptops/phones, read/unread notifications and upcoming company events.
- Three finalized, published monthly payroll runs. Amounts and deductions are illustrative; they are not Nigerian statutory payroll calculations. Bank details and payment-export readiness are not seeded.

PRE is modelled as Planning, Research and Evaluation for this test fixture. All leave allowances and organizational assignments are test assumptions.

## Suggested test walkthrough

1. Sign in as `employee@lashma.test`; inspect dashboard, profile, directory and reporting line.
2. Inspect leave balances and histories, submit a new leave request, then use the appropriate department-head/admin account to review it.
3. Inspect attendance, submit a correction and review its approval flow.
4. Download documents, acknowledge a policy and upload a signed agreement. Use the roster to compare employees with missing or expired identification.
5. Browse beyond the first page of tickets and notifications, read comments and submit a fresh support request.
6. Inspect assigned assets and exercise a new incident report.
7. View all three sample payslips and the event calendar.
8. Compare employee, department-head, HR, ICT, payroll and organization-admin access; verify suspended/exited access is blocked.

## Reuse

From `server`, run:

```sh
php artisan db:seed --class=LashmaDemoSeeder --no-interaction
```

The seeder only runs in `local` or `testing`. It creates an isolated organization, refuses conflicting existing accounts and skips an already completed fixture, preserving test changes. It does not reset existing organizations. Dates are anchored to the original seed date; rerunning does not refresh them.

Implementation: `server/database/seeders/LashmaDemoSeeder.php`. Verification script: `outputs/verify-lashma.php`; its JSON report is `outputs/lashma-verification.json`. The verifier signs in through the application HTTP kernel and removes only its own temporary access tokens. It does not test Expo Go connectivity or visually inspect the app.
