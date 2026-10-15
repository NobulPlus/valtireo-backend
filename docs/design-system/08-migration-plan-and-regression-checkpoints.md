# 08 — Incremental migration plan and regression-testing checkpoints

This phasing is audit `05` §3's plan, carried forward with this spec's actual token values and
this repo's actual verification tooling (the same discipline used for the pre-launch-readiness
branch: `tsc --noEmit`, `expo lint`, mobile contract tests, `expo export` bundle smoke tests,
backend `php artisan test` + `vendor/bin/pint --test`, client `tsc --noEmit` + `npm run lint` +
`npm run build`). **No step in this plan is authorized to begin by this document alone** — per
the brief, this is presented for review and approval before any of it starts.

## Phase 0 — pre-work (no visual change)

1. Stand up `design-tokens/tokens.json` and the three generators
   ([07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) §2-3),
   seeded with **current** values first (today's pine/lime palette, byte-for-byte) — so this
   phase's only diff is "nothing visibly changed," proving the pipeline before it carries new
   values.
   - **Checkpoint:** `mobile/src/theme.generated.ts` and `client/src/tokens.generated.css`
     produce output identical in effect to today's hand-written `theme.tsx`/`index.css` blocks.
     Run mobile's existing `node --test tests/*.cjs` contract tests, `expo lint`, `tsc --noEmit`;
     client's `tsc --noEmit` + lint + `npm run build`. No screenshot should differ from
     pre-change.
2. Wire the CI parity check (generated output vs. a fresh build from `tokens.json`).

## Phase 1 — Mobile: Login and Home only

3. Swap `tokens.json`'s values to this spec's new palette
   ([01](01-color-tokens.md)/[02](02-typography-spacing-elevation-iconography.md)). This phase
   touches only the two screens already structurally ready for it
   ([04-screen-specifications-login-home.md](04-screen-specifications-login-home.md)) — every
   other screen keeps importing the same token names, which now resolve to new values, but since
   25 of 29 screens don't import `IconTile`/hero-related tokens at all (audit `05` §2 item 1),
   most of the app is visually unaffected until Phase 2 regardless.
4. Fix the two platform gaps that interact directly with these two screens' rebuild
   ([06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md)
   §3): safe-area insets on both hero headers, and `expo-font` loading for Inter/Manrope.
5. Wire mobile's dead `logo_url`/`theme` branding fields for Login/Home
   ([05-organization-branding-compatibility.md](05-organization-branding-compatibility.md) §2).
6. Build the new `Button`, `Input`, and hero-backdrop recoloring described in
   [03](03-component-specifications.md)/[04](04-screen-specifications-login-home.md), scoped to
   these two screens.
   - **Checkpoint:** manual on-device check of the full Login flow (password sign-in, biometric
     sign-in toggle, forgot-password link, error states) and Home (greeting, quick-access tiles,
     all conditional info cards, pull-to-refresh, theme-preference cycling) in both light and
     dark mode, on at least one device with a Dynamic-Type-enlarged system font setting (§
     [06](06-accessibility-and-responsive-requirements.md) §4). Confirm contrast visually
     matches the ratios computed in [01](01-color-tokens.md) §1 — specifically confirm the
     dark-mode CTA button renders dark text on the `#39CFC0` fill, not white (the one pairing
     easy to get backwards by habit). Re-run mobile's full test/lint/typecheck suite; nothing
     outside these two screens should show a diff.

## Phase 2 — Mobile: consolidate remaining screens, then roll out

7. Before touching any other screen's visuals, move the highest-traffic remaining screens
   (Tickets, Leave, Attendance, Directory, Assets, Documents, Payslips, Profile, Notifications,
   Calendar, Lifestyle — the order audit `05` §3 step 5 gives, "Tickets first" per audit `02`'s
   finding that it's the most fully built-out flow) onto the shared `Card`/`ListRow`/`Button`
   primitives from [03](03-component-specifications.md), **while token values still resolve to
   the Phase-0 (original) palette** — so any visual regression here is attributable to the
   refactor, not a color change, per audit `05` §2's explicit warning against doing both in one
   commit.
   - **Checkpoint:** per screen, confirm no functional regression (every list still loads,
     paginates, and the infinite-scroll behavior from this session's earlier work still
     functions — a straightforward place to break by replacing a list row's structure) before
     moving to the next screen. This is naturally a multi-PR phase, not one large change.
8. Once consolidated, swap `tokens.json` to the new palette app-wide — now a true single-point
   change across all 29 screens, not a straggler problem.
9. Apply the module-accent decision (§5 of [01](01-color-tokens.md): retained, restyled, same
   `{bg icon}` shape, new values) uniformly across every remaining module tile.
   - **Checkpoint:** full regression pass across all 29 screens in both themes; re-run the full
     mobile test suite; spot-check every module's icon-chip color against
     [01](01-color-tokens.md) §5's table for correctness (easy to transpose two modules' hexes
     by mistake with 15 entries).

## Phase 3 — Web (`client/`)

10. Generate `client/src/tokens.generated.css` from the same `tokens.json`
    ([07](07-cross-platform-token-architecture.md) §3), closing the parity gaps audit `03` §9.1/
    §9.2 found (mismatched `danger`/`warning`/`success` hexes, missing `lime`-equivalent token,
    three different page-background values — now one `bg` value, shared).
11. Do the radius/shadow token-adoption cleanup (the 294 un-tokenized `rounded-*`/`shadow-*`
    occurrences across 65 files, audit `03` §3/§8) *before or during* the value swap — same
    reasoning as mobile's consolidation step.
12. Port the module-accent decision to `navConfig.ts`-driven nav and any module-colored surface
    — net-new on client, which has no module-accent concept today (audit `03` §6).
13. Extend `WorkspaceThemeBridge`'s default values to the new brand
    ([05](05-organization-branding-compatibility.md) §3 item 1).
    - **Checkpoint:** `tsc --noEmit`, `npm run lint`, `npm run build`; visual spot-check of the
      ~40 feature pages that import `Button`/`Card` (the 41/33-file adoption audit `03` §4
      found) to confirm the palette swap reached them as expected, given client's higher
      component-adoption rate is exactly why this phase is lower-risk than mobile's.

## Phase 4 — Website (`website/`)

14. Add the CSS-variable token layer first (website has none today beyond 6 `:root` vars —
    audit `03` §0/§3/§8).
15. Apply the new values once the token layer exists.
16. Add a first dark-mode pass and reconcile `website/src/data/site.ts`'s module list against
    whatever single source of truth Phase 3 established for client's `navConfig.ts` (audit `03`
    §9.10).
    - **Checkpoint:** visual pass across website's 5 pages in both themes (new); confirm the
      Astro build still produces correct static output (`astro build`/equivalent check this
      repo already uses, if any — not confirmed to exist yet, worth checking at this phase
      rather than assuming).

## Pre-existing findings folded in, per audit `05` §4

- **Mobile error boundary**: already shipped (commit `4811d41` era work, this session) —
  [03-component-specifications.md](03-component-specifications.md)'s `ErrorBoundary` entry is a
  values-only update, already covered in Phase 1/2 regression passes above, not a separate step.
- **`documents` module `required_permission` staleness** (audit `04` §1.2): already fixed this
  session (`docs/audits/07-pre-launch-fixes-deployment-checklist.md`'s step 1,
  `modules:sync-catalog`) — no action needed here, noted only so Phase 2's module-tile pass
  doesn't rediscover it as if it were new.
- **Passport-photo private-storage fix** (audit `04` §1.1): already shipped and deployed per the
  same checklist — if Phase 2's Profile-screen consolidation (step 7) touches the photo
  `<Image>` source, confirm it's still pointed at the authenticated endpoint
  (`/api/employees/{employee}/photo`), not reintroducing a public-URL reference by accident
  during the refactor.
