import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import type { MyDashboard } from '../../types/api';

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
