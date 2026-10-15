# 06 — Accessibility and responsive-layout requirements

## 1. Contrast

Covered in detail in [01-color-tokens.md](01-color-tokens.md) §1 — summarized requirement:
every text/icon-on-fill pairing used anywhere in the system must hit WCAG AA (4.5:1 normal
text, 3:1 large text/graphical objects) before implementation, using the token-level pairing
rules already documented there (`primary`/`accentApricot`/`accentLilac` restricted to
large-surface or `inkOnAccent`-paired use; `primaryStrong`/`primaryDark` safe for any size, with
the dark-mode CTA using dark text, not white). Any *new* color combination introduced during
implementation that isn't already in the §1 ledger must be computed and checked before it ships
— the ledger is not exhaustive of every possible future pairing, only of the ones this spec
already proposes.

## 2. Touch targets

Minimum 44×44pt per Apple HIG / 48×48dp per Material — mobile's current `IconTile` hit area is
already comfortably above this (54×54 chip, `IconTile.tsx:32`); the new `Button` spec
([03](03-component-specifications.md)) commits to a 48dp minimum height explicitly, since
today's inline buttons don't state a minimum anywhere (`LoginScreen.tsx:255,269` rely on
padding alone, which happens to clear 44pt today but isn't guaranteed to as content/line-height
changes with the new type scale in [02](02-typography-spacing-elevation-iconography.md)).

## 3. Safe-area handling

Audit `02` ("New observations," cited in audit `05` §2/§4) found zero `useSafeAreaInsets()`
usage anywhere in mobile despite `react-native-safe-area-context` being installed, and called
out Login's hero (`paddingTop: 52`, confirmed at `LoginScreen.tsx:215`) and Home's hero
(`paddingTop: spacing.lg`, confirmed at `HomeScreen.tsx:390`) as the two fixed-padding
offenders — both hero headers, both exactly the surfaces this redesign touches first.
**Requirement:** both hero headers must read `useSafeAreaInsets().top` and use it (plus a small
fixed buffer, not in place of it) instead of a hardcoded constant, fixed as part of rebuilding
these two headers' visual treatment in
[08](08-migration-plan-and-regression-checkpoints.md)'s Phase 1 — doing it as a separate pass
later would mean touching the same lines of layout code twice.

## 4. Text scaling / Dynamic Type

Not currently addressed anywhere in mobile — no screen sets `allowFontScaling={false}` (good,
nothing is actively blocking it), but no screen has been tested against enlarged system text
sizes either. **Requirement for implementation:** verify the new `Button`/`Input`/`Card`/
`ListRow` components (§[03](03-component-specifications.md)) don't clip or truncate text at
the OS's largest standard accessibility text size (iOS "Larger Text" at the top of its non-bold
range; Android's 130% scale) — particularly `Button`'s single-line label and `ListRow`'s
title/subtitle stack, which are the two places a long organization-specific label (a custom
module name, a long employee name) combined with a larger font could overflow a fixed-height
container. This is a verification step for the components, not a value to add to the token
file.

## 5. Reduced motion / reduced transparency

Neither today's hero backdrop (`LoginScreen.tsx:36-39,44-52`, `HomeScreen.tsx:118-121,126-134`,
now retired per [04](04-screen-specifications-login-home.md)'s revision) nor its replacement,
the static `GeometricAccent` decoration ([03](03-component-specifications.md)), animates — so
`prefers-reduced-motion` is not currently implicated and stays that way under this spec. If a
future phase adds an entrance animation anywhere (not part of this spec), it should respect
`AccessibilityInfo.isReduceMotionEnabled()` at that time.

## 6. Color-independence of status/compliance information

Home's document-compliance pills (`HomeScreen.tsx:317-318`) and the pending-actions list
currently convey urgency through color alone (`danger` vs `warning` pill tint) plus a text
label (`COMPLIANCE_LABELS`, `HomeScreen.tsx:67-75`) — the text label already satisfies "not
color alone," and this spec doesn't change that pattern, only the specific `danger`/`warning`
hex values (§4 of [01](01-color-tokens.md)). No new requirement here; confirmed as already
compliant and worth preserving as-is during the re-skin.

## 7. Responsive layout

Mobile has one real breakpoint concern: phone vs. tablet aspect ratios, not a desktop-style
multi-breakpoint grid. The `IconTile` grid (`width: '31%'`, `IconTile.tsx:31`) and the
three-column stats row (`HomeScreen.tsx:241`) are percentage/flex-based already and scale
correctly on larger phones and small tablets without a dedicated tablet layout — no change
needed here. Client's responsive behavior (sidebar collapse, `MobileNavDrawer`) and website's
`clamp()`-based responsive type (audit `03` §2) are both unaffected by this spec; website's
hardcoded `clamp()` sizing is a token-coverage gap flagged separately in
[07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md), not an
accessibility issue.
