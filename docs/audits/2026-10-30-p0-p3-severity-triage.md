# Severity triage — 2026-10-30

A follow-up pass on top of [2026-10-30-product-readiness-review.md](./2026-10-30-product-readiness-review.md), after that review's P0/P1 items (login performance, Connect push bypass, call disconnect recovery) were fixed and mobile manager approvals was built. Three parallel audits (backend, web client, mobile app) triaged the rest of the product against:

- **P0 — Release blocker**: unauthorized access, tenant leakage, data loss, incorrect payroll results, or approval bypass.
- **P1 — Essential workflow**: broken login, uploads, notifications, existing call behavior, or transactions employees cannot complete.
- **P2 — Usability and reliability**: confusing navigation, inconsistent states, poor recovery, performance and accessibility problems.
- **P3 — Polish**: minor visual inconsistencies, wording, non-blocking improvements.

**Headline: no P0 findings.** All three audits independently checked tenant scoping, file-download authorization, and payroll/approval correctness and found the existing discipline solid — no new unauthorized cross-tenant access, no payroll calculation defect, no approval bypass.

Two P1s were found and are **fixed as of this pass** (marked ✅ below). Everything else is open and ordered by severity for prioritization.

## P1 — Essential workflow

1. ✅ **Fixed** — Appreciation notifications bypassed the push channel via a raw DB insert, same bug class as the already-fixed Connect issue — `server/app/Http/Controllers/Api/EmployeeLifestyleController.php`. Recipients got an in-app row but never a push notification for appreciation received. Now routed through `$recipient->user->notify(new ValtireoNotification(...))`, matching Connect's fix. `EmployeeLifestyleTest` (10 tests) still passes unchanged.
2. ✅ **Fixed** — Raw axios error strings ("timeout of 30000ms exceeded", "Network Error") surfaced verbatim to users on every mutation across the mobile app on a bad connection — `mobile/src/lib/apiClient.ts`. Now gives a human message for the no-response case specifically (timeout vs. unreachable), while a real server error response still shows the server's own message as before.

## P2 — Usability and reliability

