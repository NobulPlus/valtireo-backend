import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { CompanyEvent, Paginated } from '@/types/api';

export interface CompanyEventFilters {
  date_from?: string;
  date_to?: string;
  search?: string;
  per_page?: number;
}

export function useCompanyEvents(filters: CompanyEventFilters = {}) {
  return useQuery({
    queryKey: ['calendar', 'events', filters],
    queryFn: () => api.get<Paginated<CompanyEvent>>('/company-events', { params: { per_page: 100, ...filters } }),
  });
}

export interface CompanyEventPayload {
  title: string;
  description?: string | null;
  starts_on: string;
  ends_on: string;
  department_id?: number | null;
}

export function useCreateCompanyEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompanyEventPayload) => api.post<{ company_event: CompanyEvent }>('/company-events', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
    },
  });
}

export function useUpdateCompanyEvent(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CompanyEventPayload>) => api.patch<{ company_event: CompanyEvent }>(`/company-events/${eventId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
    },
  });
}

export function useDeleteCompanyEvent(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ company_event: CompanyEvent }>(`/company-events/${eventId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
    },
  });
}
