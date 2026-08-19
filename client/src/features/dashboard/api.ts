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

export function useManagerDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'manager'],
    queryFn: () => api.get<ManagerDashboard>('/dashboard/manager'),
  });
}

export function useMyDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: () => api.get<MyDashboard>('/dashboard/me'),
  });
}
