import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { ApprovalRequest, Paginated } from '@/types/api';

export interface ApprovalRequestFilters {
  module?: string;
  status?: string;
  per_page?: number;
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function useApprovalRequests(filters: ApprovalRequestFilters = {}) {
  return useQuery({
    queryKey: ['approvals', 'requests', filters],
    queryFn: () => api.get<Paginated<ApprovalRequest>>('/approvals', { params: cleanParams(filters) }),
  });
}

export type ApprovalDecisionAction = 'approve' | 'reject' | 'request_changes' | 'cancel';

export interface ActOnApprovalRequestPayload {
  action: ApprovalDecisionAction;
  note?: string;
}

export function useActOnApprovalRequest(approvalRequestId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActOnApprovalRequestPayload) =>
      api.post<{ approval_request: ApprovalRequest }>(`/approvals/${approvalRequestId}/actions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
