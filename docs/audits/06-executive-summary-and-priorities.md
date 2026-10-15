# Executive Summary and Priorities

Date: 2026-10-15
Audience: non-technical stakeholders. This synthesizes five detailed audit reports (`01`–`05` in this folder); every claim below cites back to them rather than re-deriving evidence. Read-only synthesis — no code was changed to produce this document.

Valtireo is being audited here as what it's actually built to be: a multi-tenant **Organizational Operating System** — HR, service desk, assets, payroll, and approvals today, with recruitment/performance/learning/financial-admin/AI-assistant seeded as future modules on the same platform — not a narrow HR/attendance point product. That framing matters for how to read "what's missing": several gaps below are modules that don't exist *yet* on a sound platform, not defects in a finished product.

---

## 1. What is already working well

This audit found a genuinely solid, non-trivial product. Specifically:

- **The core architecture is sound and consistently applied.** Multi-tenancy (organization scoping), the Spatie-permission "team" model, module entitlement gating, and a layered visibility/authorization system are implemented once and reused everywhere, not reinvented per feature. Every sensitive file-download endpoint checked enforces both organization match and ownership/role before streaming data, and cross-tenant guesses correctly return 404 rather than 403, avoiding existence leaks (`01` §1.2, §6; `04` §3–§5).
- **Ten critical user journeys were traced end-to-end and hold together**, including login (web and mobile), leave request → approval → entitlement deduction (all inside one transaction), payslip self-service (double-gated so a draft payroll run can never leak), appreciation/lifestyle (a genuinely rigorous consent model, more careful than its own documentation suggests), and session invalidation on org suspension (byte-for-byte identical defensive pattern on web and mobile) (`01` §6).
- **Mobile is in excellent shape.** Every one of its 29 screens traces to a real API call — no mocks, no placeholders. All automated checks are clean: 14/14 contract tests, clean `tsc`, clean lint, successful production export (`02`, verification run). Every P1/P2 finding from an external review three days prior has already been fixed, each backed by a real regression test — not just claimed-fixed (`02` §"Status of the 13 October review's findings").
- **The backend test suite is comprehensively green**: 431/431 tests passing, 3,030 assertions (`04` §7).
- **Security fundamentals check out.** Authentication (no user-enumeration, hashed reset codes, transaction-locked reset flows, full token revocation on password reset), rate limiting (well-tiered across five endpoints), and organization isolation were all spot-checked across seven controllers with no gaps found (`04` §3–§4).
- **Client's component model is a genuine strength worth naming explicitly**: a shared `Button`/`Card` library with real adoption (41 and 33 files respectively), plus a working, WCAG-aware per-tenant branding pipeline that actually changes colors/logo live per organization (`03` §4, §7).

**Bottom line: the hard, risky, foundational engineering — tenancy, auth, the approval engine, mobile's core employee experience — is done well.** What remains is largely a small, known punch list (§2) plus visual-identity/consistency work (§4), not structural rework.

---

## 2. What must be fixed before customer launch

This list is genuinely short — the audits did not surface a long tail of launch blockers, and it would be misleading to pad it:

1. **Passport photos are served from a public, unauthenticated disk** (`server/config/filesystems.php`, `EmployeeController.php:496-499`), unlike every other document type, which is organization/ownership-scoped. Protection today is only an unguessable filename — no session, role, or org check. This is PII with no revocation path once a URL leaks. **Moderate severity — fix before launch** (`04` §1.1).
2. **Confirm `APP_DEBUG=false` in the production environment.** Nothing in code forces this independently; if left on, API errors would leak stack traces and DB query bindings. This is a one-line config check, not a code fix, but it must be verified, not assumed (`04` §1.3).
3. **The `documents` module's `required_permission` is stale** — stricter than what the endpoints actually allow. This is confirmed to be a nav-visibility cosmetic bug, not an access-control bypass (the real gate doesn't check this field), but it's the same bug class already fixed for attendance/assets/payroll and was simply missed for documents. Low severity, cheap fix (`04` §1.2).
4. **Mobile has no top-level error boundary** (web has one). An unhandled render error on mobile today has no recovery screen — it just crashes. Not a security issue, but a reliability gap worth closing before broader rollout, especially since visual redesign work (§4) is about to touch render paths across many screens (`02` "New observations"; `05` §4).

