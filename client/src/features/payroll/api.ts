import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type {
  EmployeeLoan,
  EmployeePayrollRecord,
  EmployeeStatutoryProfile,
  Paginated,
  PayGroup,
  PayrollComponent,
  PayrollInput,
  PayrollJournalBatch,
  PayrollPaymentBatch,
  PayrollReportSummary,
  PayrollRun,
  PayrollSettings,
  PayrollStatutoryReportRow,
} from '@/types/api';

const KEY = ['payroll'] as const;

// ---- Settings ----

export function usePayrollSettings() {
  return useQuery({
    queryKey: [...KEY, 'settings'],
    queryFn: () => api.get<{ settings: PayrollSettings }>('/payroll/settings'),
    select: (response) => response.settings,
  });
}

export function useUpdatePayrollSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<PayrollSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>) =>
      api.patch<{ settings: PayrollSettings }>('/payroll/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...KEY, 'settings'] });
    },
  });
}

// ---- Pay groups ----

export function usePayGroups() {
  return useQuery({
    queryKey: [...KEY, 'pay-groups'],
    queryFn: () => api.get<{ data: PayGroup[] }>('/payroll/pay-groups'),
    select: (response) => response.data,
  });
}

export interface PayGroupPayload {
  name: string;
  code?: string;
  frequency: string;
  pay_day: number;
  is_active?: boolean;
}

export function useCreatePayGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PayGroupPayload) => api.post<{ pay_group: PayGroup }>('/payroll/pay-groups', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'pay-groups'] }),
  });
}

export function useUpdatePayGroup(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PayGroupPayload>) => api.patch<{ pay_group: PayGroup }>(`/payroll/pay-groups/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'pay-groups'] }),
  });
}

// ---- Components ----

export function usePayrollComponents() {
  return useQuery({
    queryKey: [...KEY, 'components'],
    queryFn: () => api.get<{ data: PayrollComponent[] }>('/payroll/components'),
    select: (response) => response.data,
  });
}

export interface PayrollComponentPayload {
  name: string;
  code?: string;
  type: string;
  calculation_type: string;
  default_value: number;
  percentage_of_component_id?: number | null;
  is_taxable?: boolean;
  is_statutory?: boolean;
  is_recurring?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export function useCreatePayrollComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PayrollComponentPayload) => api.post<{ component: PayrollComponent }>('/payroll/components', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'components'] }),
  });
}

export function useUpdatePayrollComponent(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PayrollComponentPayload>) => api.patch<{ component: PayrollComponent }>(`/payroll/components/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'components'] }),
  });
}

// ---- Employee payroll record ----

export function useEmployeePayrollRecord(employeeId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'employee', employeeId],
    queryFn: () => api.get<EmployeePayrollRecord>(`/payroll/employees/${employeeId}`),
    enabled: employeeId !== null,
  });
}

export interface CompensationPayload {
  pay_group_id?: number | null;
  base_salary: number;
  currency: string;
  pay_frequency: string;
  effective_from: string;
  recurring_components?: Array<{ component_id: number; value?: number | null }>;
}

export function useCreateCompensation(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompensationPayload) => api.post(`/payroll/employees/${employeeId}/compensations`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'employee', employeeId] }),
  });
}

export interface BankAccountPayload {
  bank_name: string;
  bank_code?: string | null;
  account_number: string;
  account_name: string;
  is_primary?: boolean;
}

export function useCreateBankAccount(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BankAccountPayload) => api.post(`/payroll/employees/${employeeId}/bank-accounts`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'employee', employeeId] }),
  });
}

// ---- Statutory profile ----

export function useStatutoryProfile(employeeId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'statutory-profile', employeeId],
    queryFn: () => api.get<{ statutory_profile: EmployeeStatutoryProfile }>(`/payroll/employees/${employeeId}/statutory-profile`),
    select: (response) => response.statutory_profile,
    enabled: employeeId !== null,
  });
}

export interface StatutoryProfilePayload {
  paye_enabled?: boolean;
  tax_state?: string | null;
  tax_id?: string | null;
  pension_enabled?: boolean;
  pfa_name?: string | null;
  rsa_pin?: string | null;
  nhf_enabled?: boolean;
  nhf_number?: string | null;
  reliefs?: Array<{ name: string; annual_amount: number }>;
}

export function useUpdateStatutoryProfile(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StatutoryProfilePayload) => api.put<{ statutory_profile: EmployeeStatutoryProfile }>(`/payroll/employees/${employeeId}/statutory-profile`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'statutory-profile', employeeId] }),
  });
}

// ---- Runs ----

export interface PayrollRunFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
}

export function usePayrollRuns(filters: PayrollRunFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'runs', filters],
    queryFn: () => api.get<Paginated<PayrollRun>>('/payroll/runs', { params: { per_page: 50, ...filters } }),
  });
}

