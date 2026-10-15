# 08 — Incremental migration plan and regression-testing checkpoints

**Revision note:** the original draft of this file had a sequencing conflict with
[07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) — it
described swapping the single global token file's values in Phase 1, then described Phase 2
screens as still resolving to "the original palette," which only makes sense if the token file
holds both palettes at once. This revision aligns the plan with 07's corrected dual-palette +
per-screen-flag architecture, and reorders the phases so that **component consolidation happens
under the existing (legacy) visual design, before any new-identity screen work, not
interleaved with it** — and so that **web and website migrations don't start until mobile's
rollout is complete and stable**, both per the explicit correction. **No step in this plan is
authorized to begin by this document alone** — this remains a specification for review, not an
implementation authorization.

## Phase 0 — token infrastructure, zero visual change

1. Stand up `design-tokens/tokens.json` with `palettes.legacy` seeded from today's actual
   values (`theme.tsx`, `index.css`, `global.css`) and `palettes.v2` seeded from
   [01-color-tokens.md](01-color-tokens.md), with `activePalette: "legacy"`
   ([07](07-cross-platform-token-architecture.md) §2).
2. Build the three generators ([07](07-cross-platform-token-architecture.md) §4) and the CI
   parity check (§6).
   - **Checkpoint:** `mobile/src/theme.generated.ts` resolving `palettes.legacy` is
     byte-equivalent in effect to today's hand-written `theme.tsx`; same for client's generated
     CSS vs. today's `index.css`. Run mobile's `node --test tests/*.cjs`, `expo lint`,
     `tsc --noEmit`; client's `tsc --noEmit` + lint + `npm run build`. **No screen anywhere
     should render any differently than before this phase.** This is the one phase whose entire
     success criterion is "nothing visibly changed."

## Phase 1 — mobile component consolidation, under the existing design

3. Build the shared components from [03-component-specifications.md](03-component-specifications.md)
   (`Button`, `Card`, `ListRow`, `Input`, `Pill`, `GeometricAccent`), styled by reading from
   whichever palette is currently active (`legacy`, unchanged at this point) — these components
   must render pixel-equivalent to what they replace, since no new values exist yet.
4. Migrate the highest-traffic screens first — **starting with Tickets** (audit `02`'s finding
   that it's the most fully built-out flow), then Leave, Attendance, Directory, Assets,
   Documents, Payslips, Profile, Notifications, Calendar, Lifestyle, and **including Login and
   Home themselves** — onto these shared primitives, still rendering the `legacy` palette
   throughout. This is the explicit correction from the original draft, which had Login/Home
   restyled into the new identity *before* the other 25 screens were consolidated; now every
   screen reaches structural parity on shared components first, and the only thing that changes
   later is which palette those components read from.
   - **Checkpoint, per screen:** no functional regression — list pagination/infinite scroll,
     form submission, navigation, and every existing interaction continue to work exactly as
     before; a visual diff against the pre-consolidation screenshot should show no change
     (consolidation is a structural refactor, not a restyle). This is naturally a multi-PR
     phase, one or a few screens per PR, not one large change.
5. Fix the two platform gaps that interact with this consolidation pass regardless of palette
   ([06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md)
   §3): safe-area insets wherever a screen's header currently hardcodes top padding, and
   `expo-font` loading for Inter/Manrope (loaded now, even though every screen still renders the
   `legacy` palette's type choices until flagged — having the fonts available doesn't require
   using them yet).

## Phase 2 — mobile: controlled, per-screen rollout of the new identity

**Revision 2 note:** Login's first implementation round skips the formal flag mechanism in §3 of
[07](07-cross-platform-token-architecture.md) — rather than a hidden, flippable override, Login
is rebuilt directly (the requesting instruction asked to see and verify it immediately via
screenshots, which a default-off flag would work against). The *effect* is the same as "Login
flagged to v2, every other screen still on legacy": Login's file reads the new `v2` values
directly, nothing else changes. The override-map mechanism remains the plan for every screen
after Login, where a hidden/reversible flag is actually useful during a longer rollout.

6. Flip screens from `legacy` to `v2` one at a time via `SCREEN_PALETTE_OVERRIDE`
   ([07](07-cross-platform-token-architecture.md) §3) — **Login first** (already implemented
   directly, per the note above), **then Home**, since these are the two screens with an actual
   new-layout spec
   ([04-screen-specifications-login-home.md](04-screen-specifications-login-home.md)), not just
   a palette swap.
   - **Checkpoint (Login/Home):** manual on-device check of the full flow (password sign-in,
     biometric toggle, forgot-password, error states; Home's greeting, quick-access tiles, every
     conditional info card, pull-to-refresh, theme-preference cycling) in both light and dark
     mode, including a Dynamic-Type-enlarged system font setting. Confirm the specific contrast
     pairings flagged in [01](01-color-tokens.md) §1 render correctly — especially the
     dark-mode CTA using dark text on `#39CFC0`, and the "Forgot password?" link using
     `primaryStrong`, not `primary`. Confirm `logo_url`/`theme` branding wiring
     ([05-organization-branding-compatibility.md](05-organization-branding-compatibility.md))
     works for an org with a custom primary color. Re-run the full mobile test/lint/typecheck
     suite — nothing outside these two screens' palette should show a diff, since every other
     screen still reads `legacy` via the still-active global default.
7. Flip the remaining screens one at a time (or in small related groups — e.g. Leave +
   Attendance together, since they share dashboard cards on Home), applying the module-accent
   decision ([01](01-color-tokens.md) §5) as each group flips.
   - **Checkpoint, per group:** same regression bar as step 4's checkpoint, plus a visual
     confirmation that the flipped screen's module-accent colors match
     [01-color-tokens.md](01-color-tokens.md) §5's table (easy to transpose two modules' hexes
     by mistake across 15 entries) and that it visually coheres with any adjacent screen still on
     `legacy` (a brief, expected "half-migrated" state between flips — bounded to one deploy
     cycle per group, not an open-ended inconsistency, since flips proceed in quick succession
     once the mechanism is proven on Login/Home).

