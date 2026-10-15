# 01 — Color tokens

Role names below replace mobile's current `pine`/`ink`/`muted`/`paper`/`white`/`chip`/`line`
vocabulary (`mobile/src/theme.tsx:5-21`) with the consolidated set audit `05` recommended
(§1) and fixes the `white`-is-dark-in-dark-mode naming smell (`00-overview.md`). Every surface
(`client/`, `mobile/`, `website/`) should speak this vocabulary once
[07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) lands —
this file is the values; that file is the plumbing.

## 1. Contrast validation of the given brand values

WCAG 2.1 AA requires ≥4.5:1 for normal text, ≥3:1 for large text (≥18pt/24px, or ≥14pt/19px
bold) and for non-text "graphical object" contrast (icons, UI component boundaries, per SC
1.4.11). Ratios below are computed from the given hexes using the standard relative-luminance
formula; no hue or lightness in the brief has been changed — only *where* each color is allowed
to carry small text is constrained.

| Pairing | Ratio | Passes | Verdict |
|---|---|---|---|
| White text on primary teal `#0EA5A0` | 3.04:1 | Large text / icons / UI components only | **Restrict** — do not use for small body/button text |
| White text on deep teal `#00585B` | 8.25:1 | AAA, any size | **Safe for everything** — promoted to the role that carries small white text |
| White text on apricot `#FF9B54` | 2.08:1 | Fails even large-text | **Never use white on apricot** |
| Dark ink (`#071F24`) on apricot `#FF9B54` | 7.75:1 | AAA | **Required pairing for apricot** |
| White text on lilac `#A879F7` | 3.12:1 | Large text / icons only, barely | **Restrict**, same as primary teal |
| Dark ink (`#071F24`) on lilac `#A879F7` | 5.19:1 | AA, any size | **Required pairing for lilac** |
| `#39CFC0` (dark primary action) text/icon on dark bg `#071F24` | 8.83:1 | AAA | Safe as-is |
| Dark ink on `#39CFC0` fill (dark-mode CTA button) | 8.83:1 | AAA | **Use dark ink text on this fill, not white** |
| White text on `#39CFC0` fill | 1.93:1 | Fails | **Never use white on the dark primary action color** |
| Deep teal `#00585B` on dark bg `#071F24` (as a would-be dark-mode CTA) | 2.07:1 | Fails | Confirms why dark mode needs its own brighter action color instead of reusing deep teal |
| Light-mode ink `#071F24` on cream bg `#FFF9F0` | 16.31:1 | AAA | Safe |
| Light-mode muted `#4F6B6E` on cream bg `#FFF9F0` | 5.48:1 | AA | Safe |
| Dark-mode ink `#F5EFE4` on dark bg `#071F24` | ~15:1 | AAA | Safe |
| Dark-mode muted `#9FB8BA` on dark bg `#071F24` | 8.16:1 | AAA | Safe |

**Net adjustment:** zero hex values changed. Two usage rules added that the brief's flat list
didn't specify:
1. **Primary teal (`#0EA5A0`) and both accents (apricot, lilac) are "large-surface" colors** —
   safe for icon fills, selected-state indicators, progress bars, focus rings, and any fill
   ≥24px carrying no small text of its own. They are not safe as a small button's background
   with white label text.
2. **Apricot and lilac always pair with dark ink text/icons, never white**, in both light and
   dark mode, because the fills themselves don't change between themes (see §3) — this uses a
   new theme-invariant token, `inkOnAccent`.
3. **Dark-mode primary buttons use dark ink text on the `#39CFC0` fill**, not white — the
   opposite of the usual "light text in dark mode" instinct, and worth flagging explicitly in
   [03-component-specifications.md](03-component-specifications.md) so a future implementer
   doesn't flip it to white by habit.

## 2. Core semantic tokens — light and dark

