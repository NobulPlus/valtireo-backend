import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { AttendanceCorrectionRequest, AttendanceRecord, Paginated } from '../../types/api';

export function useMyAttendanceRecords() {
  return useInfiniteList(['attendance', 'records', 'mine'], (page) =>
    api.get<Paginated<AttendanceRecord>>('/attendance/records', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page } }));
}

export function useMyAttendanceCorrections() {
  return useQuery({
    queryKey: ['attendance', 'corrections', 'mine'],
    queryFn: () => api.get<Paginated<AttendanceCorrectionRequest>>('/attendance/corrections?per_page=50'),
  });
}

export interface RequestAttendanceCorrectionPayload {
  attendance_record_id: number;
  timezone?: string;
  requested_check_in_at?: string;
  requested_check_out_at?: string;
  reason: string;
}

export function useRequestAttendanceCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestAttendanceCorrectionPayload) =>
      api.post<{ attendance_correction: AttendanceCorrectionRequest }>('/attendance/corrections', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'corrections', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'records', 'mine'] });
    },
  });
}