3. ✅ **Fixed** — **Mobile Approvals dead-end state.** When a reviewer has no available action (not the current-step approver) the screen now shows an explanatory message instead of a permanently-disabled button; after recording a decision the screen now returns to the list instead of re-rendering into the same "nothing to do" state with no confirmation it worked. The self-approval-restriction note was also unconditional regardless of which action was selected — now only shown when it's actually relevant (approve excluded, other actions still available), phrased as a scoped note rather than a blocking error. `mobile/src/screens/ApprovalDetailScreen.tsx`.
4. ✅ **Fixed** — **Payroll controller/service inconsistency.** `calculate`/`readiness`/`submit`/`finalize` now also check `organization_id` at the controller level, matching `show`/`void`/`publish` — defense in depth alongside `PayrollService`'s own `ensureTenant()`. `server/app/Http/Controllers/Api/PayrollRunController.php`. Payroll test suite (26 tests) still passes.
5. ✅ **Fixed** — **Payroll finalize race.** `PayrollService::finalize` now locks the run row inside a transaction and re-checks status after acquiring the lock, matching `calculate`/`submit`'s existing pattern — two concurrent finalize calls can no longer both pass the status check. `server/app/Services/PayrollService.php`.
6. **Payroll void gap — flagged, not changed.** `PayrollRunController::void` only blocks voiding when a payment batch is `'paid'`; a `'generated'` batch (file produced, but the system has no distinct "sent to bank" state) doesn't block it. `PayrollOutputService::invalidate()` does correctly void/delete that batch's file as part of voiding — so this is a real product gap (no status exists to represent "already handed to the bank") rather than a code defect with an obvious fix. Needs a product decision on whether to add that status, not a quick patch.
7. ✅ **Fixed** — **Mobile upload has no client-side size guard.** Added a size check (matching each backend FormRequest's own `max:` rule exactly) before upload across every mobile picker: documents (10MB), ticket attachments/comments (5MB), leave evidence (5MB), leave handover document (10MB), Connect attachments (10MB) — oversized files are now rejected immediately with a clear message instead of wasting an upload attempt. `mobile/src/lib/uploadFile.ts` (new shared helper) + 6 screens.
8. ✅ **Fixed** — **Mobile file viewer/download had no timeout or cancel.** `downloadAndShare` (shared by payslips, leave evidence, ticket attachments, and the approvals document viewer) now aborts after 60s via `AbortSignal` with a readable error, instead of hanging indefinitely on a stalled connection. `mobile/src/features/leave/api.ts`.
9. **Mobile UI-pattern inconsistency — not changed.** The new Approvals screens use the legacy `Alert.alert` feedback pattern rather than Design System v2's inline style used by Home/Login/MoreMenu. Cosmetic only; left as-is since reconciling it means picking a direction for the rest of the still-legacy screens too, not a one-screen fix.
10. ✅ **Fixed** — **Employee status change had no confirmation step.** Moving an employee to `suspended` or `exited` now arms a danger-styled confirm step (second click required) with an inline warning, matching the pattern every other destructive action in the app already uses. `client/src/features/employees/ChangeStatusModal.tsx`.
11. ✅ **Fixed** — **Shared web Modal had no accessibility baseline.** Added `role="dialog"`/`aria-modal`, an `aria-labelledby` tied to the title, Escape-to-close, Tab focus trapping inside the dialog, focus-on-open, focus-restore-on-close, and an `aria-label` on the close button — all 28 call sites across the app inherit this for free. `client/src/components/ui/Modal.tsx`.
12. ✅ **Fixed** — **Inconsistent icon-button labeling on web.** `InlineRowAction`'s "Edit" button now has `aria-label="Edit"`, matching its Delete/Deactivate sibling — fixes every generic setup-data table (departments, units, designations, grade levels, ...). `client/src/features/settings/SetupDataPages.tsx`.
13. **Employee board view caps at 250 — re-verified, already substantially mitigated.** The board already shows "Showing the first N matching employees on the board. Use table view for precise pagination." when the cap is hit, so the "no indication more exist" part of this finding doesn't hold. The underlying cap itself is real but changing it means redesigning how a drag-and-drop Kanban paginates per column server-side — left as a known tradeoff, not patched here.

## P3 — Polish

14. Document types / ticket categories list endpoints let any employee enumerate the org-wide list (filtered for non-privileged users). Likely intentional self-service exposure, flagged for a product-intent confirmation rather than a defect — not changed.
15. ✅ **Fixed** — No client-side pre-flight file size check before uploading leave evidence/handover docs or ticket attachments on web — added the same inline check Connect already had, reusing a new shared `client/src/lib/fileSize.ts` helper. `client/src/features/leave/MyLeavePage.tsx`, `MyTicketsPage.tsx`.
16. ✅ **Fixed** — Web toast notifications now use `role="alert"`/`aria-live="assertive"` for danger-tone toasts (error announcements), `role="status"`/`aria-live="polite"` for the rest. `client/src/components/ui/Toast.tsx`.

## Outcome

Of 16 open findings (2 P1 already fixed when first reported): **10 more fixed this pass** (#3, #4, #5, #7, #8, #10, #11, #12, #15, #16), **2 re-verified and found to be lower severity or already mitigated than first reported** (#9 noted as cosmetic-only, #13's "no indication" claim doesn't hold), and **2 explicitly left as product decisions rather than patched** (#6's missing payment-batch status, #14's intentional-looking self-service exposure). `npx tsc --noEmit` and lint are clean on every file touched in both the web client and mobile app; the backend payroll (26 tests) and appreciation (10 tests) suites pass.

## Verified solid (checked, no finding)

- Mobile auth token storage (`expo-secure-store`), logout/session-expiry cache clearing (no cross-account leakage risk on shared devices).
- Approvals backend authorization and visibility scoping (`ApprovalDecisionAuthorizationService`, `ApprovalVisibility`) — correctly tenant-scoped, always populates `allowed_actions`/`action_restrictions`.
- Approvals push/deep-link routing end to end (notification → `navigationRef` → `ApprovalsTab` → `ApprovalDetail`).
- File download/attachment authorization across documents, leave evidence, ticket attachments, assets, payslips, company events — each checks organization + ownership/permission before streaming.
- Payroll calculation correctness (rounding, proration) — no defect found.
