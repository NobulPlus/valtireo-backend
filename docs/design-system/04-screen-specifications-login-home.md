# 04 — Login and Home screen layouts

**Revision 2 (this version supersedes Revision 1):** Revision 1 was written without a reference
image, from a written description only, and flagged several of its own guesses as needing
confirmation. An approved reference image has now been reviewed (Login, light and dark mode)
and this file is corrected against it. Differences found, and how each was resolved:

| What the image shows | What Revision 1 had | Resolution |
|---|---|---|
| Primary "Sign in" button is a two-stop **teal gradient**, not a flat fill | Flat `primaryStrong`/`primaryDark` fill, no gradient | Gradient restored for this one button only — see §Primary button below. The page background itself still has no gradient; "subtle gradients" lives on the CTA, not a hero. |
| Decorative shapes are **solid, soft-edged blobs** bleeding off corners | Thin-stroke (1.5px) outlined rings at 10–18% opacity | `GeometricAccent` redefined as filled blobs — see [03](03-component-specifications.md) and §Decorative accents below |
| Fields and buttons are **fully rounded pills**, not rounded rectangles | `radius.lg` (16) | Both now use `radius.pill` |
| Fields have **leading icons** (envelope, lock) and the password field has a **trailing show/hide toggle** | No icon slots specified | Added to [03](03-component-specifications.md)'s `Input` spec, toggle wired to actually control `secureTextEntry` (functional, not decorative) |
| A tagline ("People · Work · Progress") and a reworded subtitle appear | Original subtitle copy kept | Adopted as shown — **flagged as new copy to confirm**, not verified as approved marketing text beyond appearing in this mockup |
| A "Keep me signed in" checkbox appears | Not mentioned | **Deliberately not implemented this round** — see §Deferred below |
| Dark-mode button text reads as white in the mockup | — | **Corrected to dark text** — white fails contrast on part of this exact gradient (§Primary button); the instruction that commissioned this review explicitly said the image is "not permission to introduce inaccessible color combinations" |

## Login

Single continuous page background (`bg`), no hero block, no gradient fill on the page itself,
no floating/elevated card. Content is centered, not left-aligned.

| Element | Treatment |
|---|---|
| Page background | `bg` (`#FFF9F0` light / `#071F24` dark), full screen, flat |
| Top safe area | `useSafeAreaInsets().top` + `spacing.lg`, no hardcoded constant (closes the gap at `LoginScreen.tsx:215`) |
| Logo mark + wordmark | Existing brand mark (`assets/brand-mark.png`), centered, ~40–44px, with "Valtireo" wordmark beside or below it at `heading` scale (Manrope 700). **Confirm whether the current asset already matches the two-tone mark shown in the reference image, or whether an updated asset is needed** — this spec can't resolve that without seeing the current file. |
| Tagline | "People · Work · Progress", centered, `caption` scale, `muted` — **new copy, not in the current app; confirm before treating as final** |
| Welcome message | "Welcome back" at `title` scale (Manrope 700, 22/28), centered |
| Subtitle | "Sign in to your organization and keep things moving." — **new copy, replaces today's "Use the email and password your organization gave you."**; `body` scale, `muted`, centered |
| Form fields | `surface` fill, `border` outline, `radius.pill` (full stadium shape, matching the image — up from Revision 1's `radius.lg`), each with a leading icon (envelope for email, lock for password) in `muted`; password field adds a trailing eye/eye-off icon that **actually toggles** `secureTextEntry` (a real, functioning control, not decoration — see [03](03-component-specifications.md)'s `Input`) |
| Primary button ("Sign in") | **Gradient fill**, `radius.pill`, full-width. Light mode: `['#00585B', '#0EA5A0']` (`primaryStrong` → `primary`), white label text. Dark mode: `['#0EA5A0', '#39CFC0']` (`primary` → `primaryDark`), **`inkOnAccent` (dark) label text, not white** — see the contrast note below. Label uses the new `ctaLabel` type style ([02](02-typography-spacing-elevation-iconography.md)), not the generic `label` scale. |
| Biometric sign-in button | Outlined, not filled — `surface`/transparent fill, `border`-weight outline, `primaryStrong` (light) / `primaryDark` (dark) icon and text, `radius.pill` — the one supporting action, visually secondary to the gradient primary button |
| "or" divider | Centered `caption`-scale text in `muted`, no rule lines |
| "Forgot password?" link | `primaryStrong` text (light) / `primaryDark` text (dark), right-aligned on its own row below the fields — unchanged from Revision 1's correction (`primary` fails contrast as small text directly on `bg`, see [01](01-color-tokens.md) §1) |
| "Keep me signed in" checkbox | **Not implemented this round** — see §Deferred |
| Error text | `danger`, unchanged role and placement |
| Decorative accents | Solid, soft-edged `GeometricAccent` blobs (see [03](03-component-specifications.md)), corner-anchored, bleeding off-canvas, `pointerEvents="none"`, behind all content. **Light mode:** apricot-toned blobs — a large one top-left (partially off-canvas), a large one bottom-right (partially off-canvas), a small fully-visible one bottom-left. **Dark mode:** the two large corner blobs switch to teal-toned (`primary`/`primaryDark`-derived), while the small bottom-left blob stays apricot — the one warm "spark" surviving into the dark palette. See §Decorative accents below for opacity values. |
| Dark mode (general) | `bg` → `#071F24`, fields → `surface` (`#123237`) on dark `border` — these are the "deep teal surfaces" the brief asked for, already defined in [01](01-color-tokens.md) §2 |

