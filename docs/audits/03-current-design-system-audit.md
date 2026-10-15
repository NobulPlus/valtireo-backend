# Current Design System Audit — client, mobile, website

Date: 2026-10-15
Scope: read-only audit of the styling implementation that exists today across the three Valtireo surfaces, ahead of a future visual-identity redesign. No colors are proposed here and no code outside this file was changed.

**Correction to the audit brief:** the brief describes `website/` as "brand new, still untracked in git as of this session." That is not the case — `website/` is already tracked: `git ls-files website` returns 44 files, all committed in `b8ee79c "mobile app dev"` (`git log --oneline -- website`), and `git status` for the path is clean. It is new relative to the product's history and is the least mature surface by far (see §0), but it is not sitting outside version control.

---

## 0. Surface maturity at a glance

| Surface | Stack | Styling approach | Maturity |
|---|---|---|---|
| `client/` | React 19 + Vite + Tailwind CSS v4 | `@theme` CSS tokens in `client/src/index.css`, consumed via Tailwind utilities + a handful of shared `components/ui/*` | Mature — ~40 feature pages, token system, per-org theming wired end-to-end |
| `mobile/` | Expo / React Native | Hand-rolled `ThemeProvider` + token objects in `mobile/src/theme.tsx`, consumed via `StyleSheet.create` per screen | Mid-maturity — one real token file, but only 6 shared components (`mobile/src/components/`) against 29 screens, most of which build their own `StyleSheet` |
| `website/` | Astro 7, static output | Plain CSS with `:root` custom properties in `website/src/styles/global.css`; **no Tailwind, no component library, no JS framework** (`website/package.json:11` lists only `astro` as a dependency) | Early/thin — 5 pages, 4 Astro partials, one 526-line global stylesheet, no dark mode, no tenant branding, a different (smaller) token set than client or mobile |

---

## 1. Colors and semantic tokens

### mobile/src/theme.tsx (full token source, lines 1–174)
- `ThemeColors` interface (`theme.tsx:5-21`) with `lightColors` (`theme.tsx:24-39`) and `darkColors` (`theme.tsx:42-57`).
- Per-module accent pairs: `lightModuleColors` (`theme.tsx:65-76`) and `darkModuleColors` (`theme.tsx:78-89`) for leave/attendance/tickets/directory/calendar/assets/documents/payslips/profile/lifestyle.
- Fixed, theme-invariant brand constants: `HERO_GRADIENT` and `HERO_ACCENT` (`theme.tsx:92-93`).
- Key light values: `pine #123f3a`, `ink #173e38`, `muted #60716b`, `paper #f3f4ef`, `lime #d5f78b`, `danger #c0392b`, `warning #b7791f`, `success #1d6b4e`.

### client/src/index.css `@theme` block (lines 33–106)
- `--color-pine: #123f3a`, `--color-pine-dark: #0c2c28`, `--color-teal: #2f8f8a`, `--color-blue: #244f7a`, `--color-ink: #101828` (`index.css:38-43`).
- Separate accent tier explicitly marked "narrow purpose only": `--color-bridge-teal: #65c7c4`, `--color-gold: #ffcc29`, `--color-cyan: #16b6c9` (`index.css:50-52`), reserved for the login screen and governance/AI moments — a concept that **does not exist on mobile at all**.
- Chart palette `--color-chart-1..6` (`index.css:58-63`) — mobile has no chart-color equivalent.
- Status colors: `--color-success: #168a5b`, `--color-warning: #c47a00`, `--color-danger: #c2413d`, `--color-info: #2563a8`, plus `--color-pending`/`--color-draft` (`index.css:75-86`) — mobile only has `danger`/`warning`/`success` (`theme.tsx:18-20`), no `info`/`pending`/`draft`.
- Dark mode redefines only neutrals + status tints (`index.css:122-168`); brand/accent hues are explicitly fixed across themes (comment at `index.css:108-121`).

