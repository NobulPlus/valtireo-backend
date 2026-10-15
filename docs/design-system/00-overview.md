# Valtireo Design System v2 — "Warm & Human"

Status: **Specification for review. Not approved for implementation.**
Date: 2026-10-15 (revised 2026-10-15, see Revision history below)

## Revision history

**Revision 1 — corrected Login/Home layout and migration sequencing.** The original draft
re-colored the existing full-bleed gradient-hero/floating-card mobile layout rather than
questioning the structure itself, and had a sequencing conflict between
[07](07-cross-platform-token-architecture.md) and
[08](08-migration-plan-and-regression-checkpoints.md) (one global token file can't hold "the new
values" in one phase and "the original palette" in a later phase at the same time). Both were
corrected:
- [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md) is rewritten:
  no gradient hero, no floating card, compact/centered layout, subtle geometric accents instead
  of grid/glow/sparkle, rounder form fields and buttons, a dark mode built from the existing
  deep-teal surface tokens. **No reference image was available when making this correction** —
  it's built from a detailed written description; check it against the actual approved image
  before implementation.
- [07](07-cross-platform-token-architecture.md) and
  [08](08-migration-plan-and-regression-checkpoints.md) are rewritten around a dual-palette
  (`legacy`/`v2`) token file with a per-screen rollout flag, so component consolidation happens
  under the existing design first, the new identity rolls out screen-by-screen under a
  controlled flag, the global default flips exactly once (never back and forth), and web/website
  migrations are explicitly gated on mobile being stable first.
- [01](01-color-tokens.md), [02](02-typography-spacing-elevation-iconography.md),
  [03](03-component-specifications.md), [05](05-organization-branding-compatibility.md), and
  [06](06-accessibility-and-responsive-requirements.md) each received smaller cross-reference
  fixes where they referenced the retired hero/floating-card mechanism, plus one new
  accessibility finding ([01](01-color-tokens.md) §1: `primary` teal fails contrast as small
  text directly on the light background, distinct from its already-documented restriction as a
  fill — `primaryStrong` is the correct choice there).

**Revision 2 — validated against the approved reference image, mobile Login implementation
begun.** A reference image (Login, light + dark) was reviewed directly against Revision 1 and
several differences were found and corrected: the primary button is a two-stop teal gradient,
not a flat fill (with a dark-mode text-color correction — white fails contrast on part of that
exact gradient, 1.93:1, so dark-mode uses `inkOnAccent` text instead, regardless of how the
mockup appears to render it); decorative accents are solid soft-edged blobs, not thin outlined
rings; fields and buttons are fully rounded pills, not `radius.lg` rectangles; fields gained
leading icons and a functional (not decorative) password show/hide toggle. A "Keep me signed in"
checkbox visible in the image was deliberately **not** implemented — it implies a
session-persistence behavior change, which is out of this spec's scope
([09](09-scope-boundaries.md)), not a visual one. Full detail in
[04](04-screen-specifications-login-home.md)'s revision table, [01](01-color-tokens.md) §1's new
gradient-contrast rows, [02](02-typography-spacing-elevation-iconography.md)'s new `ctaLabel`
style, and [03](03-component-specifications.md)'s `Button`/`Input`/`GeometricAccent` updates.
Mobile implementation of Login (only) has begun on a dedicated branch per
[08](08-migration-plan-and-regression-checkpoints.md)'s Phase 2 note — Home and the other 27
screens remain untouched and unapproved for implementation.

This directory is a planning document, not code. Nothing in `client/`, `mobile/`, `website/`,
or `server/` has been changed to produce it, and nothing should be changed on the strength
of it alone — per the brief that commissioned it: *"Do not modify application UI code, change
existing themes, or start the migration yet. Present the specification for review and approval
first."* Each file below ends where implementation would begin.

## What this is

A cross-platform visual identity and component specification covering `client/` (React/Vite),
`mobile/` (Expo/React Native), and `website/` (Astro) — written directly against the current
codebase and the six prior audit reports (`docs/audits/01` through `06`), not against an
abstract brief. Where a decision in this spec contradicts or supersedes something those audits
found, that is called out explicitly rather than silently assumed.

## Brand direction, as given

| Token | Hex | Role |
|---|---|---|
| Primary teal | `#0EA5A0` | Brand identity — icons, large surfaces, selected states |
| Deep teal | `#00585B` | The teal used wherever small text sits on a solid fill |
| Warm cream background | `#FFF9F0` | Light-mode page background |
| Apricot accent | `#FF9B54` | Secondary accent, used sparingly |
| Lilac accent | `#A879F7` | Tertiary accent, used sparingly |
| Dark background | `#071F24` | Dark-mode page background |
| Dark surface | `#123237` | Dark-mode card surface |
| Dark primary action | `#39CFC0` | Dark-mode primary button/CTA fill |

Typography: **Inter** for interface text, **Manrope** for expressive headings. Modern geometric
shapes, subtle gradients. No botanical, agricultural, or leaf illustration — a deliberate break
from the outgoing pine-green/lime identity, which several screens (mobile's hero gradient,
`HERO_ACCENT`) and the marketing site lean on today.

These are starting values. [01-color-tokens.md](01-color-tokens.md) runs them through WCAG
contrast checks and documents exactly where a value is used as given versus where a *usage
rule* (not a value change) is needed to keep it accessible — see that file's contrast ledger.
No hex value in the brief has been altered; two of them (`#0EA5A0`, `#FF9B54`/`#A879F7`) turn
out to need a specific pairing rule to pass WCAG AA, which is documented rather than worked
around by darkening the user's chosen colors.

## Why "Warm & Human" is a bigger change than a palette swap

Audit `03` (current design system audit) found the existing three surfaces already disagree
with each other on nearly every token except the single hex `#123f3a` — three different page
background values, two independently-built dark-mode engines, a module-accent pattern that
exists only on mobile, and zero shared font family. Audit `05` (redesign readiness) concluded
unification is not architecturally hard, but nobody has ever written the single source of
truth. This spec is that source of truth: it defines the roles and values once, and
[07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) defines how
all three surfaces generate from it instead of hand-copying hex values and drifting, which is
exactly how today's inconsistencies happened.

It is also a chance to fix three naming/structural smells audit `03` flagged in passing, folded
into this rewrite rather than carried forward:
- Mobile's `white` color role is literally a dark color in dark mode (`#16302b`) — renamed to
  `surface` throughout this spec, since that is what the role actually means.
- Three different names for "page background" (`paper`, `canvas`, `paper` again, three
  different hex values) — standardized on `bg` for page background and `surface` for card
  background everywhere.
- Mobile has no `info`/`pending`/`draft` status roles that client already has — added for parity
  (§ [01-color-tokens.md](01-color-tokens.md)).

## How to read this spec

| File | Covers |
|---|---|
| [01-color-tokens.md](01-color-tokens.md) | Light/dark semantic tokens, contrast validation, module-accent map (10 existing + 5 future modules) |
| [02-typography-spacing-elevation-iconography.md](02-typography-spacing-elevation-iconography.md) | Type scale, font loading, spacing/radius/elevation scales, icon/illustration rules |
| [03-component-specifications.md](03-component-specifications.md) | Reusable React Native component specs (Button, Card, IconTile, Avatar, Input, etc.) |
| [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md) | Login and Home layouts — compact, centered, no gradient hero or floating card (revised) |
| [05-organization-branding-compatibility.md](05-organization-branding-compatibility.md) | How per-tenant branding (client's working pipeline, mobile's dead fields) coexists with a global redesign |
| [06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md) | Contrast, touch targets, safe areas, text scaling, reduced motion |
| [07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) | The source-of-truth token file (dual `legacy`/`v2` palettes), generated outputs for React, React Native, Astro, and the per-screen rollout flag (revised) |
| [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md) | Phased rollout — consolidate under the existing design first, then a controlled per-screen flag rollout, one global cutover, web/website gated on mobile stability (revised) |
| [09-scope-boundaries.md](09-scope-boundaries.md) | What this redesign is not — explicit lines against manager/HR/admin feature work |

## Grounding

Read in full for this spec: `docs/audits/01-system-architecture-and-feature-inventory.md`,
`02-mobile-employee-experience-audit.md`, `03-current-design-system-audit.md`,
`05-redesign-readiness-and-migration-plan.md`; `mobile/src/theme.tsx`,
`mobile/src/components/{IconTile,Avatar,Sparkle,ErrorBoundary}.tsx`,
`mobile/src/screens/{LoginScreen,HomeScreen}.tsx` in full. Client's `index.css` token block and
`WorkspaceThemeBridge.tsx`/`WorkspaceSettingsService.php` branding pipeline are referenced via
audit `03`'s line-cited findings rather than re-read in full here, since `03` already quotes the
exact values needed.
