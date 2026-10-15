# Redesign Readiness and Migration Plan

Date: 2026-10-15
Scope: synthesis and forward-looking plan, written after reading all four prior audits in full:
`01-system-architecture-and-feature-inventory.md`, `02-mobile-employee-experience-audit.md`,
`03-current-design-system-audit.md`, `04-security-reliability-and-test-results.md`. No code outside
this file was changed; nothing was committed or pushed. This report assumes Valtireo's own
positioning: an **Organizational Operating System** spanning HR, service desk, assets, payroll,
approvals, and (per the platform module catalog) recruitment/performance/learning/financial-admin
once built — not a narrow HR/attendance app. Redesign recommendations below are written to hold up
as more modules land, not just for the employee-self-service slice mobile currently covers.

---

## 1. Can one shared design-token spec support React, React Native, and Astro?

**Yes — the three surfaces already converge on the same conceptual token categories (confirmed in
`03`, §§1-6: color roles, type scale, spacing, radius, shadow, module-accent, light/dark). The
problem today isn't that unification is architecturally hard, it's that nobody ever wrote the
single source of truth — each surface independently invented its own numbers for the same concept**
(three different "page background" hex values, two different dark-mode engines, `danger`/`warning`/
`success` all slightly different across mobile vs. client — `03` §9 items 1 and 6).

### What should be shared (platform-agnostic, values only)

A single token file — **recommend JSON** (not YAML, so it can be both `JSON.parse`'d directly in a
Metro/RN build step and imported as a Tailwind v4 `@theme` source without a second parser dependency)
— at something like `design-tokens/tokens.json`, versioned in the repo root (sibling to `client/`,
`mobile/`, `website/`, `server/`), containing:

- **Color roles**, named by role not by raw value, matching the vocabulary `03` §10 already
  recommends consolidating toward: `brand.primary` (pine `#123f3a`), `brand.accent` (lime —
  currently missing from client entirely, `03` §1), `ink`, `muted`, `paper`/`canvas` (one name, one
  value — currently three), `border`, `danger`, `warning`, `success`, `info`, `pending`, `draft`.
  Each role gets exactly one light value and one dark value in this file — ending the
  independently-invented-per-surface-per-status-color problem (`03` §9.1).
- **Module-accent pattern**: mobile's `lightModuleColors`/`darkModuleColors` (`03` §6) is the one
  clear win worth promoting to a shared spec — a `modules.{leave,attendance,tickets,directory,
  calendar,assets,documents,payslips,profile,lifestyle}.accent` map, light+dark. This is cheap to
  share because it's just more entries in the same color-role file, and `03` §10 explicitly flags
  it as the single clearest mobile-only pattern worth generalizing rather than losing in a rebrand.
  As new OS modules ship (recruitment, performance, learning, financial_admin — seeded as catalog
  rows per `01` §1.2 but not yet built), this map is where their accent gets defined once, for every
  surface, from day one — rather than client inventing its own convention later.
- **Type scale ratios** (not font files): named steps — `display`, `page-title`/`title`, `section`/
  `heading`, `body`, `label`/`caption` — as a ratio or rem/pt scale, e.g. client's existing named
  steps (`03` §2) generalized to a platform-neutral unit (pt on mobile ≈ px on web at default
  density). The *family* (which font) and the *loading mechanism* are explicitly NOT shared (below).
- **Spacing scale**: mobile's named `{xs:4, sm:8, md:16, lg:24, xl:32}` (`03` §3) is already the
  cleanest, most literally-reusable piece in the whole system — client's raw Tailwind numbers
  happen to agree numerically (`03` §3) but aren't expressed as a token today. Promote mobile's
  named scale verbatim into the shared file; have client's Tailwind config consume it instead of
  Tailwind's un-customized defaults (closing the "coincidental, not shared" gap `03` §3 flags).
