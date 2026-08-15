import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type {
  Paginated,
  PlatformDashboard,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
} from '@/types/api';

export interface PlatformOrganizationFilters {
  page?: number;
  search?: string;
  status?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface PlatformDashboardFilters {
  date_from?: string;
  date_to?: string;
  search?: string;
  status?: string;
}

function queryString(filters: PlatformOrganizationFilters & PlatformDashboardFilters): string {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', String(filters.page));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_direction) params.set('sort_direction', filters.sort_direction);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);

  const query = params.toString();
  return query ? `?${query}` : '';
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function usePlatformDashboard(filters: PlatformDashboardFilters = {}) {
  return useQuery({
    queryKey: ['platform', 'dashboard', filters],
    queryFn: () => api.get<PlatformDashboard>(`/platform/dashboard${queryString(filters)}`),
  });
}

export function usePlatformOrganizations(filters: PlatformOrganizationFilters) {
  return useQuery({
    queryKey: ['platform', 'organizations', filters],
    queryFn: () => api.get<Paginated<PlatformOrganizationSummary>>(`/platform/organizations${queryString(filters)}`),
  });
}

export function usePlatformOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'organizations', id],
    queryFn: () => api.get<PlatformOrganizationDetail>(`/platform/organizations/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateOrganizationStatus(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { status: 'active' | 'suspended'; reason?: string }) =>
      api.patch<PlatformOrganizationDetail & { message: string }>(`/platform/organizations/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', id] });
    },
  });
}

export async function downloadPlatformOrganizationsCsv(
  filters: PlatformOrganizationFilters & PlatformDashboardFilters,
): Promise<void> {
  const response = await apiClient.get('/platform/organizations/export', {
    params: cleanParams(filters),
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `valtireo-organizations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
