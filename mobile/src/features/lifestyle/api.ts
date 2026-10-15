import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { Appreciation, AppreciationRecipient, LaravelPage, LifestylePreferences, LifestylePreferencesResponse, Milestone } from '../../types/api';

const PREFERENCES_KEY = ['lifestyle', 'preferences'];

export function useLifestylePreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<LifestylePreferencesResponse>('/lifestyle/preferences'),
  });
}

export function useUpdateLifestylePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<LifestylePreferences>) => api.patch<LifestylePreferencesResponse>('/lifestyle/preferences', payload),
    onSuccess: async (response) => {
      await queryClient.cancelQueries({ queryKey: ['lifestyle'] });
      queryClient.removeQueries({ queryKey: ['lifestyle', 'appreciations'] });
      queryClient.setQueryData(PREFERENCES_KEY, response);
      await queryClient.invalidateQueries({ queryKey: ['lifestyle'] });
    },
  });
}

export function useMilestones(days = 30, enabled = true) {
  return useQuery({
    queryKey: ['lifestyle', 'milestones', days],
    enabled,
    queryFn: () => api.get<{ data: Milestone[] }>('/lifestyle/milestones', { params: { days } }),
    select: (response) => response.data,
  });
}

export function useAppreciationRecipients(search: string) {
  return useInfiniteList(
    ['lifestyle', 'recipients', search],
    (page) => api.get<LaravelPage<AppreciationRecipient>>('/lifestyle/appreciation-recipients', { params: { search: search || undefined, per_page: INFINITE_LIST_PAGE_SIZE, page } }),
  );
}

export type AppreciationScope = 'all' | 'received' | 'sent' | 'shared';

export function useAppreciations(scope: AppreciationScope, enabled = true) {
  return useInfiniteList(
    ['lifestyle', 'appreciations', scope],
    (page) => api.get<LaravelPage<Appreciation>>('/lifestyle/appreciations', { params: { scope, per_page: INFINITE_LIST_PAGE_SIZE, page } }),
    { enabled },
  );
}

export interface SendAppreciationPayload {
  recipient_employee_id: number;
  message: string;
  visibility?: 'private' | 'shared';
}

export function useSendAppreciation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendAppreciationPayload) => api.post<{ data: Appreciation }>('/lifestyle/appreciations', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lifestyle', 'appreciations'] }),
  });
}

export function useDeleteAppreciation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/lifestyle/appreciations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lifestyle', 'appreciations'] }),
  });
}

export function useReportAppreciation() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => api.post<{ message: string }>(`/lifestyle/appreciations/${id}/report`, { reason }),
  });
}
