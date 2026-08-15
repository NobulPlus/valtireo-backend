import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { LeaveRequest, LeaveType, Paginated } from '@/types/api';

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave', 'types', 'mine'],
    queryFn: () => api.get<{ data: LeaveType[] }>('/leave/types'),
    staleTime: 5 * 60_000,
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ['leave', 'requests', 'mine'],
    queryFn: () => api.get<Paginated<LeaveRequest>>('/leave/requests?per_page=50'),
  });
}

export interface CreateLeaveRequestPayload {
  leave_type_id: number;
  starts_on: string;
  ends_on: string;
  reason?: string;
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => api.post<{ leave_request: LeaveRequest }>('/leave/requests', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export function useCancelLeaveRequest(leaveRequestId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.patch(`/leave/requests/${leaveRequestId}/cancel`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}