- **Radius and shadow "recipes"**: radius scale (`{sm:8, md:12, lg:16, xl:22, pill:999}`, again
  mobile's existing values as the base) and shadow recipes expressed platform-neutrally as
  `{offsetY, blur, opacity, color}` tuples — enough to derive a CSS `box-shadow` string on web/
  website and an RN `shadow*`/`elevation` object on mobile from the same four numbers.
- **The module-accent *pattern itself*** as a documented convention (which module gets which role
  name), separate from consolidating the *module list* itself — `03` §9.10 separately flags that
  the module/feature list is already duplicated between `client/src/components/shell/navConfig.ts`
  and `website/src/data/site.ts` (and mobile's home/more-menu screens). That's a second, related but
  distinct consolidation (see §4 below) — the token file should reference module keys, not redefine
  the module list.

### What must stay platform-specific

- **Component implementations.** The token file ends at values; `Button`, `Card`, `IconTile`-style
  primitives stay native per platform (Tailwind-class components on web/website, RN `StyleSheet`
  components on mobile). Nothing here asks for a shared component library across React and React
  Native — that's a much larger, likely not-worth-it undertaking given the platforms' different
  interaction primitives.
- **Font loading mechanism.** Client self-hosts via `@fontsource/*` npm packages (`03` §2); website
  self-hosts `.woff2` via `@font-face`; mobile currently loads **no** custom font at all (bare OS
  system font, confirmed by `02`'s "New observations" and `03` §2's grep for `fontFamily|expo-font|
  loadAsync` returning zero matches) and would need `expo-font` wired in `app.json`/`App.tsx` to
  consume the same family the token file names. The *family name* is a shared token value; *how*
  each runtime gets the actual glyphs on screen is not.
- **Dark-mode storage/engine.** Client uses `localStorage` + a `data-theme` attribute + its own
  `ThemeContext.tsx`; mobile uses `expo-secure-store` + its own `ThemeProvider` (`03` §5). Keep two
  engines — platforms differ on storage primitives — but have both consume the *same* light/dark
  value pairs from the shared token file instead of each hand-maintaining its own color constants,
  and align on one *state machine* (`'light'|'dark'|'system'`, same transition semantics) per `03`
  §10's "Consolidate" recommendation, even though persistence mechanics differ.
- **Build-time consumption format.** Web (`client/`) and website (`website/`) consume the JSON via a
  small build step that emits a Tailwind v4 `@theme` block (replacing the current hand-written
  `@theme` in `client/src/index.css` and giving website its first real token layer — `03` §0 flags
  website as having none today). Mobile consumes the *same* JSON via a generated TypeScript module
  (`theme.generated.ts`) that `theme.tsx`'s `ThemeProvider` imports instead of hand-writing
  `lightColors`/`darkColors`/`spacing`/`radius` literals. One source JSON, two generated outputs —
  this is the concrete format the task brief asked for, and it directly fixes the root cause `03`
  §9 and §10 ("Replace" section) call out: mobile's `theme.tsx:23` comment *claims* parity with
  client's palette that was never mechanically verified and has since drifted. A generated-from-one-
  source approach makes that claim true by construction instead of by assertion, and a simple CI
  script (diff the generated mobile module and Tailwind theme against the source JSON) replaces the
  "stale comment" failure mode permanently.

### Why this doesn't touch the architecture that's working

`01` §1.2 confirms `ModuleEntitlementService` is the single source of truth for module
visibility/access, consumed identically by client and mobile, and is entirely orthogonal to
styling — a token-spec rollout changes zero lines in that service, the four auth/tenancy
middlewares, or the approval engine. The redesign is purely a presentation-layer change riding on
top of an already-sound multi-tenant architecture.

---

## 2. Introducing a new visual identity without breaking functionality

### Concrete risk points (from `03`'s component-adoption findings)

1. **Partial reach on mobile.** `IconTile`/`Avatar`/`Sparkle` are used in only 4 of 29 screens
   (`03` §4); the other 25 screens each have their own `StyleSheet.create` (45 occurrences across 29
   files). **A palette swap at the token layer alone will NOT visually reach those 25 screens** if
   their styles hardcode values instead of importing from `theme.tsx` — and `03` §8 already found
   12 hardcoded hex literals outside `theme.tsx` in `HomeScreen.tsx` and `LoginScreen.tsx` alone, the
   two screens *already mid-redesign*. Risk: ship a new token file, see Login/Home update, and have
   Leave/Tickets/Directory/Assets/Documents/Payslips/Profile/Notifications/Calendar/Lifestyle screens
   silently keep the old look because they never reference the token import, producing an
   inconsistent, half-rebranded app that reads as broken rather than "in progress."
2. **Client's tokens exist on paper more than in practice.** 294 un-tokenized `rounded-*`/`shadow-*`
   Tailwind utility occurrences across 65 files bypass the two actual radius tokens (`03` §3, §8) —
   the same "token file says one thing, codebase does another" risk exists on web, just already
   latent today rather than introduced by the redesign. A redesign that only updates `index.css`
   token values will shift maybe 20% of client's actual rounding/elevation, not the rest.
3. **Website has zero token coverage to begin with** (`03` §0, §8) — a "new identity" rollout that
   assumes website can just "pick up the new tokens" like client can is wrong; website's 526-line
   `global.css` has no token indirection at all today, so website needs a token-adoption pass
   *before* a visual-identity pass can land there, not as the same step.
4. **The module-accent pattern and per-tenant branding are asymmetric across surfaces** (`03` §6,
   §7). A redesign that leans on "one bold accent + neutral everywhere else" (the mobile mockup
   direction per the task brief) interacts directly with mobile's *existing* module-accent tiles
   (10 modules, each with their own accent today) — the new identity needs an explicit decision on
   whether module-accent coloring survives the "one bold accent" direction or is retired in favor of
   neutral icon tiles with the single brand accent used only for primary CTAs/hero surfaces. This is
   a design decision the redesign must make explicitly, not one that falls out of a token-value
   swap — because today's few-surfaces-use-it inconsistency becomes a worse,
   "some screens still show 10 colors, others show 1" inconsistency if left ambiguous mid-rollout.
5. **Per-tenant branding is dead code on mobile** (`03` §7) — `types/api.ts` already deserializes
   `logo_url`/`theme` from the session payload, but zero screens read it. If the redesign ships a
   new *default* Valtireo brand treatment on mobile without also wiring the branding fields, any org
   that has configured a custom primary color/logo for client will see it honored on web and
   silently ignored on the freshly-redesigned mobile app — a worse, more visible inconsistency than
   today's "mobile just doesn't support it" because the redesign draws fresh attention to visual
   polish precisely where this gap becomes most noticeable.
6. **Nothing here is an entitlement/auth risk.** `01` confirms module gating, approval flows, and
   tenancy middleware are independent of styling — a visual pass cannot regress access control. The
   risk surface is entirely "inconsistent look," not "broken function" or "data leak."

### Sequencing to avoid shipping a half-migrated state

- Land the shared token file and its two generated outputs (Tailwind config + mobile TS module)
  **before** any screen's visual values change, and verify via the CI parity check (§1) that
  generated outputs match source — this is infrastructure, not yet visible to any user.
- On mobile specifically, do a **"wire the plumbing" pass before the palette swap**: consolidate the
  25 screens currently hand-rolling `StyleSheet.create` onto shared primitives (`IconTile`, a new
  shared Card/ListRow, `SearchableSelect`-style reuse) *while they still show the old palette*, so
  the subsequent token swap is a true single-point-of-change across all 29 screens instead of a
  25-screen straggler problem. Doing consolidation and rebrand in the same commit makes it
  impossible to tell whether a visual regression came from the new values or the refactor.
- Treat "module-accent retained or retired" as an explicit design decision made once, documented in
  the token file itself (e.g. a comment or a `modules.*.accent: null` convention if retired), applied
  uniformly — not left for each screen's author to decide independently during consolidation.
- Gate the rollout screen-by-screen behind what's *already* a sound mechanism: since
  `ModuleEntitlementService` already determines which modules/screens a given org can see (`01`
  §1.2), the same conditional-rendering muscle used for entitlement can be reused (not re-architected)
  to stage "new visual treatment" vs. "old" per screen during the transition if a flag-based rollout
  is wanted — but this is optional; the sequencing above (plumbing before palette) is the more
  important guard.
- For client: do the "make the 294 un-tokenized radius/shadow occurrences actually use the token"
  cleanup *before* changing what the token values are, for the same reason — otherwise a token-value
  change will visibly update only a minority of the app and the team will spend the redesign window
  debugging why rounding looks inconsistent rather than designing.
- For website: add the token layer itself first (even before adopting the new values) since none
  exists today — this is a prerequisite step, not something that can be skipped by virtue of website
  being the last phase (see §3).

---

## 3. Phased migration strategy — mobile-first, then web, then website

### Why mobile-first, and why Login/Home specifically anchor phase 1

Mobile is already the most actively maintained surface and already has a live design exploration
in progress for Login and Home (gradient hero, grid/sparkle texture, floating bordered card
treatment, one-bold-accent discipline, reusing pine+lime rather than a new brand palette). That
work is the de facto starting point regardless of what this plan recommends — the right move is to
have the token-spec work (§1) catch up to and formalize what that exploration is already doing, not
redo it. Concretely: extract whatever color/spacing/radius decisions the Login/Home mockups settle
on into the shared token file as the *first* real values it ships with, rather than inventing token
values in the abstract and then reconciling them against an in-flight design later.

### Phase 1 — Mobile: infrastructure + the screens already mid-redesign

1. Stand up the shared token JSON + mobile's generated TS module, seeded with the values the
   Login/Home mockup is already converging on (brand pine + lime accent, the gradient/grid/sparkle
   treatment's supporting neutrals).
2. Fix mobile's two platform-level gaps **alongside** this pass, not after, because both are
   directly implicated by the screens being redesigned right now:
   - **Safe-area handling**: `02`'s "New observations" section confirms zero `useSafeAreaInsets()`
     usage anywhere, and specifically calls out Login's hero (`paddingTop: 52`) and Home's hero
     (`paddingTop: spacing.lg`) as the two fixed-padding offenders — which are exactly the two
     screens getting a new gradient-hero treatment. A new hero header is the wrong moment to *keep*
     a hardcoded padding constant; fix inset-awareness as part of building the new hero component,
     not as a follow-up ticket, since it's the same lines of code either way.
   - **Font loading**: wire `expo-font` and load the shared type family named in the token file
     now, while Login/Home's typography is already being touched for the new hero treatment, rather
     than shipping a new visual direction still rendering in the bare OS system font and doing a
     second pass later to add real typography.
3. Apply the new treatment to Login and Home only in this phase — these are the two screens with an
   actual design direction to implement; everything else stays on the current look deliberately.
4. Wire mobile's dead branding fields (`logo_url`, `theme`) for *at least* Login/Home in this phase,
   even if per-tenant override isn't visually exercised by every org yet — so the new hero component
   is built branding-aware from day one instead of hardcoded-Valtireo and needing retrofitting later
   (`03` §7's "modeled but dead code" gap).

### Phase 2 — Mobile: consolidate remaining screens, then roll the palette out

5. Before touching the other 27 screens' visuals, do the component-consolidation pass flagged in §2:
   move the highest-traffic remaining screens (Tickets — "the most fully built-out flow" per `02`;
   Leave; Attendance; Directory; Assets; Documents; Payslips; Profile; Notifications; Calendar;
   Lifestyle) off their per-screen `StyleSheet.create` onto shared Card/ListRow/Section primitives
   built from the token file, keeping the *old* palette active throughout this step so visual
   regressions during consolidation are easy to isolate from palette changes.
6. Once consolidated, apply the new token values app-wide in one pass — this is now a single-point
   change (the shared primitives + token file) rather than a 29-screen hunt.
7. Decide and apply the module-accent treatment (retained-but-restyled vs. retired in favor of
   neutral tiles) uniformly across all module tiles in this same step.

### Phase 3 — Web (`client/`)

8. Land the Tailwind-config-generation half of the token pipeline; migrate `client/src/index.css`'s
   hand-written `@theme` block to be generated from the same source JSON mobile now consumes,
   closing the parity gap (`03` §9.1/§9.2: mismatched danger/warning/success hexes, missing `lime`
   token, three different page-background values).
9. Do the radius/shadow token-adoption cleanup (the 294 un-tokenized occurrences, `03` §3/§8)
   *before* or *during* the value swap, same rationale as mobile's consolidation step — client's
   tokens already exist nominally, so this phase is cheaper than mobile's (no per-screen
   `StyleSheet` reimplementation to untangle), but the same half-migrated risk applies if skipped.
10. Client's shared `components/ui/*` library (Button in 41 files, Card in 33 — `03` §4) means a
    palette swap here reaches the overwhelming majority of the app automatically, unlike mobile —
    this is the payoff of client's higher component-adoption rate, and is itself a point in favor of
    using client's `components/ui` pattern as the long-term target mobile should converge toward
    (already `03` §10's recommendation).
11. Port the module-accent decision made in mobile Phase 2 to client's `navConfig.ts`-driven nav and
    any module-colored surfaces, since client currently has no module-accent concept at all (`03`
    §6) — this is a net-new addition on web, done once mobile has already settled the pattern.
12. Extend client's existing, working per-tenant `WorkspaceThemeBridge` branding pipeline (`03` §7)
    only as needed to stay consistent with whatever the new default brand treatment establishes —
    this pipeline is already sound and is the template mobile's Phase 1 branding wiring should have
    mirrored, so by this phase the two should already agree in shape.

### Phase 4 — Website (`website/`)

13. Add the token layer to `website/src/styles/global.css` first — generate CSS custom properties
    from the same source JSON (website has no build tooling beyond Astro itself, so this is a plain
    CSS-variable emission step, not a Tailwind integration) — since website currently has only 6
    `:root` tokens and no indirection for the other ~520 lines of hardcoded values (`03` §0/§3/§8).
14. Apply the new values once the token layer exists. Because website is purely static marketing
    content with the smallest page count (5 pages) and the fewest hand-rolled "card" patterns to
    reconcile (`.feature-card`, `.conversation-card`, `.access-card`, etc. — `03` §4/§8), this is the
    cheapest surface to finish and is correctly sequenced last precisely because it's lowest-risk and
    lowest-traffic for an internal audience, not because it matters least to the brand externally.
15. Add a first dark-mode pass (`03` §0/§5/§10 explicitly recommend this while the site is still
    small) and reconcile the duplicated module list (`website/src/data/site.ts` vs. client's
    `navConfig.ts`, `03` §9.10) against whatever single source of truth Phase 3 established for
    client's module list — this is the natural moment to also resolve that duplication since
    website's module strip is being touched anyway for the new accent/dark-mode work.

---

## 4. Findings from reports 01/02/04 that should be fixed before or alongside the redesign

### Fix before or during (interacts directly with redesign work)

- **Mobile safe-area handling (`02`, "New observations")** — directly interacts with Phase 1 since
  the two screens lacking inset-awareness (`LoginScreen.tsx:215`, `HomeScreen.tsx:390`) are exactly
  the two getting new hero treatments. Fix as part of building the new hero component (§3, Phase 1,
  step 2) rather than as a separate follow-up — doing it after would mean touching the same lines
  twice.
- **Mobile font loading (`03` §2, `02` confirms zero `expo-font`/`fontFamily` usage)** — same
  reasoning: Login/Home's typography is being redesigned now; load real typeface(s) at the same time
  instead of shipping a new visual direction still on the bare OS system font.
- **Mobile's dead per-tenant branding fields (`03` §7)** — if the redesign ships a new default brand
  treatment on mobile without wiring `logo_url`/`theme`, organizations with custom branding
  configured will see the inconsistency *more*, not less, once mobile looks polished enough that the
  absence of their branding reads as a bug rather than "mobile just doesn't support that yet."
  Should be wired during Phase 1, at least for the screens being touched.
- **Module-accent-pattern decision (`03` §6)** — not a pre-existing bug, but an architectural
  decision the redesign forces: whether mobile's 10-module accent system survives a "one bold
  accent" visual direction. Must be decided explicitly and applied consistently (§2), not left
  ambiguous across the phased rollout.
- **Client's un-tokenized radius/shadow usage and mobile's un-converted 25 screens (`03` §3/§4/§8)**
  — both are "fix alongside, as a prerequisite step within each phase," covered in detail in §2/§3
  above; calling them out again here because they are the single biggest risk of a visibly
  half-migrated ship if skipped.

### Fix before, but largely independent of redesign timing (no reason to block on, but don't defer past it either)

- **Passport-photo public-disk PII exposure (`04` §1.1)** — this does not block or interact with
  styling work (it's a storage-disk/auth-endpoint issue, `server/config/filesystems.php` +
  `EmployeeController.php:496-499`), but the redesign will likely touch the Profile screen (where
  the passport photo is displayed) on both mobile and client. If the Profile screen's visual
  treatment is being reworked anyway, it costs little extra to swap the `<img src>`/`Image` source
  from the public-disk URL to an authenticated endpoint at the same time — otherwise this fix
  arrives as a separate, unrelated-looking server+two-frontend change later. Recommend doing the
  backend fix (`04`'s own recommendation: move to the `local` disk behind an org/ownership-scoped
  controller endpoint) on its own schedule, but have whichever phase touches Profile screens pick up
  the corresponding frontend URL change rather than independently re-touching Profile a second time.
- **Stale `documents` module `required_permission` (`04` §1.2)** — confirmed by `04` to be a
  nav-visibility bug only, not an access-control bypass (the real gate, `EnsureModuleIsSubscribed`,
  doesn't check `required_permission`). It does, however, mean `ModuleEntitlementService.forUser()`
  reports `documents` as `visibility: 'hidden'` for a plain Employee — worth fixing (`required_
  permission => null`, matching attendance/assets/payroll's existing pattern) before any redesign
  work that touches navigation/module-tile rendering, so the redesign doesn't visually encode a
  known-stale hidden state into a freshly restyled nav/tile component. Cheap, low-risk, do it early
  in whichever phase first touches mobile's `MoreMenuScreen`/Home quick-access tiles or client's
  `navConfig.ts`.
- **Missing mobile top-level error boundary (`02`, "New observations")** — web already has one
  (`client/src/components/ErrorBoundary.tsx`, added in commit `4811d41`); mobile does not. This
  matters *more*, not less, once visual changes start landing on mobile, because a redesign
  necessarily touches render-path code across many screens — the exact kind of change most likely to
  introduce a render-time crash during the transition. Recommend adding a mobile error boundary
  **before** Phase 1 begins (it's a small, self-contained addition — wrap `RootNavigator` in an
  error-boundary component, mirroring web's) specifically so that any redesign-introduced render bug
  degrades to a recoverable error screen instead of a hard crash, for the whole duration of the
  multi-phase rollout.
- **Date-rot-flaky backend tests and the `APP_DEBUG` production check (`04` §1.3, action items 3-4)**
  — genuinely unrelated to the redesign; no interaction either way. Fix on their own schedule.

### Net assessment

Nothing in `04`'s findings blocks a redesign from starting. The only two items worth pulling forward
ahead of or alongside the redesign specifically *because* the redesign makes them more consequential
are the mobile error boundary (crash-resilience during a period of heavy render-path churn) and the
`documents` module permission stale-flag (so nav/tile restyling doesn't ship on top of a known-stale
visibility state). The passport-photo fix is worth bundling into whichever phase touches the Profile
screen, purely for one-touch efficiency, not because it's urgent relative to the redesign.

---

## Summary table — phase sequencing at a glance

| Phase | Surface | Key steps | Pre-existing issues folded in |
|---|---|---|---|
| 0 (pre-work) | — | Add mobile error boundary; fix `documents` module `required_permission` | `02` error-boundary gap; `04` §1.2 |
| 1 | Mobile | Token JSON + generated TS module seeded from in-flight Login/Home mockup values; fix safe-area insets and font loading on Login/Home; apply new treatment to Login/Home only; wire branding fields for those screens | `02` safe-area/font gaps; `03` §7 dead branding fields |
| 2 | Mobile | Consolidate remaining 27 screens onto shared primitives (old palette); then roll new token values out app-wide; settle module-accent decision | `03` §4 low component adoption; §6 module-accent pattern |
| 3 | Web (`client/`) | Generate Tailwind theme from same source JSON; clean up un-tokenized radius/shadow usage; port module-accent decision; extend existing branding pipeline | `03` §3/§8 token-bypass; §6 missing module-accent; bundle passport-photo frontend fix if touching Profile |
| 4 | Website | Add CSS-variable token layer (new); apply new values; add first dark-mode pass; reconcile duplicated module list with client | `03` §0/§5/§9.10 no tokens/no dark mode/duplicated module list |
