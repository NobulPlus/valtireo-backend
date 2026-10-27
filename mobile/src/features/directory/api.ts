import { useMutation, useQuery } from '@tanstack/react-query';
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

/**
 * Message and Call from the Directory both start from the same direct
 * conversation — Connect dedupes it server-side, so reopening an existing
 * thread with this colleague is as cheap as creating a new one. Mirrors the
 * web Directory page's own two mutations exactly.
 */
export function useMessageColleague() {
  return useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await api.post<{ data: { id: string } }>('/connect/conversations', { kind: 'direct', member_ids: [userId] });
      return data.id;
    },
  });
}

export function useCallColleague() {
  return useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await api.post<{ data: { id: string } }>('/connect/conversations', { kind: 'direct', member_ids: [userId] });
      await api.post('/connect/calls', { conversation_id: data.id });
      return data.id;
    },
  });
}
