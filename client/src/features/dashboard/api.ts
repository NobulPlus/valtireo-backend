import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { ManagerDashboard, MyDashboard, OrganizationDashboard } from '@/types/api';

export interface OrganizationDashboardFilters {
  date_from?: string;
  date_to?: string;
  date_column?: string;
  department_id?: number;
  employment_type_id?: number;
  organization_location_id?: number;
  status?: string;
  search?: string;
  recent_limit?: number;
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function useOrganizationDashboard(filters: OrganizationDashboardFilters = {}) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['dashboard', 'organization', filters],
    queryFn: () => api.get<OrganizationDashboard>('/dashboard/organization', { params: cleanParams(filters) }),
    enabled: hasPermission('reports.view'),
  });
}

export interface ManagerDashboardFilters {
  department_id?: number;
}

export function useManagerDashboard(filters: ManagerDashboardFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'manager', filters],
    queryFn: () => api.get<ManagerDashboard>('/dashboard/manager', { params: cleanParams(filters) }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export interface MyDashboardFilters {
  date_from?: string;
  date_to?: string;
}

export function useMyDashboard(filters: MyDashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'me', filters],
    queryFn: () => api.get<MyDashboard>('/dashboard/me', { params: cleanParams(filters) }),
    placeholderData: (previous) => previous,
  });
}
