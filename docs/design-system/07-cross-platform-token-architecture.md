# 07 — Shared token-generation architecture (React, React Native, Astro)

**Revision note:** the original draft of this file and of
[08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md)
had a real conflict — Phase 1 described swapping `tokens.json`'s single global palette to the
new values, while Phase 2 described consolidating other screens "while token values still
resolve to the original palette." Both can't be true of one global file. This revision fixes
that by giving the source file **two named palettes** instead of one, plus an explicit,
narrow selector mechanism for which palette a given screen resolves to during the migration —
so the global default is flipped exactly once, at the end of the rollout, never flip-flopped.

## 1. Why a generated source, not three hand-maintained files

Unchanged reasoning from the original draft: audit `03` §9 traced today's inconsistencies to
every surface independently inventing its own numbers for the same concept, verified by
nothing, and mobile's `theme.tsx:23` comment claims a parity with client's palette that was
never mechanically true. A generated-from-one-source pipeline makes that claim true by
construction instead of by assertion.

## 2. The source file

`design-tokens/tokens.json`, new, at the repo root. JSON specifically (not YAML), so it's
directly `JSON.parse`-able in a Metro/RN build step and importable as a Tailwind v4 `@theme`
source without a second parser dependency (audit `05` §1).

```jsonc
{
  "palettes": {
    "legacy": {
      // Byte-for-byte today's values — lightColors/darkColors/lightModuleColors/
      // darkModuleColors from theme.tsx, client's index.css @theme block, website's
      // :root block. This palette exists so Phase 0 and the consolidation phase can
      // run with zero visual change, and so any screen not yet flagged into "v2"
      // keeps rendering exactly as it does today.
      "color": { "bg": { "light": "#f3f4ef", "dark": "#0c1f1b" }, "...": "..." },
      "brand": { "primary": "#123f3a", "...": "..." },
      "modules": { "leave": { "bg": "#fff1d6", "icon": "#b4780f" }, "...": "..." }
    },
    "v2": {
      // This spec's "Warm & Human" values, exactly as in 01-color-tokens.md.
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
        "ctaGradient": { "light": ["#00585B", "#0EA5A0"], "dark": ["#0EA5A0", "#39CFC0"] }
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
      }
    }
  },
  "activePalette": "legacy",
  "type": {
    "display": { "family": "Manrope", "weight": 800, "size": 28, "lineHeight": 34 },
    "title": { "family": "Manrope", "weight": 700, "size": 22, "lineHeight": 28 },
    "heading": { "family": "Inter", "weight": 600, "size": 17, "lineHeight": 22 },
    "body": { "family": "Inter", "weight": 400, "size": 15, "lineHeight": 21 },
    "label": { "family": "Inter", "weight": 500, "size": 13, "lineHeight": 18 },
    "caption": { "family": "Inter", "weight": 400, "size": 12, "lineHeight": 16 }
  },
  "spacing": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 },
  "radius": { "sm": 8, "md": 12, "lg": 16, "xl": 22, "pill": 999 },
  "shadow": {
    "soft": { "offsetY": 6, "blur": 12, "opacity": 0.12, "color": "#000000" },
    "tile": { "offsetY": 2, "blur": 6, "opacity": 0.10, "color": "#000000" }
  }
}
```

`type`/`spacing`/`radius`/`shadow` are **not** duplicated per palette — those scales don't
change between legacy and v2 (per [02](02-typography-spacing-elevation-iconography.md), which
no longer carries a `v2`-only `xxl` radius or `hero` shadow now that Login's floating card has
been retired — see that file's revision note). `activePalette` is the single global default
every unflagged screen/surface resolves to; it changes exactly once, at full rollout (§5),
never back and forth.

This is a proposed shape to implement, not a file that exists yet.

## 3. The screen-level flag mechanism

A **separate, hand-written** file — not generated, since it's a rollout control, not a design
value — `mobile/src/designSystemRollout.ts`:

```ts
// Which named palette each screen resolves to during the migration. A screen not
// listed here falls back to tokens.activePalette (today: "legacy"). This file is
// deleted entirely once every screen is flipped and activePalette itself becomes "v2"
// — it is a temporary migration control, not a permanent part of the theme system.
export const SCREEN_PALETTE_OVERRIDE: Partial<Record<ScreenName, 'legacy' | 'v2'>> = {
  // Login: 'v2',   // uncommented once Phase 2's Login checkpoint passes
  // Home: 'v2',
};
```

`useTheme()` reads the current screen's name (via React Navigation's route name, already
available to every screen) and resolves `palettes[SCREEN_PALETTE_OVERRIDE[screenName] ??
activePalette]` instead of a single hardcoded palette object. This is the "controlled
screen-level migration... feature flag" mechanism the correction asked for: flipping a screen
to the new identity is a one-line change to this file, independently reversible per screen,
with no effect on any other screen's rendering and no edit to the shared token values
themselves.