### mobile's claim vs. reality — verified and found false
`theme.tsx:23` comment: *"Matches the web app's brand palette (client's Tailwind config / the pine-green sidebar seen across every screenshot)..."* Checked against `client/src/index.css:38-106`:
- `pine` matches exactly (`#123f3a` in both).
- Everything else diverges:
  - mobile has no `teal`/`blue`/`bridge-teal`/`gold`/`cyan`/chart tokens at all.
  - mobile's `danger #c0392b` vs. client's `--color-danger #c2413d` — close but **not equal**.
  - mobile's `warning #b7791f` vs. client's `--color-warning #c47a00` — different hue family entirely (olive/amber vs. orange).
  - mobile's `success #1d6b4e` vs. client's `--color-success #168a5b` — different greens.
  - mobile's dark-mode `pine #2fae82` (a bright mint-green used as the *primary* brand color in dark mode) has no client equivalent — client keeps `--color-pine` fixed across themes (`index.css:108-121` comment), so client's dark mode never turns the brand color bright green the way mobile's does.
  - mobile's `paper #f3f4ef` vs. client's `--color-canvas #f7faf9` — different page-background values.
- Conclusion: the claim that mobile "matches the web app's Tailwind config" is **true only for the single `pine` hex value**; every other token mobile defines has either no client counterpart or a different numeric value.

### website/src/styles/global.css `:root` (lines 19–33)
- Only 6 tokens: `--ink #173e38`, `--pine #123f3a`, `--muted #60716b`, `--paper #f8faf6`, `--lime #d5f78b`, `--line #dce4db`, `--white #fff`.
- `pine`, `ink`, `muted`, `lime` are **byte-identical** to mobile's light palette (`theme.tsx:25,28,29,34`) — closer to mobile than client is.
- `--paper #f8faf6` differs from both mobile's `paper #f3f4ef` (`theme.tsx:30`) and client's `--color-canvas #f7faf9` (`index.css:66`) — three different "page background" values across three surfaces for what is conceptually the same token.
- No status colors, no chart colors, no module-accent concept, no dark-mode block anywhere in the file.
- `lime` is used identically in spirit to mobile's `lime`/`limeDeep` CTA accent (`theme.tsx:34-35,93`) and to client's intended "lime accent... for a consistent 'pop' color across web, mobile and the website" per the mobile comment (`theme.tsx:23`) — but **client's own `index.css` has no `--color-lime` token at all**. Grep confirms zero `--color-lime` references in `client/src/index.css`. So the one color the mobile comment calls out as the unifying "pop" accent across all three surfaces is present on mobile and website, and **absent from client's design tokens**.

### Per-organization override layer (client only)
`client/src/components/shell/WorkspaceThemeBridge.tsx:4-10` defines `DEFAULT_THEME` (`primary #123f3a`, `accent #2f8f8a`, `sidebar #123f3a`, `button #123f3a`, `font Inter`) and writes `--workspace-primary`, `--workspace-sidebar`, `--workspace-button`, `--workspace-accent`, `--workspace-font` onto `document.documentElement` from `session.workspace.theme` (`WorkspaceThemeBridge.tsx:33-51`), including a WCAG-luminance contrast calculation (`WorkspaceThemeBridge.tsx:26-31`) to pick readable foreground text for an arbitrary admin-chosen color. The backend default for this, however, is `primary_color => '#155EEF'` (`server/app/Services/WorkspaceSettingsService.php:67`) — a **blue**, not pine green — meaning the frontend default and backend default for the same "no customization yet" state disagree with each other (`#123f3a` vs `#155EEF`).

---

## 2. Typography

| Surface | Fonts | Loading | Scale |
|---|---|---|---|
| client | Inter (body/UI), Manrope (display/headings) | Self-hosted via `@fontsource/inter` and `@fontsource/manrope` npm packages, imported in `client/src/index.css:10-16`; comment explains self-hosting avoids a `fonts.gstatic.com` round trip for institutional network policies | `--text-display` 1.875rem/2.25rem, `--text-page-title` 1.5rem/2rem, `--text-section` 1.125rem/1.625rem, `--text-body` 0.875rem/1.375rem, `--text-label` 0.75rem/1rem (`index.css:96-105`), weight applied separately via `font-bold`/`font-extrabold` utilities per the comment at `index.css:91-95` |
| mobile | **System default only** (San Francisco on iOS, Roboto on Android) | No `fontFamily` set anywhere in `mobile/src` (grep for `fontFamily|expo-font|loadAsync|Font\.` returns no matches) and `mobile/app.json` has no font config | `makeTypography()` (`theme.tsx:105-113`): `display` 26/800, `title` 22/700, `heading` 17/600, `body` 14 (no explicit weight), `caption` 12 — five steps, no stated line-heights |
| website | Manrope only (400/600/700), self-hosted woff2 | `@font-face` declarations pointing at `/fonts/manrope-latin-*.woff2` (`global.css:1-18`), applied as the sole `font-family` on `:root` (`global.css:27`) | No named scale — sizes are hardcoded per selector (`h2 { font-size:clamp(30px,3.3vw,47px) }` at `global.css:64-67`, `.hero h1 { font-size:clamp(44px,4.55vw,68px) }` at `global.css:298-303`, dozens more ad hoc values through the responsive media queries) |

