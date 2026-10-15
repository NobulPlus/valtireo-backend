import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { EmployeeDirectoryResponse } from '../../types/api';

export interface DirectoryFilters {
  search?: string;
  department_id?: number | 'all';
}

export function useEmployeeDirectory(filters: DirectoryFilters) {
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  // The backend reads absence of this param as "default to my department" and
  // the literal string "all" as "no department filter" — omitting it for the
  // "all" case silently falls back to the viewer's own department.
  if (filters.department_id) params.department_id = filters.department_id;

  return useInfiniteList(
    ['employees', 'directory', filters],
    (page) => api.get<EmployeeDirectoryResponse>('/employees/directory', { params: { ...params, per_page: INFINITE_LIST_PAGE_SIZE, page } }),
  );
}

export function useDepartmentOptions() {
  return useQuery({
    queryKey: ['setup', 'departments'],
    queryFn: () => api.get<{ data: { id: number; name: string }[] }>('/setup/departments'),
    staleTime: 5 * 60_000,
    select: (response) => response.data,
  });
}