Client's equivalent, given its much higher existing component adoption (audit `03` §4: `Button`
in 41 files, `Card` in 33) needs less granularity — a single `data-design-system="v2"` attribute
on the document root (absent = legacy), toggled once client's migration phase begins, rather
than a per-page override map. Website, being static and lowest-risk, skips the flag mechanism
entirely and cuts over directly once its own phase starts (§
[08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md)).

## 4. What's generated, per surface

| Surface | Generated artifact | Replaces |
|---|---|---|
| `mobile/` | `mobile/src/theme.generated.ts` — exports `palettes.legacy`/`palettes.v2` plus `type`/`spacing`/`radius`/`shadow` | The hand-written literals at `theme.tsx:24-103` |
| `client/` | `client/src/tokens.generated.css` — emits both palettes as two `@theme`-scoped variable sets, selected by `[data-design-system="v2"]` | The hand-written `@theme` block at `index.css:33-106` |
| `website/` | `website/src/styles/tokens.generated.css` — emits only the palette currently active for that phase (website never runs two palettes side by side, since it has no flag mechanism) | The 6 hand-written `:root` variables at `global.css:19-33` |

## 5. What stays platform-specific (unchanged from the original draft)

- **Component implementations** stay native per platform; no shared React/React Native
  component library is proposed.
- **Font-loading mechanism** stays per-platform
  ([02](02-typography-spacing-elevation-iconography.md) §1); the family *name* is a shared
  token value, the loading mechanism is not.
- **Dark-mode storage/engine** stays two engines (`localStorage` + `ThemeContext.tsx` on
  client, `expo-secure-store` + `ThemeProvider` on mobile), both reading the same
  `color.*.light`/`color.*.dark` pairs from whichever palette is currently active for a given
  screen/surface.

## 6. Build step and parity verification

Unchanged from the original draft: a build script reads `tokens.json` and writes the generated
artifacts in §4; CI fails if a committed generated artifact doesn't match a fresh regeneration.
This applies to **both** palettes simultaneously while they coexist — the parity check doesn't
care which palette is "active," only that every generated file is a faithful, current
reflection of the source JSON.

## 7a. Implementation-scope note (Revision 2)

The first round of actual mobile implementation (Login only, per
[08](08-migration-plan-and-regression-checkpoints.md)) does **not** stand up the full
repo-root `design-tokens/tokens.json` + three-generator pipeline described in §2–4. That
remains correctly sequenced for when client/website migration begins. What's implemented now is
a pragmatic, mobile-only subset: both palettes (`legacy` values matching today's `theme.tsx`
exactly, plus the new `v2` values including `ctaGradient`) live directly inside
`mobile/src/theme.tsx` as plain exported objects, with Login reading from `v2` and every other
screen continuing to read the existing, unrenamed exports exactly as before — so nothing outside
Login changes behavior or appearance. This satisfies the instruction's "start with the shared
design-token infrastructure, keeping the existing application appearance and functionality
unchanged" for this phase without building generator tooling the repo doesn't have yet and that
nothing currently needs outside mobile.

## 7. Sequencing — one flip, not a flip-flop

The core correction from the original draft: **`activePalette`/the per-screen override map
moves forward monotonically.** A screen or surface is flagged from `legacy` to `v2` once, after
its checkpoint passes, and is never flagged back to `legacy` except as an explicit rollback of
that one screen if its checkpoint fails. The global `activePalette` default itself changes from
`"legacy"` to `"v2"` exactly once, after every mobile screen has been individually verified on
`v2` (see [08](08-migration-plan-and-regression-checkpoints.md) §Phase 3) — at that point the
per-screen override map is deleted outright, since every screen has independently converged on
the same answer `activePalette` now gives for free. Client and website each get their own single
flip, gated on mobile's full rollout being stable first, per the same file.
