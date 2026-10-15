import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, apiClient } from '../../lib/apiClient';
import { getStoredToken } from '../../lib/secureToken';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { LeaveHoliday, LeavePeriod, LeaveRequest, LeaveType, Paginated } from '../../types/api';

/** What expo-document-picker / expo-image-picker hand back — RN's FormData accepts this shape directly, unlike the web's File/Blob. */
export interface RNFile {
  uri: string;
  name: string;
  type: string;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave', 'types', 'mine'],
    queryFn: () => api.get<{ data: LeaveType[] }>('/leave/types'),
    staleTime: 5 * 60_000,
  });
}

export function useLeavePeriods() {
  return useQuery({
    queryKey: ['leave', 'periods'],
    queryFn: () => api.get<{ data: LeavePeriod[] }>('/leave/periods'),
    staleTime: 5 * 60_000,
  });
}

export function useLeaveHolidays(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['leave', 'holidays', 'mine'],
    queryFn: () => api.get<Paginated<LeaveHoliday>>('/leave/holidays', { params: { per_page: 100, is_active: true } }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useMyLeaveRequests(options: { enabled?: boolean } = {}) {
  return useInfiniteList(
    ['leave', 'requests', 'mine'],
    (page) => api.get<Paginated<LeaveRequest>>('/leave/requests', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page } }),
    { enabled: options.enabled ?? true },
  );
}

export interface CreateLeaveRequestPayload {
  leave_type_id: number;
  starts_on: string;
  ends_on: string;
  reason?: string;
  evidence?: RNFile | null;
  handover_to_employee_id?: number | null;
  handover_note?: string;
  handover_document?: RNFile | null;
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
      if (payload.evidence) formData.append('evidence', payload.evidence as unknown as Blob);
      if (payload.handover_to_employee_id) formData.append('handover_to_employee_id', String(payload.handover_to_employee_id));
      if (payload.handover_note) formData.append('handover_note', payload.handover_note);
      if (payload.handover_document) formData.append('handover_document', payload.handover_document as unknown as Blob);

      return api.post<{ leave_request: LeaveRequest }>('/leave/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

/**
 * Downloads an authenticated file to local cache, then hands it to the OS
 * share sheet (view/save/send) — the mobile equivalent of the web's
 * blob + window.open pattern, since there's no "new tab" on a phone.
 */
export async function downloadAndShare(path: string, suggestedName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  const token = getStoredToken();
  const url = `${apiClient.defaults.baseURL}${path}`;
  const safeName = suggestedName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = await File.downloadFileAsync(url, new File(Paths.cache, `${Date.now()}-${safeName}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    idempotent: true,
  });
  try {
    if (token !== getStoredToken()) throw new Error('Your session changed. Please try again.');
    await Sharing.shareAsync(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
}

type LeaveEvidenceDownload = Pick<LeaveRequest, 'id' | 'evidence_file_name' | 'evidence_download_url'>;

export async function openLeaveEvidence(leaveRequest: LeaveEvidenceDownload): Promise<void> {
  if (!leaveRequest.evidence_download_url) return;
  await downloadAndShare(`/leave/requests/${leaveRequest.id}/evidence/download`, leaveRequest.evidence_file_name ?? 'evidence');
}

type LeaveHandoverDocumentDownload = Pick<LeaveRequest, 'id' | 'handover_file_name' | 'handover_download_url'>;

export async function openLeaveHandoverDocument(leaveRequest: LeaveHandoverDocumentDownload): Promise<void> {
  if (!leaveRequest.handover_download_url) return;
  await downloadAndShare(`/leave/requests/${leaveRequest.id}/handover-document/download`, leaveRequest.handover_file_name ?? 'handover-document');
}