### Primary button — gradient and text-color reasoning

The reference image's button is a genuine two-stop gradient, not a flat color, so this spec now
defines a `ctaGradient` brand token ([07](07-cross-platform-token-architecture.md)) using
**only already-approved hexes** — no new colors introduced:
- Light: `primaryStrong` (`#00585B`, dark end) → `primary` (`#0EA5A0`, light end).
- Dark: `primary` (`#0EA5A0`, dark end) → `primaryDark` (`#39CFC0`, light end).

Both gradients contain `primary` (`#0EA5A0`) as one stop, which is already documented
([01](01-color-tokens.md) §1) as safe for white text only at large-text size (3.04:1, clears
the 3:1 threshold but not 4.5:1). That's why the button's label uses a dedicated `ctaLabel`
style (19px/24, Inter 700 — [02](02-typography-spacing-elevation-iconography.md)) instead of the
generic 13px `label` scale: at 19px bold it qualifies as WCAG "large text" (the bold threshold is
≈18.7px), so the 3.04:1 ratio is genuinely compliant there, not a near-miss.

The dark-mode gradient is the one place this spec **deviates from how the reference image
appears to render it**. Its light end, `primaryDark` (`#39CFC0`), is only 1.93:1 with white text
— failing outright, not borderline, at any text size. Checked the other way, `inkOnAccent`
(`#071F24`) on that same fill is 8.83:1, and on the gradient's other end (`primary`) is 5.61:1 —
safe across the entire gradient at any size. **Dark-mode CTA label color is therefore
`inkOnAccent`, not white**, regardless of how light the mockup's button text looks. This is a
direct application of the instruction that commissioned this review: the image is a visual
reference, not permission to ship an inaccessible combination it happens to depict.

### Decorative accents — opacity and placement

Unlike Revision 1's whisper-thin outlined rings, the reference shows clearly perceptible solid
shapes:
- Large corner blobs: ~20–30% opacity (light, apricot) / ~15–25% opacity (dark, teal — a
  saturated teal reads clearly even at lower opacity against the near-black `bg`).
- The small bottom-left accent (apricot, both modes): much higher opacity, ~70–90% — it reads as
  a deliberate small dot of full color, not a translucent wash.

All three shapes are `pointerEvents="none"`, positioned behind all interactive content, and
contained within a single `GeometricAccent`-rendering wrapper per screen (not three separate ad
hoc `View`s) so the pattern is reusable for Home.

## Deferred: "Keep me signed in" checkbox

The reference image shows this control in both modes, but it isn't mentioned in the written
visual-direction bullets, and implementing it for real means changing **session-persistence
behavior** (how long a credential/token is remembered) — a functional/auth change, not a visual
one. [09-scope-boundaries.md](09-scope-boundaries.md) draws exactly this line: visual-only
changes are in scope for this spec, behavior changes are not. The instruction that commissioned
this review also explicitly warned against adding "nonfunctional controls simply because they
appear in the reference image" — building it as a fake, non-wired checkbox would violate that
directly, and wiring it to real session-duration logic is a product/security decision this spec
isn't positioned to make unilaterally. **This round's Login implementation omits the checkbox
entirely** (the "Forgot password?" link simply stands alone, right-aligned); flagging this as an
open item for an explicit decision before any future round adds it.

## Home

Unchanged from Revision 1 — preserve all existing functionality, content, and conditional
sections exactly as-is; only the header region's visual treatment changes (no gradient fill, a
single restrained `GeometricAccent` shape instead, dark-on-light text/icons since the ground is
no longer a dark gradient). The reference image reviewed in Revision 2 covers Login only; Home's
table from Revision 1 stands until a Home-specific reference is available, with one mechanical
update: wherever Revision 1 referred to the old thin-ring `GeometricAccent`, substitute the
redefined solid-blob version from §Decorative accents above and [03](03-component-specifications.md)
— same single-shape-per-region principle, new rendering mechanism.

| Element | Before | After |
|---|---|---|
| Header region | Full-bleed gradient + grid + glow + sparkles | Sits on page `bg`; one solid, low-opacity `GeometricAccent` blob behind the avatar/greeting area |
| Greeting icon + "Good morning," | White-on-gradient | `muted` |
| Greeting name | White, `display` scale | `ink`, `display` scale (Manrope) |
| Header icon buttons | Translucent white circles | `chip`/`surfaceAlt` fill, `ink` icon color |
| Notification badge | `danger` fill | Unchanged role, new value |
| Avatar ring | Heavy `accentApricot` border | Thinner `border`-weight ring, optionally `primary`-tinted |
| Quick-access card | Floating, negative top margin | Sits naturally in page flow, same `surface`/`xl`/`shadow.soft` |
| Quick-access tile fills, "Next holiday" card, every other info card | Unchanged | Unchanged |
| Dark mode | Gradient header | `bg`/`surface` → dark values, same ink/muted/chip mapping as every other dark-mode card |

## What this file still does not do

- It does not implement Home — per the instruction that commissioned this revision, Home is
  explicitly deferred until Login is implemented and approved.
- It does not resolve the brand-mark-asset and new-copy questions flagged above — both need a
  direct answer, not an assumption, before final sign-off.
- It does not touch any of the other 27 mobile screens, per
  [09-scope-boundaries.md](09-scope-boundaries.md).
