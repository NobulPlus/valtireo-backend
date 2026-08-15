# Valtireo Client

React + TypeScript + Vite frontend for the Valtireo HR MVP.

This first pass covers the foundation and the first slice of the
implementation order from
`../docs/valtireo-hr-mvp-frontend-handoff-guide-2026-08-11.md`:

1. Auth shell and session bootstrap
2. App shell, navigation, permissions, modules, workspace theme
3. Workspace and setup checklist
4. Setup lookups and shared selectors
5. Dashboards (organization, manager, my dashboard)
6. Employee directory and employee creation
7. Employee detail and profile overview

Documents, approvals, leave, attendance, reports, notifications, and audit
are not built yet — their nav entries are visible but disabled ("Soon") so
the shell reflects the full product shape. Continue in the order above.

## Stack

- React 19 + TypeScript, built with Vite
- React Router for routing
- TanStack Query for server state/caching
- Axios for the API client (bearer token auth)
- React Hook Form + Zod for forms/validation
- Tailwind CSS v4 (CSS-first config, tokens in `src/index.css`)
- lucide-react for icons

## Getting started

```bash
cd client
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to the
local Laravel backend at `http://127.0.0.1:8000` (see `vite.config.ts`), so
there's no CORS configuration to worry about locally. Start the backend
first:

```bash
cd ../server
php artisan serve
```

Then sign in with the local seed admin:

```text
email: admin@valtireo.test
password: Password1!
```

If you need to point the app at a different API host (no proxy in front of
it), copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`.

## Project structure

```text
src/
  components/
    shell/       # AppShell, Sidebar, Topbar, nav config, route guards
    ui/           # Shared primitives: Button, Card, DataTable, StatusBadge,
                  # Pagination, Field/Input, AsyncSelect, Modal, empty/error states
  context/
    AuthContext.tsx   # session bootstrap, login/logout, permission/module helpers
  features/
    auth/         # Login page
    dashboard/    # Organization / manager / my dashboard views + tabs
    employees/    # Directory, create, detail/profile overview
    workspace/    # Workspace settings + setup checklist
  lib/
    apiClient.ts  # axios instance, bearer token, ApiError w/ 422 field errors
    queryClient.ts
  types/
    api.ts        # Types mirroring the Laravel API Resources/Services
```

## Conventions for continuing the build

- **API types**: add to `src/types/api.ts`, matching the Laravel Resource/
  Service shapes in `server/app/Http/Resources` and `server/app/Services` —
  read the backend source directly rather than guessing from the Postman
  collection, since the collection doesn't include response examples.
- **Data fetching**: one `api.ts` per feature folder with TanStack Query
  hooks (see `src/features/employees/api.ts`). Mutations invalidate the
  relevant query keys.
- **Permissions/modules**: gate pages with `<RequirePermission permission="...">`
  and gate nav items in `src/components/shell/navConfig.ts`. Never hardcode
  access by role — use `permissions`/`modules` from the session payload.
- **Status colors**: reuse `<StatusBadge status="..." />` and extend the
  `STATUS_TONE` map in `src/components/ui/StatusBadge.tsx` rather than
  inventing new colors per module.
- **Forms**: React Hook Form + Zod, with `ApiError.errors` (422 responses)
  mapped back onto fields via `setError` — see `EmployeeCreatePage.tsx` for
  the pattern.
- **New modules**: follow the employees feature as a template — `api.ts` +
  list/create/detail pages — and flip its `comingSoon` flag off in
  `navConfig.ts` once it's built.

## Design tokens

Brand colors, typography, and status colors live in `src/index.css` under
`@theme`, sourced from
`../docs/valtireo-brand-product-design-foundation-v1.md`. Tailwind v4
auto-generates utilities from these tokens (e.g. `--color-pine` →
`bg-pine`/`text-pine`/`border-pine`), so use the token names directly
instead of arbitrary hex values.
