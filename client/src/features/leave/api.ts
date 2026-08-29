import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
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
  evidence?: File | null;
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => {
      const formData = new FormData();
      formData.append('leave_type_id', String(payload.leave_type_id));
      formData.append('starts_on', payload.starts_on);
      formData.append('ends_on', payload.ends_on);
      if (payload.reason) formData.append('reason', payload.reason);
      if (payload.evidence) formData.append('evidence', payload.evidence);

      return api.post<{ leave_request: LeaveRequest }>('/leave/requests', formData);
    },
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

type LeaveEvidenceDownload = Pick<LeaveRequest, 'id' | 'evidence_mime_type' | 'evidence_download_url'>;

export async function openLeaveEvidenceInNewTab(leaveRequest: LeaveEvidenceDownload): Promise<void> {
  if (!leaveRequest.evidence_download_url) return;

  const response = await apiClient.get(`/leave/requests/${leaveRequest.id}/evidence/download`, {
    responseType: 'blob',
  });
  const responseType = response.headers['content-type'];
  const blob = new Blob([response.data], {
    type: leaveRequest.evidence_mime_type ?? (typeof responseType === 'string' ? responseType : 'application/octet-stream'),
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
