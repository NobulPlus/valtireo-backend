# 05 — Organization-specific branding compatibility

## Current state (per audit `03` §7)

Branding is a three-tier story today:
- **`client/` fully honors it.** `WorkspaceThemeBridge.tsx:33-51` writes
  `--workspace-primary/accent/sidebar/button(+fg)/font` CSS variables from
  `session.workspace.theme`, consumed live by `Button.tsx:16`
  (`bg-[var(--workspace-button,var(--color-pine))]`) and `Sidebar.tsx`'s brand header. It
  includes its own WCAG-luminance contrast calculation (`WorkspaceThemeBridge.tsx:26-31`) to
  pick a readable foreground color for whatever primary color an org chooses.
- **`mobile/` types the data and ignores it.** `types/api.ts:68,75` already deserializes
  `logo_url` and `theme` from the session payload; a repo-wide grep finds zero reads of either
  field anywhere else in `mobile/src` (audit `03` §7). Every tenant sees the hardcoded Valtireo
  brand.
- **`website/` has no tenant concept** — correct by design for a marketing site, not a gap.
- **The backend and frontend defaults already disagree with each other**: client's
  `DEFAULT_THEME.primary` is `#123f3a` (pine) while `WorkspaceSettingsService.php:67`'s backend
  default is `primary_color: '#155EEF'` (a blue) — a pre-existing inconsistency, unrelated to
  this redesign, worth noting here because this spec's rollout is the natural moment either to
  fix it or to decide it's out of scope (see §3).

## What this redesign must decide, and what it decides

A global visual-identity change interacts with per-tenant branding in one specific way: **the
new default brand (teal/cream/apricot/lilac) is itself just the "no customization" case of the
same override mechanism client already has** — not a parallel system. Concretely:

1. **The new palette becomes the new `DEFAULT_THEME`**, replacing pine (`#123f3a`) as the
   fallback `client/src/components/shell/WorkspaceThemeBridge.tsx:4-10` and
   `mobile/src/theme.tsx` both resolve to when an organization has not set a custom
   `primary_color`/`logo_url`. Organizations that *have* set a custom color are unaffected by
   this redesign on client — they already override the default and will continue to.
2. **Mobile must stop discarding `logo_url`/`theme`.** This should be wired for Login/Home
   specifically as part of [08](08-migration-plan-and-regression-checkpoints.md)'s Phase 2,
   the same step that flips those two screens' layout and palette to the new identity — not
   deferred, because
   shipping a newly-polished default mobile brand while silently ignoring an org's configured
   colors makes the gap *more* visible than it is today, not less (a rough-looking app
   "doesn't support branding yet" reads as expected; a polished one that ignores a configured
   logo reads as broken).
3. **The contrast-calculation mechanism client already has
   (`WorkspaceThemeBridge.tsx:26-31`) is the template, not a new design.** Mobile's equivalent
   should reuse the same luminance-based foreground-color decision so an org's arbitrary chosen
   primary color gets a readable button/text foreground on mobile exactly as it already does on
   web — this is a porting task for
   [07-cross-platform-token-architecture.md](07-cross-platform-token-architecture.md) and
   [08-migration-plan-and-regression-checkpoints.md](08-migration-plan-and-regression-checkpoints.md)'s
   Phase 1, not a new algorithm to design here.
4. **Module-accent colors (§5 of [01](01-color-tokens.md)) are not org-overridable.** An
   organization can recolor its *brand* (primary/logo), but the 15-module wayfinding palette
   stays fixed platform-wide — module colors are a navigation aid, not a brand surface, and
   letting them vary per-tenant would mean "tickets are peach" on one org's app and something
   else on another's, defeating the purpose of a consistent wayfinding color. This mirrors how
   client's chart-color palette and status colors are also not tenant-overridable today.
5. **`accentApricot`/`accentLilac` are also not org-overridable** — they're part of the fixed
   Valtireo brand identity (the two "special moment" accents), distinct from the one color slot
   (`primary`) an organization can replace with their own.

## What stays out of scope here

- Fixing the backend/frontend default-color mismatch (`#123f3a` vs `#155EEF`) is a pre-existing
  bug unrelated to this redesign. [08](08-migration-plan-and-regression-checkpoints.md) notes it
  as a candidate to fix *alongside* the default-palette swap (both touch the same default-value
  constants) but it is not a requirement of this spec and shouldn't block it.
- A full admin UI for organizations to preview/pick a custom primary color is unaffected by this
  spec either way — nothing here proposes changing that flow, only which default it falls back
  to and which platforms honor the override.
- `website/`'s lack of a tenant concept is correct and out of scope, per audit `03` §7's own
  conclusion ("not applicable by design").