Findings:
- **No font family is shared across all three surfaces.** Client pairs Inter+Manrope; website uses Manrope alone (no Inter); mobile uses neither — it inherits the OS system font. A user moving from the web app to the mobile app today sees a visually different typeface family, not just a different scale.
- Client is the only surface with a named, reusable type scale exposed as design tokens. Mobile has a scale but it is a plain object, not CSS/RN theme tokens with line-heights defined per step. Website has no token scale at all — type sizes are one-off magic numbers (dozens of `font-size:` declarations in `global.css`), many using `clamp()` for responsive sizing that has no equivalent concept on client or mobile.

---

## 3. Spacing, radius, shadow

### mobile/src/theme.tsx
- `spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }` (`theme.tsx:95`)
- `radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 }` (`theme.tsx:97`)
- `shadow.soft` / `shadow.tile` as full RN shadow objects (`theme.tsx:100-103`), explicitly theme-invariant ("a neutral shadow color works on both grounds").

### client
- Tailwind v4's **default, un-customized** spacing scale is used throughout (no `--spacing-*` overrides exist in `client/src/index.css`); the numeric steps (1=4px, 2=8px, 4=16px, 6=24px, 8=32px) happen to line up with mobile's named steps, but client expresses spacing as raw Tailwind utility numbers (`p-4`, `gap-6`, etc.) rather than named tokens, so the correspondence is coincidental/unlabeled rather than a shared system.
- Radius is only partially tokenized: `--radius-md: 0.5rem` (8px) and `--radius-lg: 0.75rem` (12px) are defined (`index.css:88-89`), but a grep for Tailwind's own un-overridden radius utilities (`rounded-sm|rounded-xl|rounded-2xl|rounded-full|rounded-[`) across `client/src` returns **294 matches across 65 files**, i.e. most rounding in the app falls back to Tailwind's default scale rather than the two custom tokens — so client's radius system is only nominally tokenized.
- Shadows are not tokenized on client at all: only 13 occurrences of any `shadow-*`/`boxShadow` usage across 12 files, all using Tailwind's default `shadow-sm`/`shadow-md`/etc. — no equivalent of mobile's named `shadow.soft`/`shadow.tile`.

### website
- No spacing/radius/shadow tokens exist. Every value is a literal in `global.css` (e.g. `.feature-card { border-radius:14px }` at `global.css:565`, `.button { border-radius:7px }` at `global.css:112`, `.nav-dropdown { border-radius:10px; box-shadow:0 20px 40px #173e3818 }` at `global.css:214-215`). Radii in use span at least 4px, 5px, 6px, 7px, 8px, 10px, 11px, 12px, 14px, 16px, 17px, 18px, 20px and `50%`, none of which line up with mobile's `radius` scale (8/12/16/22/999) or client's `--radius-md/lg` (8/12) particularly closely except by coincidence.

**Net:** mobile is the only surface with an explicit, named spacing/radius/shadow token system. Client has partial radius tokens that most of the codebase bypasses. Website has none.

---

## 4. Component inventory

### client/src/components/ui (28 files) — single shared library, well-adopted
`Alert, AsyncSelect, BreakdownList, Button, Card, Charts, CopyableSecret, CreatableSelect, DataTable, DatePicker, DateRangePicker, Dropdown, Field, Input, Logomark, Modal, ModalActions, PageHeader, Pagination, PhoneInput, PriorityBadge, ProgressRing, SelectMenu, StatTile, States, StatusBadge, Toast`.
- `Button` (`client/src/components/ui/Button.tsx:1-54`) is imported in **41 files**; `Card` in **33 files**; `DataTable` in **8 files** — genuine shared-component adoption, not per-screen reimplementation, for the highest-traffic primitives.
- `Button`'s `primary` variant reads the workspace CSS variables directly (`Button.tsx:16`: `bg-[var(--workspace-button,var(--color-pine))]`), so per-org branding flows through the shared component automatically.
- `client/src/components/shell/` (`AppShell, MobileNavDrawer, NotificationBell, ProtectedRoute, RequirePermission, Sidebar, Topbar, WorkspaceModeModal, WorkspaceThemeBridge, navConfig.ts`) holds navigation chrome; `Sidebar.tsx:9-32` shows the nav-link list and logo/brand header (`SidebarBrand`) are shared between the desktop sidebar and `MobileNavDrawer.tsx` by construction, which keeps the two web nav surfaces visually in sync.

