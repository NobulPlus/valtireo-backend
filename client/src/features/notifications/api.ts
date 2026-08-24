import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { Paginated } from '@/types/api';

export interface NotificationEntry {
  id: string;
  type: string;
  category: string | null;
  event: string | null;
  severity: 'info' | 'success' | 'warning' | 'danger' | string;
  title: string | null;
  message: string | null;
  action_label: string | null;
  action_url: string | null;
  entity_type: string | null;
  entity_id: number | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unread_count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

interface NotificationListResponse {
  data: NotificationEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<NotificationListResponse>('/notifications', { params: { per_page: 15 } }),
    enabled,
  });
}

export interface NotificationListFilters {
  status?: 'read' | 'unread' | '';
  category?: string;
  page?: number;
  per_page?: number;
}

export function useNotificationList(filters: NotificationListFilters) {
  return useQuery({
    queryKey: ['notifications', 'list', filters],
    queryFn: () =>
      api.get<{ data: NotificationEntry[]; meta: Paginated<NotificationEntry>['meta'] }>('/notifications', {
        params: filters,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<{ notification: NotificationEntry }>(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<{ unread_count: number }>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
