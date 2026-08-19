import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { ActivityFeedEntry, AuditLogEntry, SimplePage } from '@/types/api';

export interface AuditFilters {
  event?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function useAuditLogs(filters: AuditFilters) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => api.get<SimplePage<AuditLogEntry>>('/audit-logs', { params: cleanParams(filters) }),
    enabled: hasPermission('audit_logs.view'),
    placeholderData: (previous) => previous,
  });
}

export function useActivityFeed(filters: AuditFilters) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['activity-feed', filters],
    queryFn: () => api.get<SimplePage<ActivityFeedEntry>>('/activity-feed', { params: cleanParams(filters) }),
    enabled: hasPermission('audit_logs.view'),
    placeholderData: (previous) => previous,
  });
}