### mobile/src/components (6 files) — thin, inconsistently adopted
`Avatar.tsx, IconTile.tsx, ListFooterLoader.tsx, QueryError.tsx, SearchableSelect.tsx, Sparkle.tsx`.
- `IconTile` (`mobile/src/components/IconTile.tsx:1-34`) is a well-built shared primitive — it pulls `radius`, `shadow`, `spacing`, and theme colors directly from `theme.tsx` (`IconTile.tsx:4,20,32`) so module tiles render consistently wherever used.
- But grep shows `IconTile`/`Avatar`/`Sparkle` are only referenced in **4 of 29 screens**: `HomeScreen.tsx`, `LoginScreen.tsx`, `MoreMenuScreen.tsx`, `ProfileScreen.tsx`. The other 25 screens (`AssetsListScreen`, `AttendanceListScreen`, `LeaveListScreen`, `TicketsListScreen`, `DirectoryScreen`, etc.) do not use them.
- Consistent with that, grep for `StyleSheet.create` across `mobile/src/screens` returns **45 occurrences across 29 files** — i.e. essentially every mobile screen defines its own local `StyleSheet.create` rather than composing from a shared card/list-row/tile component. The theme tokens (`spacing`, `radius`, `colors`) are usually imported into these per-screen styles, so colors/spacing are *consistent*, but the actual card/row/list-item **components** are reimplemented screen-by-screen rather than shared.

### website/src/components (4 Astro partials)
`AppScreenshot.astro, CallToAction.astro, Icon.astro, ProductPreview.astro` — all small, presentational wrappers. There is no Button/Card/Input component abstraction; markup and styling live directly in the `.astro` page files and the single `global.css`, with repeated card-like blocks (`.feature-card`, `.conversation-card`, `.access-card`, `.floating-note`, `.connected-note` in `global.css:564-575, 1450-1457, 405-437`) that share a visual language (white/tinted background, rounded corners, drop shadow) but are each defined as separate, hand-tuned CSS classes rather than one reusable card primitive.

