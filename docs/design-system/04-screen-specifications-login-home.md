# 04 — Login and Home screen layouts

**Revision note (this version supersedes the original draft):** the first draft of this file
re-colored the existing gradient-hero/floating-card layout rather than questioning whether that
structure should survive at all. On review, it was corrected: the approved direction (Concept
B — Warm & Human) is a **calmer, flatter, more compact** layout, not a re-skinned version of
the outgoing dramatic hero treatment. The sections below replace the original Login and Home
tables entirely. **No reference image was attached to the review instruction that requested
this correction** — the layout below is built from that instruction's written description
(predominantly warm cream background; compact, centered branding and welcome message; clean
integrated form fields; rounded buttons; subtle abstract geometric accents; no oversized
gradient hero or floating card; no botanical imagery; a coordinated dark mode using deep teal
surfaces). If the actual reference image shows something materially different from what's
described below, flag it before implementation — this file should be checked against the image
directly, not just against its written description.

## Login

The screen is a single continuous page background (`bg`) from top to bottom — there is no
separate hero block, no full-bleed gradient fill, and no elevated card floating over a hero
boundary. Content is centered, not left-aligned.

| Element | Treatment |
|---|---|
| Page background | `bg` (`#FFF9F0` light / `#071F24` dark), full screen, no gradient |
| Top safe area | `useSafeAreaInsets().top` + `spacing.lg`, no hardcoded constant (closes the gap audit `02`/`05` flagged at `LoginScreen.tsx:215`) |
| Brand mark + wordmark | Compact — logo ~32–36px, wordmark at `label` scale, **horizontally centered**, stacked or side-by-side, modest top margin (`spacing.xl`) rather than a large hero block |
| Welcome message | "Welcome back" at `title` scale (Manrope 700, 22/28), **centered**, followed by a short `caption`-scale subtitle in `muted`, also centered — replaces the old 42px left-aligned `display`-scale hero title |
| Decorative accent | One or two thin-stroke, low-opacity outlined circles (`GeometricAccent`, see [03](03-component-specifications.md)) in `primary`/`accentApricot` at 10–15% opacity (light) / 14–18% (dark), anchored off the top-right and bottom-left corners, `pointerEvents="none"`, sitting behind all content — **not** a full gradient fill, grid pattern, radial glow, or sparkle scatter |
| Form fields | Sit directly on the page background — no wrapping `Card`/panel. Each field: `surfaceAlt`/`chip` fill, `border` outline, `radius.lg` (16, up from today's `radius.md`, for the rounder "clean, integrated" feel the brief asks for) |
| Primary button ("Sign in") | `primaryStrong` fill (light) / `primaryDark` fill with `inkOnAccent` text (dark), `radius.lg`, full-width — same rounding as the fields, not a separate pill shape, so the form reads as one coherent rounded-corner language |
| Biometric sign-in button | Same button role as the primary button (`primaryStrong`/`primaryDark`) — no longer given its own accent color. With no hero to "pop" against, two differently-accented primary actions on one calm screen would read as inconsistent rather than deliberate; the screen's one reserved accent now lives only in the decorative geometric shapes |
| Biometric icon circle | `chip`/`surfaceAlt` fill, `primary` icon tint — a quiet icon chip, not an accent-colored showpiece |
| "Forgot password?" link | `primaryStrong` text (light) / `primaryDark` text (dark) — **not** `primary` (`#0EA5A0`). Checked against the page background directly (not as a fill): `primary` teal as small text on cream is 2.91:1 and fails even the large-text threshold; `primaryStrong` on cream is 7.88:1. See the added row in [01-color-tokens.md](01-color-tokens.md) §1. This corrects the original draft, which had specified `primary` for this exact link. |
| Error text | `danger`, unchanged role and placement |
| Dark mode | `bg` → `#071F24`, fields → dark `chip` (`#1B3F43`) on dark `border` — these are literally the "deep teal surfaces" the brief asks for, already defined in [01](01-color-tokens.md) §2, not a new set of values. Same centered, compact, accent-restrained structure as light mode. |

What this removes, explicitly: the `LinearGradient` hero fill, the SVG grid pattern, the
`RadialGradient` glow, the scattered `Sparkle` field, and the elevated white card with its
heavy drop shadow (`LoginScreen.tsx:27-55,222-236`) are all retired for this screen. The
`Sparkle` component itself is not deleted from the codebase (see [03](03-component-specifications.md))
but Login no longer uses it.

## Home

**Preserve all existing functionality and content exactly as-is** — the greeting, avatar,
header icon actions, quick-access tiles, and every conditional info card (pending actions,
stats row, role, attendance, document compliance, handover, leave balances, next holiday) stay.
Nothing is added or removed. Only the visual treatment of the header region and the cards'
immediate surroundings changes, per the instruction not to assume the gradient-heavy layout
must be kept.

| Element | Before | After |
|---|---|---|
| Header region | Full-bleed `LinearGradient` block (`['#0EA5A0','#00585B']` in the superseded draft) with SVG grid, radial glow, and scattered sparkles behind the greeting | Sits directly on the page `bg` — no gradient fill. One restrained `GeometricAccent` shape (a single large, low-opacity outlined circle in `primary` or `accentApricot`) positioned behind the avatar/greeting area, reusing the same decorative mechanism as Login rather than inventing a second one |
| Greeting icon + "Good morning," | `rgba(255,255,255,0.7)` (white-on-gradient) | `muted` — now dark-on-light text, since the background is no longer a dark gradient |
| Greeting name (large text) | White, `display` scale | `ink`, `display` scale (Manrope) — same scale and weight, new color because the ground changed |
| Header icon buttons (theme toggle, directory, notifications) | Translucent white circles (`rgba(255,255,255,0.14)`) — only legible against a dark gradient | `chip`/`surfaceAlt` fill, `ink` icon color — a light neutral chip button appropriate to a light page background |
| Notification badge | `danger` fill | Unchanged role, new value from [01](01-color-tokens.md) §4 |
| Avatar ring | Heavy `accentApricot` border, sized for contrast against a dark gradient | A thinner `border`-weight ring, optionally tinted `primary` at low weight — toned down to match the calmer screen rather than needing to fight a busy background for attention |
| Quick-access card | "Floating" over the hero/body boundary with a negative top margin, `radius.xl`, `shadow.soft` | Sits naturally in the page flow — same `surface`/`xl`/`shadow.soft` values (unchanged from today's actual implementation, since this part was never the problem the correction raised), just no longer needs a negative margin to bridge a hero drop that no longer exists |
| Quick-access tile fills | Solid module `.icon` color + white glyph | Unchanged — each tile is its own small colored surface; this was never part of the "oversized hero" critique |
| "Next holiday" card | `accentApricot` fill + `inkOnAccent` icon | Unchanged — correctly scoped use of the one reserved accent, already consistent with "subtle... used sparingly" |
| Decorative watermark circle (`HomeScreen.tsx:402-411`) | `colors.pine` at 2.5% opacity | Folded into the single `GeometricAccent` treatment above rather than kept as a second, separate decorative layer — one restrained accent shape per screen region, not two |
| Dark mode | Gradient header in dark-mode-tinted teals | `bg`/`surface` → dark values (`#071F24`/`#123237`), same light-on-dark ink/muted/chip mapping as every other dark-mode card on this screen |

## What changed from the original draft, at a glance

| Aspect | Original draft | This revision |
|---|---|---|
| Hero mechanism | Full gradient + grid + glow + sparkles on both screens | Retired on both screens; one restrained geometric accent shape each |
| Login layout | Hero block + separately elevated floating card | Single continuous background, centered content, no card wrapper |
| Login button accenting | Primary button `primaryStrong`, biometric button `accentApricot` | Both buttons use the same `primaryStrong`/`primaryDark` role — no second accent on this screen |
| Login link color | `primary` (unverified against the bg-as-background use case) | `primaryStrong` — corrected after checking contrast of teal *text on* cream, not just teal *fills with* text on them |
| Home header | Dark gradient block with white text/icons | Sits on page `bg`, dark text/icons on light chips |
| Radius for form fields | `radius.md` (unchanged from today) | `radius.lg`, for the rounder "clean, integrated" feel |

## What this file still does not do

- It does not resolve whether the specific geometric-accent shapes described above match the
  actual approved reference image, since that image was not available when writing this
  revision — confirm before implementation.
- It does not touch any of the other 27 mobile screens, per
  [09-scope-boundaries.md](09-scope-boundaries.md) and the phased plan in
  [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md).
