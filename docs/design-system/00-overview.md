# Valtireo Design System v2 — "Warm & Human"

Status: **Specification for review. Not approved for implementation.**
Date: 2026-10-15

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
| [04-screen-specifications-login-home.md](04-screen-specifications-login-home.md) | Login and Home layouts in the new identity |
| [05-organization-branding-compatibility.md](05-organization-branding-compatibility.md) | How per-tenant branding (client's working pipeline, mobile's dead fields) coexists with a global redesign |
| [06-accessibility-and-responsive-requirements.md](06-accessibility-and-responsive-requirements.md) | Contrast, touch targets, safe areas, text scaling, reduced motion |
| [07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) | The single source-of-truth token file and its generated outputs for React, React Native, Astro |
| [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md) | Phased rollout, what to verify at each checkpoint |
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
