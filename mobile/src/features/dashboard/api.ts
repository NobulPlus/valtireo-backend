import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import type { ManagerDashboard, MyDashboard } from '../../types/api';

export interface MyDashboardFilters {
  date_from?: string;
  date_to?: string;
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function useMyDashboard(filters: MyDashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'me', filters],
    queryFn: () => api.get<MyDashboard>('/dashboard/me', { params: cleanParams(filters) }),
    placeholderData: (previous) => previous,
  });
}

/**
 * `GET /dashboard/manager` — same endpoint the web app's ManagerDashboardView already
 * consumes (client/src/features/dashboard/api.ts). Deliberately no `department_id`/
 * `cluster_id` params, unlike web's hook — passing either would exercise the backend's
 * org-wide browse branch (DashboardService.php:694-718, gated on `reports.view`, a
 * different permission from the people-manager `employees.view_team` this phase is
 * scoped to); omitting them keeps the request to the caller's own natural scope
 * (direct reports / department they head / cluster they lead), resolved entirely
 * server-side. `enabled` must be the caller's own `session.has_manager_scope === true`
 * check — this hook does not re-derive eligibility itself, so it never fires for a
 * non-manager, and the backend still independently re-validates on every request
 * regardless (DashboardService::managerScope(), throws 403 if ineligible).
 */
/**
 * Exported so AuthContext can purge this exact cache entry when a session
 * refresh discovers manager scope was revoked, without the two modules
 * disagreeing on what the key is (see AuthContext.tsx's bootstrap()).
 */
export const MANAGER_DASHBOARD_QUERY_KEY = ['dashboard', 'manager'] as const;

export function useManagerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: MANAGER_DASHBOARD_QUERY_KEY,
    queryFn: () => api.get<ManagerDashboard>('/dashboard/manager'),
    enabled,
    placeholderData: (previous) => previous,
  });
}
