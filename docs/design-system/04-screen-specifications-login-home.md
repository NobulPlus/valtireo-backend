# 04 — Login and Home screen layouts

Scope and caveat: the brief names "the refined Concept B mobile mockups" as the approved visual
reference. No artifact matching that label exists in this session's design-exploration canvas
(`https://claude.ai/artifact/P82DF1UzahpFeAmGxjvb3c`) under that name, and the given palette is
a complete departure from the pine/lime direction explored there — this decision appears to
have been finalized through a process outside this conversation. What follows is therefore
written from (a) the given brand values and stylistic constraints, (b) the existing,
already-working layout structure and interaction patterns in `LoginScreen.tsx`/`HomeScreen.tsx`
(hero gradient header, floating bordered card, icon-chip grid, the "one bold accent, neutral
everywhere else" discipline those screens already settled on this session), and (c) the
explicit instruction not to touch code yet. **Treat this file's layout description as a spec to
confirm against the actual Concept B reference before implementation, not as a transcription of
it** — flag any mismatch during the review this document is submitted for.

## Login

Structural layout is unchanged from today (`LoginScreen.tsx`) — a gradient hero behind the top
portion of the screen, brand mark + "Welcome back" title, scroll content pinned to the bottom,
a white card with the form floating over the hero/content boundary. Only the surface treatment
and colors change:

| Element | Today | New |
|---|---|---|
| Hero gradient | `HERO_GRADIENT = ['#123F3A', '#0E332E']` (deep pine) | `['#0EA5A0', '#00585B']` (primary teal → deep teal) — a gradient *within* the brand family rather than two unrelated hues, giving the "subtle gradient" look the brief asks for without introducing a third color |
| Hero accent (glow + accent sparkles) | `HERO_ACCENT = '#D7F86B'` (lime) | `accentApricot` (`#FF9B54`) — the one bold accent against the teal gradient, replacing lime 1:1 in the same role |
| Non-accent sparkles | `#FFFFFF` at low opacity | `#FFF9F0` (cream) at low opacity — slightly warmer than pure white, consistent with the warm-cream brand identity even in small decorative details |
| Card background | `colors.white` | `surface` (`#FFFFFF`) — unchanged value, renamed role |
| Card radius | `26` (one-off value) | `xxl` (`28`, now a named token — [02](02-typography-spacing-elevation-iconography.md) §3) |
| Primary button ("Sign in") | `colors.pine` fill, white text | `primaryStrong` fill, `surface` text — passes contrast at any text size (§1 of [01](01-color-tokens.md)) |
| Biometric button | `HERO_ACCENT` fill, `#0A2420` text (`LoginScreen.tsx:270,280`) | `accentApricot` fill, `inkOnAccent` text — same role (the one accent-colored button on this screen), new values, and now using the documented required pairing instead of an ad hoc dark literal |
| Biometric icon circle | `colors.lime` fill (`LoginScreen.tsx:265`) | `accentApricot` fill, icon color `inkOnAccent` |
| Forgot-password link | `colors.pine` text | `primary` text (large/graphic-adjacent context — a text link at `label` size (13px) is borderline for the 3:1-only `primary` teal; verify this specific pairing during implementation, or use `primaryStrong` if the 13px link text fails AA in practice) |
| Hero title "Welcome back" | `#FFFFFF`, Inter weight-800 | `#FFFFFF` (full white is fine here — it's 42px/`display`-scale large text against the teal gradient, well within the 3:1 large-text threshold even at the gradient's lighter end), Manrope weight-800 per [02](02-typography-spacing-elevation-iconography.md) §1 |

Everything else — the biometric/password-form toggle logic, field layout, error text placement,
`KeyboardAvoidingView` behavior — is unchanged; this is a visual re-skin of an already-sound
screen, not a restructure.

## Home

Same principle: today's structure (gradient hero header with greeting + avatar + icon actions,
a floating "Quick access" card overlapping the hero/body boundary, a stack of flat bordered
info cards below) stays. Colors and a few literal values change:

| Element | Today | New |
|---|---|---|
| Hero gradient | `HERO_GRADIENT` (pine) | `['#0EA5A0', '#00585B']`, same as Login — one consistent brand gradient across both hero moments rather than two different ones |
| Hero glow/accent sparkles | `HERO_ACCENT` (lime) | `accentApricot` |
| Greeting icon + text | `rgba(255,255,255,0.7/0.75)` | Unchanged literal opacities — still white-on-gradient, same large-text-safe context as Login's title |
| Greeting name (large display text) | `#FFFFFF`, Inter 800 | `#FFFFFF`, Manrope 800 |
| Header icon buttons (theme toggle, directory, notifications) | `rgba(255,255,255,0.14)` fill circles | Unchanged — these are translucent-on-gradient, not flat token fills, and that treatment still reads correctly against the new teal gradient |
| Notification badge | `colors.danger` | New `danger` value (`#D14343`/`#FF6B6B`) |
| Avatar ring | `colors.lime` border | `accentApricot` border — the avatar is the one "special" element in the header, matching Login's biometric-circle accent use |
| Quick-access card | `colors.white`, radius `xl` (22), `shadow.soft` | `surface`, radius `xxl` (28), `shadow.soft` — promoted to the same hero-level radius as Login's card, since both are the "floating card over the gradient boundary" pattern and should match |
| Quick-access tile fills | `moduleColors[key].icon` solid fill + white glyph | Same mechanism, new module values from [01](01-color-tokens.md) §5 |
| "Next holiday" card icon | `colors.lime` fill, `colors.pineDark` icon (`HomeScreen.tsx:374`) | `accentApricot` fill, `inkOnAccent` icon — same "this one card gets the accent treatment" idea, correct pairing per §1 |
| Watermark circle (decorative, `HomeScreen.tsx:402-411`) | `colors.pine` at 2.5% opacity | `primary` at the same opacity — a near-invisible texture detail, kept as-is structurally |
| All other info cards (pending actions, role, attendance, documents, leave balances, handover) | `colors.white`/`border: colors.line`, module-colored `SectionIcon` fills | `surface`/`border: border`, same module-colored icon mechanism with new values |

No new sections, cards, or data are introduced — this file specifies the re-skin of the
existing Home dashboard only, per the scope boundary in
[09-scope-boundaries.md](09-scope-boundaries.md).

## What this file deliberately does not do

- It does not touch any of the other 27 mobile screens — per
  [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md),
  those stay on the current look until Phase 2's consolidation step, exactly as audit `05` §2/§3
  recommended to avoid a half-migrated, inconsistent app mid-rollout.
- It does not resolve the "Concept B" ambiguity noted above — that needs a direct side-by-side
  check against whatever reference the user has, before any of this is implemented.