## Phase 3 — mobile: full cutover

8. Once every mobile screen has been individually flagged to `v2` and checkpointed, flip the
   global `tokens.json` `activePalette` from `"legacy"` to `"v2"` — the one and only global
   default change in this entire plan — and delete `SCREEN_PALETTE_OVERRIDE`/
   `designSystemRollout.ts` entirely, since every screen now independently resolves to the same
   answer the new default gives for free.
   - **Checkpoint:** full regression pass across all 29 screens in both themes; confirm removing
     the override file changes nothing (it should be provably redundant by this point); re-run
     the full mobile test suite one final time before considering mobile's migration complete.
   - **Mobile is not considered "stable" for the purposes of Phase 4 below until this checkpoint
     passes and the app has run on `v2` in production for a period the team is comfortable with
     — this spec doesn't set that duration, since it depends on real usage/crash-reporting
     signal this document has no visibility into.**

## Phase 4 — web (`client/`), gated on mobile being stable

9. Only after Phase 3's checkpoint is signed off does `client/`'s migration begin, per the
   explicit instruction that web/website migrations follow mobile, not run in parallel with it.
10. Generate `client/src/tokens.generated.css` for both palettes; toggle via
    `data-design-system="v2"` on a staging build first, confirming client's higher existing
    component adoption (41/33-file `Button`/`Card` usage, audit `03` §4) means the toggle reaches
    nearly the whole app in one step, unlike mobile's screen-by-screen necessity.
11. Do the radius/shadow token-adoption cleanup (294 un-tokenized `rounded-*`/`shadow-*`
    occurrences across 65 files, audit `03` §3/§8) under the **legacy** palette first — same
    "consolidate before switching values" discipline as mobile's Phase 1.
12. Port the module-accent decision to `navConfig.ts`-driven nav (net-new on client).
13. Extend `WorkspaceThemeBridge`'s defaults to `v2`'s values
    ([05](05-organization-branding-compatibility.md) §3 item 1).
14. Flip `data-design-system` to `v2` as client's single cutover, then remove the `legacy`
    palette from client's generated output once confirmed stable.
    - **Checkpoint:** `tsc --noEmit`, `npm run lint`, `npm run build`; visual spot-check across
      the ~40 feature pages that import `Button`/`Card`.

## Phase 5 — website, gated on mobile and web both being stable

15. Add the CSS-variable token layer first (website has none today — audit `03` §0/§3/§8).
16. Apply `v2`'s values directly (website has no flag mechanism — lowest risk, smallest page
    count, cut over in one step once this phase starts).
17. Add a first dark-mode pass; reconcile `website/src/data/site.ts`'s module list against
    client's `navConfig.ts` (audit `03` §9.10).
    - **Checkpoint:** visual pass across website's 5 pages in both themes; confirm the Astro
      build still produces correct static output.

## Pre-existing findings folded in (unchanged from the original draft)

- Mobile error boundary and the `documents` module permission fix are already shipped
  (this session's pre-launch-readiness work) — no action needed here beyond confirming Phase 1's
  consolidation doesn't regress either.
- If Phase 1's Profile-screen consolidation touches the passport-photo `<Image>` source, confirm
  it still points at the authenticated endpoint, not a public-URL reference.
