import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { AttendanceCorrectionRequest, AttendanceRecord, Paginated } from '@/types/api';

export function useMyAttendanceRecords() {
  return useQuery({
    queryKey: ['attendance', 'records', 'mine'],
    queryFn: () => api.get<Paginated<AttendanceRecord>>('/attendance/records?per_page=50'),
  });
}

export function useMyAttendanceCorrections() {
  return useQuery({
    queryKey: ['attendance', 'corrections', 'mine'],
    queryFn: () => api.get<Paginated<AttendanceCorrectionRequest>>('/attendance/corrections?per_page=50'),
  });
}

export interface LogAttendancePayload {
  attendance_date: string;
  check_in_at?: string;
  check_out_at?: string;
}

export function useLogAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LogAttendancePayload) =>
      api.post<{ attendance_record: AttendanceRecord }>('/attendance/records', { ...payload, source: 'employee' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'records', 'mine'] });
    },
  });
}

export interface RequestAttendanceCorrectionPayload {
  attendance_record_id: number;
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
