import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { NotificationEntry, Paginated } from '../../types/api';

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unread_count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
}

export interface NotificationListFilters {
  status?: 'read' | 'unread' | '';
  category?: string;
}

export function useNotificationList(filters: NotificationListFilters) {
  return useInfiniteList(
    ['notifications', 'list', filters],
    (page) =>
      api.get<Paginated<NotificationEntry>>('/notifications', {
        params: { ...filters, per_page: INFINITE_LIST_PAGE_SIZE, page },
      }),
  );
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<{ notification: NotificationEntry }>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<{ unread_count: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