### Forms/inputs
- client: `Input`, `Field`, `PhoneInput`, `DatePicker`, `DateRangePicker`, `AsyncSelect`, `CreatableSelect`, `SelectMenu` — a real shared forms layer.
- mobile: only `SearchableSelect.tsx` is shared; ordinary text inputs appear to be built ad hoc per screen (each screen's own `StyleSheet.create`, confirmed above).
- website: plain HTML form elements with no shared component (marketing site has minimal forms — contact page only).

### Navigation
- client: `Sidebar` + `MobileNavDrawer` share `navConfig.ts` and `SidebarNavLinks`/`SidebarBrand`, so desktop and the web app's own mobile breakpoint stay in sync (`Sidebar.tsx:9-32`).
- mobile: tab bar / stack headers are centralized through `navigatorScreenOptions(colors)` (`theme.tsx:167-174`), which is a good single source for header tint/background/content colors across all native-stack screens.
- website: a single hand-built responsive nav in `SiteLayout.astro:14-17` with CSS-only dropdowns (`:hover`/`:focus-within`) and a small inline `<script>` for the mobile menu toggle (`SiteLayout.astro:20-42`) — no shared nav data structure with client's `navConfig.ts`, despite describing the same product modules (`website/src/data/site.ts` duplicates the module list that `client/src/components/shell/navConfig.ts` already encodes, independently).

---

## 5. Light/dark mode

- **mobile**: Full support. `ThemeProvider` (`theme.tsx:132-158`) exposes a `preference` of `'light' | 'dark' | 'system'`, resolves `'system'` against `useColorScheme()` (`theme.tsx:147`), and persists the choice via `expo-secure-store` under key `valtireo.theme_preference` (`theme.tsx:119,137-145`).
- **client**: Full support, independently implemented. `client/src/context/ThemeContext.tsx` has its own `'light' | 'dark' | 'system'` preference, persisted to `localStorage` under key `valtireo-theme` (`ThemeContext.tsx:7,40-43`, vs. mobile's SecureStore + different key naming), applied via a `data-theme` attribute on `<html>` consumed by the `@media (prefers-color-scheme: dark)` / `[data-theme='dark']` blocks in `index.css:122-168`. Notably, client also adopts an **organization-level default** theme mode the first time a device has no stored preference (`ThemeContext.tsx:49-56`, reading `session.workspace.theme.mode`) — a per-tenant dark-mode default that mobile has no equivalent for.
- **website**: **No dark mode whatsoever.** `global.css` has no `prefers-color-scheme` query and no theme-switch mechanism; the site is permanently light (pine-on-paper).

Two independent light/dark implementations (client, mobile) with different persistence keys/mechanisms and no shared logic; a third surface (website) with none.

---

## 6. Module-color pattern

- Defined and used only on **mobile**: `lightModuleColors`/`darkModuleColors` (`theme.tsx:65-89`) covering leave/attendance/tickets/directory/calendar/assets/documents/payslips/profile/lifestyle, consumed by `IconTile` on the Home dashboard and More menu (per the comment at `theme.tsx:64`).
- **client has no equivalent concept.** Its nav (`navConfig.ts`) and feature pages use the shared pine/teal/blue palette uniformly; there is no "leave = amber/orange, tickets = red, directory = purple" accent-per-module mapping anywhere in `client/src`. A user who learns "tickets are peach-colored" on mobile has no matching visual cue on web.
- **website has no module-color concept either** — the module grid (`.module-strip` in `global.css:628-648`, driven by `website/src/data/site.ts`'s `modules` list) renders every module with the same icon treatment and no per-module accent color.

This is the single clearest "ad hoc, mobile-only" pattern in the whole system: a nicely built mechanism that exists on exactly one of the three surfaces.

---

## 7. Branding / per-tenant customization

- **Backend has real multi-tenant branding support**: `server/app/Services/WorkspaceSettingsService.php` (default `logo_url => null`, `primary_color => '#155EEF'` at lines 58, 67), `server/app/Http/Requests/Workspace/UpdateWorkspaceLogoRequest.php`, `UpdateWorkspaceSettingsRequest.php`, and `ProvisionOrganizationRequest.php` for platform-admin org creation.
- **client fully consumes it**: `WorkspaceThemeBridge.tsx` (section 1) writes `--workspace-primary/accent/sidebar/button(+fg)/font` CSS variables from `session.workspace.theme`, and `Button.tsx:16` plus `Sidebar.tsx`'s `SidebarBrand` (lines 9-32, rendering `session.workspace.identity.logo_url` via `assetUrl()` with a `Logomark` fallback) both react to it live. This is a genuinely working per-organization white-label layer on web.
- **mobile knows the shape but never applies it.** `mobile/src/types/api.ts:68` types `logo_url: string | null` and `:75` types a `theme` field on the session/workspace object — so the mobile app's API client already deserializes this data — but a repo-wide grep for `logo_url` or `workspace?.theme` outside that one type file returns **zero** results in `mobile/src`. No screen reads `colors` from the organization; mobile is hardcoded to the Valtireo pine/lime brand for every tenant.
- **website has no tenant concept at all** (it's a marketing site, which is arguably correct), and is 100% hardcoded to the Valtireo brand — logo, colors, copy — with no admin-configurable surface.

Net: branding is a three-tier story — fully wired (client), modeled-but-dead code (mobile), and not applicable by design (website) — and today only one of three customer-facing apps actually honors an organization's chosen colors/logo.

---

## 8. Hardcoded styling and duplication

- **Raw hex literals in component/screen code** (i.e., outside the designated token files) — grep for `#[0-9a-fA-F]{6}`:
  - mobile: 71 occurrences across 3 files, but only 12 are outside `theme.tsx` — `mobile/src/screens/HomeScreen.tsx` (12) and `mobile/src/screens/LoginScreen.tsx` (7) hardcode hex values locally instead of pulling every value from `theme.tsx`'s exports (`HERO_GRADIENT`/`HERO_ACCENT` cover some of this deliberately, per `theme.tsx:91`, but not all 19).
  - client: 95 occurrences across 9 files **outside** `index.css`'s token block, concentrated in `client/src/features/platform/PlatformDashboardPage.tsx` (9), `client/src/components/ui/Logomark.tsx` (4), `client/src/components/shell/WorkspaceThemeBridge.tsx` (4 — these are the deliberate `DEFAULT_THEME` fallbacks, not accidental duplication), and one-off hits in `Charts.tsx`, `AcceptInvitationPage.tsx`, `MyDashboardView.tsx`, `OrganizationDashboardView.tsx`, `LoginPage.tsx`.
  - website: effectively the entire stylesheet, since website has no token system to defer to beyond the 6 `:root` variables — the vast majority of the 526-line `global.css` is hardcoded per-selector hex/px values (catalogued in §3).
- **Radius/shadow token bypass on client**: 294 un-tokenized `rounded-*`/`shadow-*` Tailwind utility occurrences across 65 files (§3) — the two actual radius tokens (`--radius-md/lg`) are a minority usage pattern, not the default path.
- **Copy-pasted card patterns on website**: `.feature-card`, `.conversation-card`, `.access-card`, `.floating-note`, `.connected-note`, `.product-preview` panels (`global.css:564-1010` area) each independently declare `border-radius`, `background`, `box-shadow` with slightly different values for what is visually "a card" every time, rather than one shared `.card` class.
- **Every mobile screen has its own `StyleSheet.create`** (45 occurrences / 29 files, §4) — the most structurally significant duplication in the system, since it means any future visual change (e.g., a new card radius) requires touching up to 29 files instead of one shared component.

---

## 9. Cross-platform inconsistencies (highest priority for a future redesign)

1. **"pine" is the only color that actually matches everywhere.** `#123f3a` is shared by mobile (`theme.tsx:25`), client (`index.css:38`), and website (`global.css:21`). Nothing else is guaranteed to match:
   - danger: mobile `#c0392b` vs. client `#c2413d` (close, not equal) vs. website (no danger color defined at all).
   - warning: mobile `#b7791f` vs. client `#c47a00` — visibly different hue.
   - success: mobile `#1d6b4e` vs. client `#168a5b` — different greens.
   - "page background" token: mobile `paper #f3f4ef`, client `canvas #f7faf9`, website `paper #f8faf6` — three different values for the same concept.
2. **The "lime" pop accent is on mobile and website but missing from client's token file.** Client's `index.css` has no `--color-lime`; the mobile comment claiming a "consistent pop color across web, mobile and the website" (`theme.tsx:23`) is not backed by client's actual tokens — client would have to hardcode a lime hex locally wherever it wants that accent, which defeats the point of a token.
3. **Client-only concepts with no mobile/website equivalent**: the `bridge-teal`/`gold`/`cyan` narrow-purpose accent tier (`index.css:45-52`), the full chart-color palette (`index.css:58-63`), and `info`/`pending`/`draft` status colors (`index.css:81-86`).
4. **Mobile-only concept with no client/website equivalent**: the entire module-accent system (§6) — 10 feature areas each with a themed icon-chip color on mobile, uniform coloring everywhere else.
5. **Typography has zero overlap across all three surfaces simultaneously.** Client = Inter+Manrope; website = Manrope only; mobile = OS system font. There is no font family common to all three.
6. **Dark mode exists twice, independently, and is absent once.** Client and mobile each reimplemented light/dark/system preference logic with different persistence mechanisms (`localStorage` vs. `SecureStore`) and different storage keys (`valtireo-theme` vs. `valtireo.theme_preference`); website has no dark mode at all.
7. **Radius scales don't line up.** mobile `{8,12,16,22,999}` vs. client's actually-tokenized `{8,12}` (plus whatever Tailwind default radii individual components fell back to) vs. website's ungoverned set of ~13 distinct radius values (§3).
8. **Per-tenant branding only works on one of three surfaces that have a tenant concept** (§7) — an organization that sets a custom primary color and logo sees it on client, not on mobile, and website doesn't have the concept to begin with.
9. **Shadows are a named, reusable token on mobile (`shadow.soft`/`shadow.tile`) but an un-tokenized Tailwind default on client and a pile of one-off `box-shadow` literals on website** — no shared elevation language at all.
10. **The module/feature list itself is maintained independently in at least two places** — `client/src/components/shell/navConfig.ts` and `website/src/data/site.ts` both encode the same set of product modules with no shared source, so adding or renaming a module requires remembering to update both (and, separately, whatever drives mobile's `MoreMenuScreen.tsx`/`HomeScreen.tsx` module tiles).

---

## 10. Recommendations

**Preserve**
- The semantic-token *pattern* already present on both mobile (`theme.tsx`) and client (`index.css` `@theme`) — naming colors by role (ink/muted/paper/border) rather than by raw value — is sound and should be the model extended to website.
- Client's per-organization branding pipeline (`WorkspaceThemeBridge` + CSS variables + WCAG contrast calculation) is a solid, working mechanism and a good template for giving mobile the same capability.
- Mobile's `ThemeProvider`/SecureStore persisted light-dark-system preference, and client's independent (if differently-keyed) equivalent — both are reasonable UX; the mechanism is worth keeping, just unifying.
- Client's shared `components/ui/*` library and its genuine, high adoption rate (`Button` in 41 files, `Card` in 33) as the model for component reuse mobile should move toward.
- Mobile's module-accent-color concept (§6) as a UX idea — it demonstrably helps navigation legibility — even though its specific values shouldn't be assumed to survive a rebrand untouched.

**Improve**
- Close the gap between client's *defined* radius/shadow tokens and their *actual* usage — right now most of the client codebase bypasses them (294 un-tokenized occurrences), so the tokens exist on paper more than in practice.
- Give mobile's screens a shared card/list-row/section primitive so the 29 independent `StyleSheet.create` blocks stop drifting from each other and from `theme.tsx`'s intent.
- Wire mobile up to the per-organization branding data it already receives and types (`types/api.ts:68,75`) but currently discards.
- Add *some* dark-mode and *some* token system to website before it accumulates more hardcoded pages — it is the newest and smallest surface, so this is the cheapest moment to fix it.

**Consolidate**
- A single source of truth for the "what are our feature modules, and what icon/label do they get" list, currently duplicated between `client/src/components/shell/navConfig.ts` and `website/src/data/site.ts` (and implicitly a third time in mobile's home/more-menu screens).
- The two independently-built light/dark/system preference implementations (client `ThemeContext.tsx`, mobile `theme.tsx`) into one conceptual contract (same states, same persistence semantics), even if the storage mechanism necessarily differs by platform.
- The color *roles* that all three surfaces agree they need (brand, page background, card surface, border, ink/muted text, danger/warning/success) into one canonical list of role names, so each surface's own token file at least speaks the same vocabulary even before values converge.

**Replace**
- The practice of hand-copying hex values between surfaces based on an informal/stale claim of "this matches the web app" (as mobile's `theme.tsx:23` comment does) — nothing currently verifies that claim mechanically, which is exactly how the divergences in §9 accumulated unnoticed. Any future redesign should pair its new token values with an automated or at least checklist-based cross-surface parity check rather than a code comment asserting parity.
- Website's monolithic, unindexed `global.css` (526 lines, no token coverage for most values) as the long-term approach, given the site is new enough that adopting a proper token/utility system now is far cheaper than retrofitting it after more pages are built on top of the current pattern.

---

### Appendix: files read for this audit
- `mobile/src/theme.tsx` (full, 175 lines)
- `client/src/index.css` (full, 526 lines)
- `website/src/styles/global.css` (full, 2507 lines incl. responsive blocks — media-query section truncated above for brevity but fully reviewed)
- `client/package.json`, `website/package.json`, `website/astro.config.mjs`
- `client/src/components/shell/WorkspaceThemeBridge.tsx`, `client/src/context/ThemeContext.tsx`, `client/src/components/shell/Sidebar.tsx`, `client/src/components/ui/Button.tsx`
- `mobile/src/components/IconTile.tsx`
- `website/src/layouts/SiteLayout.astro`
- `server/app/Services/WorkspaceSettingsService.php` (grep for logo/color defaults)
- `mobile/src/types/api.ts` (grep for logo_url/theme fields)
- Directory listings of `client/src/components/{ui,shell}`, `mobile/src/components`, `mobile/src/screens`, `website/src/{components,pages}`
- `git ls-files website`, `git log --oneline -- website`, `git status --porcelain -- website` (for the §0 correction)
