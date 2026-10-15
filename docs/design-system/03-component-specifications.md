# 03 — Reusable React Native component specifications

Scope: mobile only. Client already has a well-adopted shared library (`Button` in 41 files,
`Card` in 33 — audit `03` §4) that reaches most of the app on a token-value swap alone (audit
`05` §2, item 10); it needs a *values* update once [07](07-cross-platform-token-architecture.md)
lands, not new component specs. This file is specifically where the redesign's biggest risk
lives: audit `05` §2 found `IconTile`/`Avatar`/`Sparkle` are used in only 4 of 29 mobile
screens, with the other 25 each hand-rolling their own `StyleSheet.create`. Every spec below is
written to be adoptable by those 25 screens during
[08](08-migration-plan-and-regression-checkpoints.md)'s Phase 2 consolidation step, not just by
Login/Home.

Each spec below extends an existing component (named, with its current file path) or defines a
genuinely new one where audit `03` found a gap. None of this is implemented by this document.

## Button

**New component — audit `03` §4 found mobile has no shared `Button`; every screen builds its
own `Pressable` + `StyleSheet` (e.g. `LoginScreen.tsx:193-195,255-257,269-280`).** Variants:

| Variant | Fill | Text color | Use |
|---|---|---|---|
| `primary` | `primaryStrong` (light) / `primaryDark` (dark, with `inkOnAccent` text — see §1 of [01](01-color-tokens.md)) | `surface` (light) / `inkOnAccent` (dark) | The one dominant action per screen |
| `secondary` | `surfaceAlt`/`chip` | `ink` | Secondary actions, "Not now" |
| `ghost` | transparent | `primary` | Tertiary/text-only actions, e.g. "Forgot password?" |
| `danger` | `danger` | `surface` | Destructive confirmations |

Props: `label: string`, `variant`, `onPress`, `disabled?`, `loading?` (renders an
`ActivityIndicator` in place of the label, color matched to the variant's text color — matching
today's inline pattern at `LoginScreen.tsx:194,146`), `icon?` (leading Ionicon, 18px).
Radius: `md`. Padding: `spacing.md` vertical, `spacing.lg` horizontal. Min touch target 48×48
(see [06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md)).
Disabled state: `opacity: 0.6` (matches today's `buttonDisabled`, `LoginScreen.tsx:257`).

## Card

**New component — audit `03` §4/§8 found 29 screens' worth of independently re-declared
`{ backgroundColor: colors.white, borderRadius: radius.md, ..., borderWidth: 1, borderColor:
colors.line }` card styles** (e.g. `HomeScreen.tsx:424,430`). One component, three slots:
`header?` (title + optional trailing action), `children`, `footer?`. Background `surface`,
border `border`, radius `md` by default (`lg`/`xxl` via a `size` prop for hero-adjacent cards).
Padding `spacing.md`. No shadow by default (today's cards are flat with a hairline border, not
shadowed — `HomeScreen.tsx:424` confirms no shadow on the row cards); a `elevated` boolean prop
applies `shadow.soft` for the few cards that should float (Home's quick-access card).

## ListRow

**New component** — the second half of the consolidation gap: list screens (Leave, Tickets,
Assets, Documents, Payslips, Notifications, etc.) each build their own row layout today. One
row = leading icon-chip or avatar slot, title/subtitle text block, optional trailing element
(status pill, chevron, value). Height target ≥56 to keep the full row comfortably tappable
even though only part of it may be interactive. This is the primitive audit `05` §2's
consolidation step (Phase 2) is for — it doesn't exist today in any form, generic or per-screen.

## IconTile (extend existing)

`mobile/src/components/IconTile.tsx` — structure unchanged (icon-chip + label, used on
Home/More menu). Only the values it's fed change: `bg`/`iconColor` continue to come from the
module-accent map ([01](01-color-tokens.md) §5), now with new hex values and 5 new module keys
available. No prop or structural change to the component itself.

## Avatar (extend existing)

`mobile/src/components/Avatar.tsx` — structure unchanged (authenticated photo fetch with
Bearer header, initials fallback). Only the initials-fallback background color changes:
`colors.pine` (today, `Avatar.tsx:24`) → `colors.primary`. No other change — this component is
already correctly built (auth-aware image loading, graceful fallback) and nothing here asks for
rework.

## Sparkle (extend existing)

`mobile/src/components/Sparkle.tsx` — structure unchanged (SVG four-point sparkle). Colors
supplied by callers change per [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md)
(white → a cream-tinted white at low opacity for the non-accent sparkles, `accentApricot` for
the accent sparkles — replacing `HERO_ACCENT`'s old lime).

## ErrorBoundary (extend existing)

`mobile/src/components/ErrorBoundary.tsx` — this component deliberately hardcodes its own
color literals rather than reading `useTheme()` (documented reason at `ErrorBoundary.tsx:13-19`:
it wraps `ThemeProvider` itself, so it can't depend on a context that might be what crashed).
That constraint doesn't change. Only the literal `COLORS` object (`ErrorBoundary.tsx:19`)
updates to the new values: `paper`→`bg` (`#FFF9F0`), `ink`→`ink` (`#071F24`), `muted`→`muted`
(`#4F6B6E`), `pine`→`primaryStrong` (`#00585B`, since this is a solid button with white text —
§1 of [01](01-color-tokens.md) applies even to a component that can't read the theme context),
`line`→`border` (`#EAE2D3`). No dark-mode variant needed here deliberately — if the theme
system itself is what crashed, falling back to a single fixed light treatment is the safer
choice, consistent with how this component already behaves today.

## Pill / Badge

**New component** — currently inlined per-screen (`HomeScreen.tsx:317-318`: a `View` with
`backgroundColor: ${pillColor}1F` and a `Text`). One component: `tone` prop
(`danger`/`warning`/`success`/`info`/`pending`/`draft`/`neutral`), renders the status color at
~12% alpha as background with the full-strength color as text — the same recipe already used
ad hoc at `HomeScreen.tsx:317` and the leave-balance chip at `HomeScreen.tsx:362`, just named
and shared instead of re-derived per screen.

## SearchableSelect, ListFooterLoader, QueryError (no change)

These three (`mobile/src/components/{SearchableSelect,ListFooterLoader,QueryError}.tsx`) are
structurally sound per audit `03` §4 and need only the ambient token values they already pull
from `theme.tsx` to update — no prop or behavior changes.

## Input (extend inline pattern into a component)

**New component**, generalizing the field pattern currently inlined in `LoginScreen.tsx:160-172,174-185`
(label + `TextInput` with `colors.line` border, `radius.md`, `colors.paper` background). Props:
`label`, `value`, `onChangeText`, `placeholder`, `secureTextEntry?`, `keyboardType?`, `error?`
(renders the error message below in `danger`, matching `LoginScreen.tsx:253`'s existing error
text style). Border `border`, focus state border color `primary` (new — today's input has no
visible focus state at all, a gap worth closing while building this component rather than
carrying it forward unaddressed).
