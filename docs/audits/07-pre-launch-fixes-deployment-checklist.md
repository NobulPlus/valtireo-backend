# Pre-launch fixes — deployment checklist

Branch: `fix/pre-launch-readiness`. This document covers deploying the four pre-launch fixes to any environment that already has real data (i.e. anything other than a fresh install) — most importantly the passport-photo security fix and the `documents` module-permission fix, both of which require a one-time manual step that the code change alone does not perform.

## Why manual steps are required at all

- `docker-entrypoint.sh` runs `php artisan migrate --force` on every boot, **never** `--seed`. Seeders (including `PlatformModuleSeeder`) only ever run from an explicit `db:seed` invocation. So a `required_permission` change in the seeder file has **no effect on an already-provisioned database** until someone explicitly re-runs that seeder.
- Passport photos already uploaded under the old code are physical files sitting on the `public` disk. Deploying the new code (which only serves photos from the `local` disk) does nothing to move those files. They need to be copied over separately.
- Neither of these is wired into automatic startup, deliberately — per explicit instruction, nothing related to data migration runs automatically on every container boot.

## Deployment order

Run in this order. Steps 1–2 are safe to run **before or after** code deploy and are idempotent (safe to re-run, safe if interrupted); step 4 must only run **after** step 3 is verified.

1. **Sync the platform module catalog** (closes the `documents` module visibility bug):
   ```
   php artisan modules:sync-catalog
   ```
   This calls only `PlatformModuleSeeder` — it does **not** run `php artisan db:seed` or any other seeder, so it never touches demo/organization data. Safe to run against a real environment at any time; re-running is a no-op once applied.

2. **Copy existing passport photos to private storage** (does not delete anything yet):
   ```
   php artisan employees:migrate-passport-photos-to-private
   ```
   - Copies every photo still on the `public` disk to the `local` (private) disk.
   - Leaves the original public copy in place — so photos remain reachable via the *old* public URL for as long as anything is still requesting it, with zero gap in access.
   - Reports progress and a summary (copied / already-private / missing / failed).
   - **Exits non-zero if any individual file failed to copy** — check the output, fix the underlying cause (commonly: a referenced file was already deleted from disk out-of-band), and re-run. A failed file is never deleted from `public`, so there's no data-loss risk in re-running.

3. **Deploy the application code** (this branch). From this point on:
   - New uploads go straight to private storage.
   - `GET /api/employees/{employee}/photo` serves from private storage for any photo that step 2 already copied.
   - The old public URLs **still work** too (the file is still there) — this is intentional; closing that off is step 4, done deliberately once step 3 is confirmed working.
   - The container boot itself now also runs `php artisan app:verify-production-safety`, which will refuse to start if `APP_DEBUG` is true in a `production` environment.

4. **Verify**, then **close the public exposure**:
   - Verify first (see Verification steps below).
   - Preview what would be removed, with no changes made:
     ```
     php artisan employees:prune-public-passport-photos --dry-run
     ```
   - Then actually remove the public copies:
     ```
     php artisan employees:prune-public-passport-photos
     ```
   - This command **refuses to delete a public copy unless a private copy of the same file already exists** — if step 2 was skipped or failed for a given employee, that employee is reported and skipped rather than risking the only copy of their photo. Exits non-zero if anything was skipped or failed, so a clean exit code is itself a confirmation that every photo now has a private copy and the public ones are gone.

If step 2 is run for the first time *after* step 3 (code already deployed), there is a window between deploy and running step 2 where any employee with an already-uploaded photo gets a 404 on `GET /api/employees/{employee}/photo` (not a security issue — a functional gap only). Running step 2 **before** step 3 avoids this window entirely, which is why it's listed first above.

## Rollback considerations

- **Code rollback** (steps 3 reverted): safe at any point. The old code reads from the `public` disk, which steps 1–2 never remove anything from — rolling back the code after step 2 (copy) or even after step 4 (prune) is fine as long as step 4 hasn't run yet; if step 4 *has* run (public copies deleted) and you then roll back to old code, the old code's public-URL links will 404 since the files are gone from `public`. **If you need to roll back code after running step 4, re-run step 2's inverse manually is not provided** — treat step 4 as the point of no return for the old code path, and don't run it until you're confident you won't need to roll back.
- **`modules:sync-catalog` (step 1) rollback**: re-run the previous version of `PlatformModuleSeeder` (i.e. check out the old seeder file and run the command again) to restore the old `required_permission` value if needed. Non-destructive either direction.
- **Database**: nothing in this branch touches a migration that alters schema — no schema rollback is needed for any of these four fixes.

## Verification steps (after step 3, before step 4)

1. Confirm the module fix: log in as an ordinary employee (not an admin) and confirm `documents` appears in the `modules` array of `/api/auth/me` (or just confirm the employee's "Documents" experience is reachable where it wasn't before).
2. Confirm an employee who already had a photo uploaded before this deploy can still see it (web topbar/profile, and mobile home/profile) — this is the real-world proof that step 2 worked and the new endpoint is serving it correctly.
3. Confirm a *new* photo upload (any employee) lands on private storage and displays correctly immediately.
4. Confirm `php artisan app:verify-production-safety` passes in the actual production environment (it runs automatically on boot now, but you can also run it manually to check ahead of time).

## Confirming old public copies are no longer accessible (after step 4)

1. Run `php artisan employees:prune-public-passport-photos` (not `--dry-run`) and confirm it exits `0` with a "Public access to previously-uploaded passport photos is now closed." message.
2. Pick a photo's pre-migration public path (visible in your deploy logs from step 2, or reconstructable as `organizations/{org_id}/employees/{employee_id}/passport/<filename>`) and request it directly via the old public storage URL pattern (`{APP_URL}/storage/organizations/.../passport/<filename>`) — it should now 404 at the webserver level, not just the application level.
3. Confirm the *new* authenticated endpoint (`/api/employees/{employee}/photo`) still works for that same employee when requested with a valid session — proving the private copy survived the prune.

## What was deliberately left alone

- **Backend test-suite performance** (currently ~2+ hours for a full run) — identified as caused by a heavy default seeder chain combined with ~300+ test methods each paying that cost independently, with no parallelization. Left for a separate task, as directed — not touched here.
- **Mobile error boundary** — kept exactly as implemented. One limitation worth remembering operationally: React error boundaries only catch render/lifecycle errors, not errors in event handlers or async code (promise rejections, timers). A manual on-device test (forcing a render error and confirming the fallback screen appears, and that "Try again" recovers) has not been performed and is recommended before considering this fix fully verified — the mobile test harness doesn't support rendering React components, so this gap can't be closed by an automated test with the current tooling.
