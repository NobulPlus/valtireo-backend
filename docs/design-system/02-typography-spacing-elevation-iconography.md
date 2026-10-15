# 02 — Typography, spacing, radii, elevation, iconography

## 1. Typography

**Family:** Inter (interface text — labels, body, inputs, buttons, captions) and Manrope
(expressive headings — display, page title, hero text). This is not a new choice for the
product: `client/` already self-hosts both via `@fontsource/inter`/`@fontsource/manrope`
(audit `03` §2, `client/src/index.css:10-16`) and `website/` already self-hosts Manrope (`03`
§2, `global.css:1-18`). **Mobile is the only surface with no custom font loading at all**
(`03` §2 confirms zero `fontFamily`/`expo-font`/`loadAsync` usage) — it is the one surface that
needs new infrastructure here, not a new choice of typeface.

| Surface | Today | Change needed |
|---|---|---|
| `client/` | Inter + Manrope, self-hosted | None — already matches |
| `website/` | Manrope only | Add Inter for any interface-style text (currently none exists, but the token architecture in [07](07-cross-platform-token-architecture.md) assumes both are available) |
| `mobile/` | OS system font (San Francisco/Roboto) | Add `expo-font`, bundle Inter + Manrope static weights, load in `App.tsx` before first render |

**Weights needed:** Inter 400 (body/label), 500 (medium emphasis — field labels, tab labels),
600 (semibold — buttons, section headings), 700 (bold — stat values). Manrope 700 (section
titles), 800 (display/hero text) — matching the weights `makeTypography()` already uses today
(`theme.tsx:107-111`: `800`/`700`/`600`), just repointed from the system font to Manrope/Inter
respectively.

**Scale** — generalizes client's named steps (`index.css:96-105`) and mobile's existing five-step
scale (`theme.tsx:105-113`) into one platform-neutral set (pt on mobile ≈ px on web at default
density, per audit `05` §1):

| Step | Family | Size / line-height | Weight | Used for |
|---|---|---|---|---|
| `display` | Manrope | 28 / 34 | 800 | Hero greeting (Home), hero title (Login) |
| `title` | Manrope | 22 / 28 | 700 | Screen titles, card section titles |
| `heading` | Inter | 17 / 22 | 600 | Card headings, list-row primary text |
| `body` | Inter | 15 / 21 | 400 | Standard body text, input values |
| `label` | Inter | 13 / 18 | 500 | Field labels, button text |
| `caption` | Inter | 12 / 16 | 400 | Secondary/meta text, timestamps |