export function usePayrollRun(runId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'runs', 'detail', runId],
    queryFn: () => api.get<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}`),
    select: (response) => response.payroll_run,
    enabled: runId !== null,
  });
}

export interface CreatePayrollRunPayload {
  pay_group_id?: number | null;
  reference: string;
  name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  currency: string;
}

function invalidateRuns(queryClient: ReturnType<typeof useQueryClient>, runId?: number) {
  queryClient.invalidateQueries({ queryKey: [...KEY, 'runs'] });
  if (runId) queryClient.invalidateQueries({ queryKey: [...KEY, 'runs', 'detail', runId] });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePayrollRunPayload) => api.post<{ payroll_run: PayrollRun }>('/payroll/runs', payload),
    onSuccess: () => invalidateRuns(queryClient),
  });
}

export function useCalculatePayrollRun(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}/calculate`),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

export function useSubmitPayrollRun(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}/submit`),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

export function useFinalizePayrollRun(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}/finalize`),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

export function usePublishPayrollRun(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}/publish`),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

export function useVoidPayrollRun(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.post<{ payroll_run: PayrollRun }>(`/payroll/runs/${runId}/void`, { reason }),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

// ---- Inputs & loans ----

export interface PayrollInputFilters {
  employee_id?: number;
  status?: string;
  per_page?: number;
}

export function usePayrollInputs(filters: PayrollInputFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'inputs', filters],
    queryFn: () => api.get<Paginated<PayrollInput>>('/payroll/inputs', { params: { per_page: 50, ...filters } }),
  });
}

export interface PayrollInputPayload {
  employee_id: number;
  payroll_component_id?: number | null;
  type: string;
  description: string;
  effective_date: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export function useCreatePayrollInput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PayrollInputPayload) => api.post<{ payroll_input: PayrollInput }>('/payroll/inputs', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'inputs'] }),
  });
}

export function usePayrollLoans() {
  return useQuery({
    queryKey: [...KEY, 'loans'],
    queryFn: () => api.get<Paginated<EmployeeLoan>>('/payroll/loans', { params: { per_page: 50 } }),
  });
}

export interface PayrollLoanPayload {
  employee_id: number;
  reference?: string;
  name: string;
  principal: number;
  interest_amount?: number;
  installment_amount: number;
  starts_on: string;
  ends_on?: string | null;
}

export function useCreatePayrollLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PayrollLoanPayload) => api.post<{ loan: EmployeeLoan }>('/payroll/loans', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'loans'] }),
  });
}

// ---- Outputs ----

export function usePaymentExport(runId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ payment_batch: PayrollPaymentBatch }>(`/payroll/runs/${runId}/payment-export`),
    onSuccess: () => invalidateRuns(queryClient, runId),
  });
}

export async function downloadPaymentBatch(batchId: number, filename: string): Promise<void> {
  const response = await apiClient.get(`/payroll/payment-batches/${batchId}/download`, { responseType: 'blob' });
  triggerBlobDownload(response.data, filename);
}

export function useGenerateJournal(runId: number) {
  return useMutation({
    mutationFn: () => api.post<{ journal: PayrollJournalBatch }>(`/payroll/runs/${runId}/journal`),
  });
}

export function useGeneratePayslip(runItemId: number) {
  return useMutation({
    mutationFn: () => api.post(`/payroll/run-items/${runItemId}/payslip`),
  });
}

export async function downloadPayslip(runItemId: number, employeeNumber: string): Promise<void> {
  const response = await apiClient.get(`/payroll/run-items/${runItemId}/payslip/download`, { responseType: 'blob' });
  triggerBlobDownload(response.data, `payslip-${employeeNumber}.html`);
}

function triggerBlobDownload(data: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

// ---- Reports ----

export interface PayrollReportFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
}

export function usePayrollReportSummary(filters: PayrollReportFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'reports', 'summary', filters],
    queryFn: () => api.get<{ summary: PayrollReportSummary; data: Paginated<PayrollRun>['data'] }>('/payroll/reports/summary', { params: filters }),
  });
}

export function usePayrollStatutoryReport(filters: PayrollReportFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'reports', 'statutory', filters],
    queryFn: () => api.get<{ data: PayrollStatutoryReportRow[] }>('/payroll/reports/statutory', { params: filters }),
    select: (response) => response.data,
  });
}

export function exportPayrollRegisterUrl(filters: PayrollReportFilters & { payroll_run_id?: number } = {}): string {
  const params = new URLSearchParams(filters as Record<string, string>).toString();
  return `/payroll/reports/register/export${params ? `?${params}` : ''}`;
}

export async function downloadPayrollRegister(filters: PayrollReportFilters & { payroll_run_id?: number } = {}): Promise<void> {
  const response = await apiClient.get('/payroll/reports/register/export', { params: filters, responseType: 'blob' });
  triggerBlobDownload(response.data, `payroll-register-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ---- My payslips (self-service) ----

export function useMyPayslips(perPage = 12) {
  return useQuery({
    queryKey: [...KEY, 'me', 'payslips', perPage],
    queryFn: () => api.get<Paginated<import('@/types/api').PayrollRunItem>>('/payroll/me/payslips', { params: { per_page: perPage } }),
  });
}

export function useMyPayslip(runItemId: number | null) {
  return useQuery({
    queryKey: [...KEY, 'me', 'payslips', 'detail', runItemId],
    queryFn: () => api.get<{ payslip: import('@/types/api').PayrollRunItem & { payroll_run: PayrollRun } }>(`/payroll/me/payslips/${runItemId}`),
    select: (response) => response.payslip,
    enabled: runItemId !== null,
  });
}
