import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { downloadAndShare } from '../leave/api';
import { INFINITE_LIST_PAGE_SIZE, useInfiniteList } from '../../lib/useInfiniteList';
import type { LaravelPage, MyCompensationResponse, PayrollRunItem } from '../../types/api';

export function useMyCompensation() {
  return useQuery({
    queryKey: ['payroll', 'me', 'compensation'],
    queryFn: () => api.get<MyCompensationResponse>('/payroll/me/compensation'),
  });
}

export function useMyPayslips() {
  return useInfiniteList(
    ['payroll', 'me', 'payslips'],
    (page) => api.get<LaravelPage<PayrollRunItem>>('/payroll/me/payslips', { params: { per_page: INFINITE_LIST_PAGE_SIZE, page } }),
  );
}

export function useMyPayslip(runItemId: number | null) {
  return useQuery({
    queryKey: ['payroll', 'me', 'payslips', 'detail', runItemId],
    queryFn: () => api.get<{ payslip: PayrollRunItem }>(`/payroll/me/payslips/${runItemId}`),
    select: (response) => response.payslip,
    enabled: runItemId !== null,
  });
}

/** Downloads to local cache then hands off to the OS share sheet — there's no "new tab" on a phone. */
export async function downloadMyPayslip(runItemId: number, reference: string): Promise<void> {
  await downloadAndShare(`/payroll/run-items/${runItemId}/payslip/download`, `payslip-${reference}.html`);
}
