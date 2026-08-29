import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { ApprovalRequest, ApprovalWorkflow, ApproverType, Paginated } from '@/types/api';

interface ResourceEnvelope<T> {
  data: T;
}

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

export function useApprovalRequest(approvalRequestId: number | undefined) {
  return useQuery({
    queryKey: ['approvals', 'request', approvalRequestId],
    queryFn: async () => {
      const response = await api.get<ApprovalRequest | ResourceEnvelope<ApprovalRequest>>(`/approvals/${approvalRequestId}`);
      return 'data' in response ? response.data : response;
    },
    enabled: approvalRequestId !== undefined,
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

export interface ApprovalWorkflowStepPayload {
  step_order: number;
  name: string;
  approver_type: ApproverType;
  approver_role_id?: number | null;
  approver_permission?: string | null;
  note_required?: boolean;
  is_active?: boolean;
}

export interface ApprovalWorkflowPayload {
  module: string;
  action: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  require_note_on_reject?: boolean;
  require_note_on_request_changes?: boolean;
  auto_approve_when_no_steps?: boolean;
  steps: ApprovalWorkflowStepPayload[];
}

export function useApprovalWorkflows(enabled = true) {
  return useQuery({
    queryKey: ['approvals', 'workflows'],
    queryFn: () => api.get<Paginated<ApprovalWorkflow>>('/approval-workflows', { params: { per_page: 100 } }),
    enabled,
  });
}

export function useCreateApprovalWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApprovalWorkflowPayload) =>
      api.post<{ approval_workflow: ApprovalWorkflow }>('/approval-workflows', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'workflows'] });
    },
  });
}

export function useUpdateApprovalWorkflow(workflowId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ApprovalWorkflowPayload>) =>
      api.patch<{ approval_workflow: ApprovalWorkflow }>(`/approval-workflows/${workflowId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'workflows'] });
    },
  });
}