That's the list. No critical security vulnerabilities, no data-isolation failures, no broken core flows were found. Everything else flagged across the five reports (unused hooks, missing navigation on notification tap, no date picker, etc.) is UX polish, not a launch blocker.

---

## 3. What can safely be reused

- **The entire server architecture**: multi-tenant scoping, the four-middleware auth/visibility stack, the generic polymorphic approval engine (powers leave, attendance corrections, and more from one codebase), and the module entitlement system that both client and mobile already consume identically (`01` §1–§2; `05` §1 "Why this doesn't touch the architecture that's working").
- **Nearly all of mobile's existing screens and business logic.** The functional wiring (API calls, data contracts, validation) is sound end-to-end on all 29 screens; what will change in a redesign is presentation, not logic (`02`; `05` §2–§3).
- **Client's component-adoption pattern** (`components/ui/*`, high real-world usage) as the explicit model mobile should converge toward during its own consolidation work (`03` §10; `05` §3, Phase 3).
- **Client's per-tenant branding pipeline** (`WorkspaceThemeBridge`) as a working template to extend to mobile, which currently receives but discards the same branding data (`03` §7).
- **Mobile's module-accent-color concept** (distinct icon-chip colors per feature area) as a UX idea worth promoting to a shared, cross-platform pattern — it's mobile-only today but demonstrably aids navigation legibility (`03` §6, §10).

---

## 4. What requires redesign

This is where the real work sits — not in fixing broken things, but in unifying a visual identity that was built three times independently:

- **No shared design tokens exist across the three surfaces.** Client, mobile, and website each invented their own numbers for the same concepts: three different "page background" hex values, mismatched danger/warning/success colors, zero shared typography (client uses Inter+Manrope, website uses Manrope alone, mobile uses the bare OS system font), two independently-built dark-mode engines, and a per-tenant branding pipeline that's fully wired on client and dead code on mobile despite the data already being typed and received there (`03` §1–§9).
- **Mobile's component adoption is too low for a palette swap alone to work.** Only 4 of 29 screens use mobile's shared primitives; the other 25 each hand-roll their own styles. A token-value change alone would visibly update only Login/Home (already mid-redesign) and leave the rest of the app looking stuck in the old identity — a worse, half-migrated look than today's consistent-but-unbranded state (`03` §4, §8; `05` §2).
- **Client's own tokens are under-used in practice**: 294 un-tokenized radius/shadow occurrences across 65 files bypass the two tokens that do exist — a smaller version of the same "tokens on paper, not in practice" problem (`03` §3, §8).
- **Website has no token layer at all** — a single 526-line hand-written stylesheet with six root variables and no dark mode. It's new and thin enough that this is the cheapest moment to fix it, not the hardest (`03` §0, §5).
- A single JSON token source is assessed as fully feasible to drive Tailwind (client/website) and a generated TypeScript module (mobile) simultaneously — color roles, module-accent map, type scale, spacing, and radius/shadow can all be shared this way, while font-loading mechanics, dark-mode storage, and component implementations correctly stay platform-specific (`05` §1).

---

## 5. What remains unverified

Being specific about the difference between "confirmed working," "confirmed broken," and genuinely "not yet checked":

