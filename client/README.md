# Valtireo Client

React + TypeScript + Vite frontend for the Valtireo Organizational OS MVP.

## Stack

- React 19 + TypeScript
- Vite
- React Router
- TanStack Query
- Axios bearer-token API client
- React Hook Form + Zod
- Tailwind CSS v4 with design tokens in `src/index.css`
- lucide-react icons

## Getting Started

Start the backend first:

```bash
cd ../server
php artisan serve
```

Then run the frontend:

```bash
cd client
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://127.0.0.1:8000`.

Default local admin:

```text
email: admin@valtireo.test
password: Password1!
```

If the API is hosted elsewhere, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`.

## Implemented Screens

Routes are defined in `src/App.tsx`.

- `/login`
- `/accept-invitation/:token`
- `/platform`
- `/platform/organizations/new`
- `/platform/organizations/:id`
- `/dashboard/:tab`
- `/employees`
- `/employees/new`
- `/employees/:id`
- `/me/profile`
- `/me/leave`
- `/me/attendance`
- `/workspace`
- `/settings/control-center`
- `/settings/structure`
- `/settings/roles`
- `/settings/custom-fields`
- `/documents`
- `/approvals`
- `/leave`
- `/attendance`
- `/reports`
- `/audit`

## Project Structure

```text
src/
  components/
    shell/       # App shell, sidebar, topbar, route guards, nav config
    ui/          # Shared UI primitives and design-system components
  context/
    AuthContext.tsx
  features/
    attendance/
    audit/
    auth/
    dashboard/
    employees/
    leave/
    platform/
    profile/
    settings/
    workspace/
  lib/
    apiClient.ts
    queryClient.ts
    validation.ts
  types/
    api.ts
```

## Frontend Conventions

- Add API types to `src/types/api.ts`, matching backend resources/services.
- Keep feature API hooks in each feature folder, for example `src/features/employees/api.ts`.
- Use TanStack Query for server state and invalidate related query keys after mutations.
- Gate pages with permissions/modules from session bootstrap. Do not hardcode access by role.
- Keep sidebar visibility in `src/components/shell/navConfig.ts`.
- Use shared primitives from `src/components/ui`.
- Use `StatusBadge` for status colors and extend its status map when needed.
- Use `SelectMenu`, `DatePicker`, `DateRangePicker`, `Modal`, `ModalActions`, `DataTable`, and chart primitives instead of native one-off controls.
- Use toast notifications for success/failure feedback.
- Prefer operational pages first, with configuration behind settings icons where the module has heavy setup controls.

## Current UX Pattern

Recent module pages follow this structure:

- overview metrics at the top
- operational records and activity in the main body
- settings/configuration opened from an icon in the page header
- row click opens detail/action modals
- destructive actions are soft/deactivation-style where history matters

This pattern is currently used across documents, approvals, leave, attendance, reports, and setup/control surfaces.

## Design Tokens

Brand colors, typography, status tones, and base UI tokens live in `src/index.css` under `@theme`, sourced from:

- `../docs/valtireo-brand-product-design-foundation-v1.md`
- `../docs/valtireo-frontend-design-system.md`