| Role | Light | Dark | Notes |
|---|---|---|---|
| `bg` | `#FFF9F0` | `#071F24` | Page background. Replaces mobile's `paper`, client's `canvas`, website's `paper` — one name everywhere now. |
| `surface` | `#FFFFFF` | `#123237` | Card/content background. Replaces mobile's `white` (which was already a lie in dark mode). |
| `surfaceAlt` / `chip` | `#F3ECDD` | `#1B3F43` | Neutral fill for icon chips and quiet sections — between `bg` and `surface`, same purpose as today's `chip` token. |
| `border` | `#EAE2D3` | `#1C3A3E` | Replaces `line`. |
| `ink` | `#071F24` | `#F5EFE4` | Primary text. Each mode's `ink` is literally the other mode's `bg` — a deliberate reciprocal pairing (dark mode's text is a dimmed cream, not pure white, to avoid halation on a near-black ground). |
| `muted` | `#4F6B6E` | `#9FB8BA` | Secondary text, verified ≥4.5:1 against `bg` in both modes (§1). |

## 3. Brand and accent tokens — theme-invariant

Following the existing precedent of `HERO_GRADIENT`/`HERO_ACCENT` (`theme.tsx:91-93`, fixed
regardless of light/dark preference because a hero/brand moment is a brand treatment, not a
themed surface), the brand hues stay fixed across light and dark mode. The brief gave no
separate dark variants for primary teal or either accent — only for `bg`/`surface`/the primary
*action* color — which supports treating them as fixed.

| Role | Hex | Usage |
|---|---|---|
| `primary` | `#0EA5A0` | Icon tints, selected nav state, progress indicators, focus rings, brand marks — large-surface/graphical contexts only (§1) |
| `primaryStrong` | `#00585B` | The fill behind small white text: primary buttons, filled tags, light-mode CTAs |
| `primaryDark` (dark-mode CTA fill) | `#39CFC0` | Dark-mode primary buttons — pair with `inkOnAccent` text, never white (§1) |
| `accentApricot` | `#FF9B54` | Secondary accent — badges, highlights, non-primary emphasis. Pair with `inkOnAccent`. |
| `accentLilac` | `#A879F7` | Tertiary accent — reserved for rare, special moments (the AI-assistant module touchpoint, premium/admin surfaces). Pair with `inkOnAccent`. |
| `inkOnAccent` | `#071F24` | Fixed dark text/icon color used on top of `primary`, `accentApricot`, or `accentLilac` fills, in both themes. |

Reserve `accentApricot` and `accentLilac` for moments that should feel special, not everyday
chrome — the same "one bold accent, neutral everywhere else" discipline the mobile Login/Home
mockups already converged on this session, now generalized to two accents instead of one.
Routine UI (list rows, form fields, standard buttons) should read as `primary`/`primaryStrong`
plus neutrals; apricot and lilac appearing on every screen would flatten them back into "just
more colors" and defeat the point.

## 4. Status tokens

Mobile currently has only `danger`/`warning`/`success` (`theme.tsx:18-20`); client also has
`info`, `pending`, `draft` (audit `03` §1). Added here for parity, each verified ≥4.5:1 against
its own mode's `bg`:

| Role | Light | Dark |
|---|---|---|
| `danger` | `#D14343` | `#FF6B6B` |
| `warning` | `#C17A1F` | `#E2A33D` |
| `success` | `#1F8A5F` | `#4FD399` |
| `info` | `#2B6FB0` | `#6FB3E8` |
| `pending` | `#9B7C2E` | `#D9B45E` |
| `draft` | `#6B6358` | `#A39A8C` |

White text on these fills (e.g. a solid status badge) was spot-checked on `danger` (4.57:1,
passes at normal text size, lowest margin of the six) — treat all six status fills as safe for
white text at normal size, but if any individual badge design pushes toward a lighter tint of
these (common for a "soft" badge style), re-check that specific tint rather than assuming the
base hex's ratio carries over.

## 5. Module-accent map

Audit `03` §6 found the module-accent pattern (`theme.tsx:65-89`) exists only on mobile and
recommended (§10, "Preserve") carrying the *idea* forward while expecting the *values* not to
survive a rebrand untouched. Audit `05` §1 recommended promoting it to the shared token file
and seeding entries for the five catalog modules that exist as rows but have no UI yet
(`recruitment`, `performance`, `learning`, `financial_admin`, `ai_assistant` — audit `01` §1.2).

Each module gets a `{ bg, icon }` pair, same shape as today (`ModuleColorPair`,
`theme.tsx:59-62`) so existing component code (`IconTile`, `SectionIcon` in `HomeScreen.tsx`)
needs no structural change, only new values. Current `HomeScreen.tsx` usage
(`HomeScreen.tsx:208-217,231,295,308,332,357,362-364`) passes `.icon` as a **solid fill** with a
white glyph on top (not `.icon` as a tint color on a neutral tile) — that's the established
pattern to keep; `.bg` remains available for the softer tint treatment used elsewhere (e.g. the
leave-balance chips at `HomeScreen.tsx:362`, which tint `.icon` to 1F alpha rather than using
`.bg` directly — both conventions already coexist today and both carry forward unchanged).

New hues sit in a warmer, slightly higher-chroma family than the outgoing cooler pine-adjacent
set, chosen so a white 20–24px glyph stays legible on the `icon` fill (≥3:1 non-text contrast)
while keeping all 15 modules visually distinct from each other and from the three brand accents.
`ai_assistant` is the one deliberate exception: its `icon` value is a module-calibrated,
slightly deepened variant of the brand's `accentLilac`, echoing the AI module as a "special
moment" the way the brand accent itself is reserved for special moments elsewhere.

| Module | `bg` | `icon` |
|---|---|---|
| leave | `#FBEBD4` | `#B8792B` |
| attendance | `#DCEEF7` | `#2E7FB0` |
| tickets | `#FBE2DC` | `#C1503D` |
| directory | `#EBE4F9` | `#7A5BC1` |
| calendar | `#DCF2E7` | `#2F8F6B` |
| assets | `#E2E5FB` | `#4A5FC9` |
| documents | `#F1E7D7` | `#8C6A3F` |
| payslips | `#DFF3E1` | `#3C9A4F` |
| profile | `#FBE1EC` | `#C1507E` |
| lifestyle | `#FCE5EB` | `#D1567A` |
| recruitment *(future)* | `#FBE7D4` | `#C1621E` |
| performance *(future)* | `#D9F2EE` | `#1F8A78` |
| learning *(future)* | `#DEE6F5` | `#3A5FA0` |
| financial_admin *(future)* | `#F2E9D2` | `#96762A` |
| ai_assistant *(future)* | `#EDE4FB` | `#8B5FD9` |

These are the same values for light and dark mode — like the brand accents, module colors are
treated as theme-invariant brand identifiers rather than themed surfaces, which is also closest
to current behavior (`lightModuleColors`/`darkModuleColors` today already differ mostly by
*lightening* the same hue family for dark backgrounds rather than changing hue; if on-device
testing in [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md)'s
Phase 1 checkpoint finds any of these 15 fills too dim against the dark `bg`/`surface` pair,
derive a dark variant by lifting lightness only, never changing hue — but start with one shared
set and only fork if testing proves it necessary, to avoid doubling the token surface before
there's evidence it's needed).

## 6. What changed from today's mobile tokens, at a glance

| Old (`theme.tsx`) | New | Change |
|---|---|---|
| `pine` | `primary` | Same role, new hue (pine-green → teal) |
| `pineDark`/`pineLight` | `primaryStrong` / `primaryDark` (dark-mode CTA) | Split into two distinct, contrast-motivated roles instead of a light/dark variant pair of the same hue |
| `ink` | `ink` | Same role, new value, now reciprocal with `bg` |
| `muted` | `muted` | Same role, new value |
| `paper` | `bg` | Renamed for cross-surface consistency |
| `white` | `surface` | Renamed — fixes the dark-mode naming lie |
| `chip` | `surfaceAlt`/`chip` | Same role, new value |
| `lime`/`limeDeep` | `accentApricot`/`accentLilac` | The old single "pop" accent becomes two reserved accents; no botanical association (an explicit brand constraint) |
| `danger`/`warning`/`success` | Same names, new values + `info`/`pending`/`draft` added | Parity with client, which already has all six |
| `HERO_GRADIENT`/`HERO_ACCENT` | Redefined per [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md) | Still theme-invariant brand constants, new values |
| `lightModuleColors`/`darkModuleColors` | Single `moduleColors` map, §5 | Values replaced, 5 new entries added, structure unchanged |
