import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { downloadAndShare } from '../leave/api';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { ApprovalDecisionAction, ApprovalRequest, Paginated } from '../../types/api';

export interface ApprovalRequestFilters {
  status?: string;
}

/**
 * `GET /approvals` — same endpoint and visibility rules (App\Services\ApprovalVisibility)
 * the web app's ApprovalRequestsPanel already consumes. No `module` filter here (unlike
 * web) — this inbox is a manager's single cross-module queue, not a per-module admin view.
 */
export function useApprovalRequests(filters: ApprovalRequestFilters = {}) {
  return useInfiniteList(['approvals', 'requests', filters], (page) =>
    api.get<Paginated<ApprovalRequest>>('/approvals', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page, ...filters } }),
  );
}

interface ResourceEnvelope<T> {
  data: T;
}

export function useApprovalRequest(approvalRequestId: number | null) {
  return useQuery({
    queryKey: ['approvals', 'request', approvalRequestId],
    queryFn: async () => {
      const response = await api.get<ApprovalRequest | ResourceEnvelope<ApprovalRequest>>(`/approvals/${approvalRequestId}`);
      return 'data' in response ? response.data : response;
    },
    enabled: approvalRequestId !== null,
  });
}

export interface ActOnApprovalRequestPayload {
  action: ApprovalDecisionAction;
  expected_step_order?: number | null;
  note?: string;
}

export function useActOnApprovalRequest(approvalRequestId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActOnApprovalRequestPayload) =>
      api.post<{ approval_request: ApprovalRequest }>(`/approvals/${approvalRequestId}/actions`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'request', approvalRequestId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

type ApprovalDocumentDownload = NonNullable<ApprovalRequest['document']>;

export async function openApprovalDocument(document: ApprovalDocumentDownload): Promise<void> {
  await downloadAndShare(`/documents/${document.id}/download`, document.file_name ?? document.title);
}

type ApprovalLeaveEvidenceDownload = NonNullable<ApprovalRequest['leave_request']>;

export async function openApprovalLeaveEvidence(leaveRequest: ApprovalLeaveEvidenceDownload): Promise<void> {
  if (!leaveRequest.evidence_download_url) return;
  await downloadAndShare(`/leave/requests/${leaveRequest.id}/evidence/download`, leaveRequest.evidence_file_name ?? 'evidence');
}

type ApprovalTicketAttachmentDownload = NonNullable<ApprovalRequest['ticket']>;

export async function openApprovalTicketAttachment(ticket: ApprovalTicketAttachmentDownload): Promise<void> {
  if (!ticket.attachment_download_url) return;
  await downloadAndShare(`/tickets/${ticket.id}/attachment/download`, ticket.attachment_file_name ?? 'attachment');
}