`display` moves from Inter-rendered-at-800-weight (today's `theme.tsx:107`) to Manrope, which
is the one typographic change with real visual weight — Manrope's geometric, slightly wider
letterforms are what will make Home's greeting name read as "the new identity" even before any
color changes land (Login's "Welcome back" uses `title`, not `display` — see
[04](04-screen-specifications-login-home.md)'s revision), so this is worth sequencing
deliberately in
[08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md).

## 2. Spacing

Unchanged from today — audit `05` §1 flags mobile's named spacing scale as "already the
cleanest, most literally reusable piece in the whole system," and client's raw Tailwind numbers
already agree with it numerically (audit `03` §3). No reason to invent new values; the win is
making the agreement explicit via the shared token file instead of coincidental.

| Token | Value |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |

## 3. Radius

Unchanged values from mobile's existing scale (`theme.tsx:97`), for the same reason — it's the
one surface with a real, named radius system already (audit `03` §3); client's two tokens
(`--radius-md`/`--radius-lg`, 8/12) are a subset of this same scale, and website has none. This
spec extends mobile's scale as the canonical one rather than inventing a seventh set of numbers.

| Token | Value |
|---|---|
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 22 |
| `pill` | 999 |

**Revision note:** an earlier draft added an `xxl` (28) step for "Login card, Home quick-access
card — hero-level surfaces only." Login's floating card has since been retired entirely (see
[04](04-screen-specifications-login-home.md)'s revision note) and Home's quick-access card
reverts to its current, already-fine value — so that step is removed rather than carried
forward unused. `radius.lg` (16) is promoted instead for Login's form fields and primary
button, for the rounder "clean, integrated" feel the corrected brief asks for — still within
the existing scale, no new value needed.

## 4. Elevation / shadow

Mobile's existing two named shadow recipes (`theme.tsx:100-103`) stay, expressed per audit `05`
§1 as platform-neutral `{offsetY, blur, opacity, color}` tuples so web/website can derive a CSS
`box-shadow` from the same four numbers instead of each surface inventing its own (client
today has no shadow tokens at all — audit `03` §3 counts only 13 untokenized `shadow-*`
occurrences across 12 files).

| Token | offsetY | blur (radius) | opacity | color | RN elevation | Used for |
|---|---|---|---|---|---|---|
| `soft` | 6 | 12 | 0.12 | `#000000` | 3 | Floating cards (Home quick-access card) |
| `tile` | 2 | 6 | 0.10 | `#000000` | 1 | Icon-tile chips |

**Revision note:** an earlier draft added a `hero` shadow recipe (offsetY 20, blur 30, opacity
0.35) "matching Login's current deliberately heavier shadow." Login no longer has an elevated
card to apply it to (see [04](04-screen-specifications-login-home.md)'s revision note), so
that recipe is removed rather than carried forward unused — `soft` and `tile` cover every
remaining elevated surface in this spec. Shadow color stays a neutral black on both themes; a
colored shadow was considered and rejected as reading murky rather than "glowing" at usable
opacities, and the brief's "subtle gradients" direction is now carried entirely by the
restrained `GeometricAccent` decoration ([03](03-component-specifications.md)) rather than by
either a gradient hero or a colored shadow.

## 5. Iconography

**Library:** `@expo/vector-icons` (Ionicons), unchanged — already used throughout mobile
(`IconTile.tsx:3`, `HomeScreen.tsx:6`) and there's no reason to introduce a second icon set for
a redesign that explicitly isn't touching the icon vocabulary, only the colors/weights around
icons.

**Style constraints from the brief** ("modern geometric shapes and subtle gradients... no
botanical, agricultural, or leaf illustrations"):
- Prefer `-outline` Ionicons variants for navigation/list contexts (already the dominant style
  in use — `calendar-outline`, `document-text-outline`, etc.) and reserve filled/solid variants
  for selected/active states only, giving a clear, deliberate state change rather than visual
  noise.
- No custom illustration set is specified or needed for this phase — the existing icon-chip
  pattern (a colored geometric square/rounded-square with a glyph) already satisfies "modern
  geometric," and no screen in the current app uses any leaf/plant/agricultural iconography to
  begin with, so this constraint is a guardrail for *future* additions (e.g. empty-state
  illustrations) rather than a change to anything that exists today.
- If an empty-state or onboarding illustration is designed later, it should use simple geometric
  shapes and the token palette (primary teal, apricot, lilac, neutrals) rather than
  photographic or organic/botanical imagery — flagged here as a constraint for that future
  work, not a deliverable of this spec.

**Gradients: revised.** The original draft kept the existing full-bleed hero mechanism
(`LinearGradient` + SVG grid pattern + `RadialGradient` glow + scattered `Sparkle`s, see
`LoginScreen.tsx:27-55`, `HomeScreen.tsx:109-137`) and only re-colored it. Review corrected
this: "subtle" means there is **no full-bleed gradient fill at all** on Login or Home anymore
— per [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md)'s
revision, both screens sit on a flat page background with a small, low-opacity
`GeometricAccent` decoration (thin-stroke outlined shapes, not a filled gradient, grid, glow, or
sparkle field) as the only decorative element. A gradient fill is no longer part of this
system's vocabulary for any screen under this spec — if a future screen wants one, it would be
a new decision, not an extension of a pattern this spec establishes.
