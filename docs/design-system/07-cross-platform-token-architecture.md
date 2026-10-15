# 07 — Shared token-generation architecture (React, React Native, Astro)

This is almost entirely a restatement and confirmation of audit `05` §1's already-detailed
recommendation, now pointed at this spec's actual values instead of being written in the
abstract. Nothing below is a new architectural idea beyond what `05` already proposed; this
file exists to make the plan concrete against [01](01-color-tokens.md)'s and
[02](02-typography-spacing-elevation-iconography.md)'s real token values and to serve as the
one place implementation can start from directly.

## 1. Why a generated source, not three hand-maintained files

Audit `03` §9 traced today's inconsistencies to one root cause: every surface independently
invented its own numbers for the same concept, verified by nothing. Mobile's `theme.tsx:23`
comment claims parity with client's palette that was never mechanically true and had already
drifted by the time of the audit. A generated-from-one-source pipeline makes that claim true
by construction — the alternative (hand-copy this spec's hex values into three files once) just
restarts the same drift the moment any one of them is edited later without the other two.

## 2. The source file

`design-tokens/tokens.json`, new, at the repo root (sibling to `client/`, `mobile/`,
`website/`, `server/`) — JSON specifically (not YAML), so it's directly `JSON.parse`-able in a
Metro/RN build step and importable as a Tailwind v4 `@theme` source without a second parser
dependency (audit `05` §1). Shape, mapping 1:1 onto [01](01-color-tokens.md)/
[02](02-typography-spacing-elevation-iconography.md):

```jsonc
{
  "color": {
    "bg": { "light": "#FFF9F0", "dark": "#071F24" },
    "surface": { "light": "#FFFFFF", "dark": "#123237" },
    "chip": { "light": "#F3ECDD", "dark": "#1B3F43" },
    "border": { "light": "#EAE2D3", "dark": "#1C3A3E" },
    "ink": { "light": "#071F24", "dark": "#F5EFE4" },
    "muted": { "light": "#4F6B6E", "dark": "#9FB8BA" },
    "danger": { "light": "#D14343", "dark": "#FF6B6B" },
    "warning": { "light": "#C17A1F", "dark": "#E2A33D" },
    "success": { "light": "#1F8A5F", "dark": "#4FD399" },
    "info": { "light": "#2B6FB0", "dark": "#6FB3E8" },
    "pending": { "light": "#9B7C2E", "dark": "#D9B45E" },
    "draft": { "light": "#6B6358", "dark": "#A39A8C" }
  },
  "brand": {
    "primary": "#0EA5A0",
    "primaryStrong": "#00585B",
    "primaryDark": "#39CFC0",
    "accentApricot": "#FF9B54",
    "accentLilac": "#A879F7",
    "inkOnAccent": "#071F24",
    "heroGradient": ["#0EA5A0", "#00585B"]
  },
  "modules": {
    "leave": { "bg": "#FBEBD4", "icon": "#B8792B" },
    "attendance": { "bg": "#DCEEF7", "icon": "#2E7FB0" },
    "tickets": { "bg": "#FBE2DC", "icon": "#C1503D" },
    "directory": { "bg": "#EBE4F9", "icon": "#7A5BC1" },
    "calendar": { "bg": "#DCF2E7", "icon": "#2F8F6B" },
    "assets": { "bg": "#E2E5FB", "icon": "#4A5FC9" },
    "documents": { "bg": "#F1E7D7", "icon": "#8C6A3F" },
    "payslips": { "bg": "#DFF3E1", "icon": "#3C9A4F" },
    "profile": { "bg": "#FBE1EC", "icon": "#C1507E" },
    "lifestyle": { "bg": "#FCE5EB", "icon": "#D1567A" },
    "recruitment": { "bg": "#FBE7D4", "icon": "#C1621E" },
    "performance": { "bg": "#D9F2EE", "icon": "#1F8A78" },
    "learning": { "bg": "#DEE6F5", "icon": "#3A5FA0" },
    "financial_admin": { "bg": "#F2E9D2", "icon": "#96762A" },
    "ai_assistant": { "bg": "#EDE4FB", "icon": "#8B5FD9" }
  },
  "type": {
    "display": { "family": "Manrope", "weight": 800, "size": 28, "lineHeight": 34 },
    "title": { "family": "Manrope", "weight": 700, "size": 22, "lineHeight": 28 },
    "heading": { "family": "Inter", "weight": 600, "size": 17, "lineHeight": 22 },
    "body": { "family": "Inter", "weight": 400, "size": 15, "lineHeight": 21 },
    "label": { "family": "Inter", "weight": 500, "size": 13, "lineHeight": 18 },
    "caption": { "family": "Inter", "weight": 400, "size": 12, "lineHeight": 16 }
  },
  "spacing": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 },
  "radius": { "sm": 8, "md": 12, "lg": 16, "xl": 22, "xxl": 28, "pill": 999 },
  "shadow": {
    "soft": { "offsetY": 6, "blur": 12, "opacity": 0.12, "color": "#000000" },
    "tile": { "offsetY": 2, "blur": 6, "opacity": 0.10, "color": "#000000" },
    "hero": { "offsetY": 20, "blur": 30, "opacity": 0.35, "color": "#000000" }
  }
}
```

This is a proposed shape to implement, not a file that exists yet — no file has been written
under `design-tokens/` as part of producing this spec.

## 3. What's generated, per surface

| Surface | Generated artifact | Replaces |
|---|---|---|
| `mobile/` | `mobile/src/theme.generated.ts` — a TS module exporting the same shape `theme.tsx` currently hand-writes (`lightColors`/`darkColors`/`moduleColors`/`spacing`/`radius`/`shadow`) | The hand-written literals at `theme.tsx:24-103` — `theme.tsx` itself keeps the `ThemeProvider`/`useTheme()` logic (platform-specific, stays hand-written) and imports its *values* from the generated module instead |
| `client/` | A Tailwind v4 `@theme` block, generated into `client/src/tokens.generated.css` and `@import`ed by `client/src/index.css` | The hand-written `@theme` block at `index.css:33-106` |
| `website/` | CSS custom properties generated into `website/src/styles/tokens.generated.css`, `@import`ed by `global.css` | The 6 hand-written `:root` variables at `global.css:19-33` — website's first real token layer, per audit `05` §2/§3 (item 3/13), since it has none today |

## 4. What stays platform-specific (per audit `05` §1, unchanged here)

- **Component implementations** — `Button`/`Card`/`IconTile`-style primitives stay native per
  platform. No shared React/React Native component library is proposed.
- **Font-loading mechanism** — client/website keep self-hosting via `@fontsource/*`/`@font-face`
  respectively; mobile adds `expo-font` ([02](02-typography-spacing-elevation-iconography.md)
  §1). The *family name* is a shared token value (`type.*.family` above); how each runtime gets
  the glyphs on screen is not shared.
- **Dark-mode storage/engine** — client's `localStorage` + `ThemeContext.tsx`, mobile's
  `expo-secure-store` + `ThemeProvider`, stay as two engines (platforms differ on storage
  primitives), both now reading the *same* `color.*.light`/`color.*.dark` pairs from the
  generated output instead of independently maintained literals. The `'light'|'dark'|'system'`
  state machine itself should align in shape per audit `03` §10's "Consolidate" recommendation,
  but that's a code-level alignment, not something this token file encodes.

## 5. Build step and parity verification

A small build script (`design-tokens/build.(ts|js)`, Node) reads `tokens.json` and writes the
three generated artifacts above. Audit `05` §1 recommends a CI check that diffs each generated
output against what the source JSON would currently produce — i.e. fail CI if
`theme.generated.ts`/`tokens.generated.css` in the repo don't match a fresh regeneration from
`tokens.json`. This directly replaces the failure mode audit `03` found (a stale code comment
asserting parity that nothing verified) with a mechanical check. Scripting and wiring this up
is implementation, not part of this spec — noted here as the concrete next step once the
specification is approved.

## 6. Sequencing relative to value changes

Per audit `05` §2: land this plumbing — the JSON file, the three generators, the CI parity
check — **before** any screen's visual values change, so the first real diff anyone reviews is
"the generated output now matches hand-written output" (a no-op from the user's perspective),
and the *second* diff is the actual palette swap. Mixing both in one change makes it impossible
to tell whether a visual regression came from the new architecture or the new values — the same
reasoning [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md)
applies to every other phase of this rollout.