- **Mobile's safe-area-inset risk is a real but unconfirmed risk, not a confirmed bug.** No screen calls `useSafeAreaInsets()`; Login and Home use fixed pixel padding instead. This could misplace content on notch/dynamic-island devices, but it was not verified on an actual device or simulator (`02` "New observations").
- **Most of client's ~40 admin-console pages were inventoried by directory listing, not individually traced.** Only `LoginPage`, `MyLeavePage`, and the API client were read in full; the rest of the architecture is confirmed sound, but page-level correctness on client web is largely untested in this pass (`01` §8).
- **The backend test suite's ~2-hour run time (vs. a usual ~10-15 minute baseline) is flagged but not explained.** All 431 tests passed; the slowdown may be environment noise (background disk/AV activity) from this specific run rather than a real regression, but it wasn't isolated or re-run to confirm either way (`04` §7).
- **Several internal service bodies were not read line-by-line**, including `AttendanceService`, `TicketService`, `PayrollService`, the payroll run calculate→finalize→publish pipeline, and document-compliance controller internals. Nothing found suggests these are broken — they're simply unverified beyond the controller-call level (`01` §8).
- **The platform modules with no backend implementation** (recruitment, performance, learning, financial_admin, ai_assistant) were confirmed absent at the level of "no matching controller exists" via seeder/route inspection — this wasn't re-confirmed by, e.g., attempting to hit those endpoints live, though the absence is unambiguous from the code census (`01` §1.2).
- **Two backend tests are latently date-flaky** (`NotificationModuleTest`, `ReminderNotificationCommandTest`, both hardcoded around `now()->addDays(10/11)`) — they passed this run only because today's date happened not to land the offset on a weekend; they will fail again on some future date unless replaced with a deterministic fixture (`04` §7).

---

## 6. Recommended order of implementation

Synthesizing the must-fix list (§2) with the phased redesign plan (`05` §3), with launch-blockers and crash-resilience pulled forward rather than deferred:

1. **Pre-work (do first, before any visual changes land):**
   - Move passport photos off the public disk to an authenticated, org-scoped endpoint.
   - Verify `APP_DEBUG=false` in production.
   - Fix the `documents` module's stale `required_permission`.
   - Add a mobile top-level error boundary (small, self-contained — wraps `RootNavigator`, mirrors the pattern web already has). This specifically protects the app during the render-path churn that phases 2–4 below will introduce.
2. **Phase 1 — Mobile infrastructure + the screens already mid-redesign (Login, Home):** Stand up the shared token JSON and mobile's generated TypeScript module, seeded from whatever the in-flight Login/Home design mockup settles on. In the same pass — because it's the same lines of code either way — fix mobile's safe-area-inset handling and wire real font loading (`expo-font`) on those two screens, and wire the currently-dead per-tenant branding fields (`logo_url`, `theme`) for at least Login/Home.
3. **Phase 2 — Mobile: consolidate, then roll out the palette.** Move the remaining 25 screens off their individual `StyleSheet.create` blocks onto shared Card/ListRow/Section primitives *while still showing the old palette*, so consolidation and rebrand don't land in the same commit. Then apply new token values app-wide in one single-point change. Decide explicitly whether mobile's per-module accent-color system survives the new "one bold accent" direction or is retired, and apply that decision uniformly.
4. **Phase 3 — Web (`client/`):** Generate the Tailwind token layer from the same source JSON that now drives mobile, closing the color-mismatch gaps. Clean up the 294 un-tokenized radius/shadow occurrences before or during the value swap, not after. Port mobile's module-accent decision to client's nav. Extend the existing, working branding pipeline only as needed to match the new default brand treatment. If this phase touches the Profile screen, fold in the passport-photo frontend URL change as a one-touch bundle.
5. **Phase 4 — Website (`website/`):** Add a real CSS-variable token layer first (none exists today), then apply new values, then add a first dark-mode pass, then reconcile the module list currently duplicated between `website/src/data/site.ts` and client's `navConfig.ts`. Correctly sequenced last — lowest risk, lowest traffic, and the only surface starting from a genuinely clean slate.
6. **On their own schedule, unrelated to the above:** replace the two date-flaky backend tests with a deterministic fixture, and re-run the backend suite once in a quiet environment to confirm the ~2-hour run time was a one-off.

---

*Full detail, file/line citations, and the underlying methodology for every claim above live in reports `01` through `05` in this folder.*
