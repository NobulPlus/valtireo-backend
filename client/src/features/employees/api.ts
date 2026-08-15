import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type { CreateEmployeePayload, CreateEmployeeResponse, Employee, Paginated } from '@/types/api';

interface ResourceEnvelope<T> {
  data: T;
}

export interface EmployeeFilters {
  search?: string;
  status?: string;
  department_id?: number;
  unit_id?: number;
  designation_id?: number;
  grade_level_id?: number;
  employment_type_id?: number;
  organization_location_id?: number;
  profile_status?: string;
  manager_roles_only?: boolean;
  date_from?: string;
  date_to?: string;
  date_column?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface TemplateImportSummary {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_rows: number;
  failed_rows: number;
}

export interface TemplateImportResult {
  template: {
    key: string;
    name: string;
    module: string;
  };
  summary: TemplateImportSummary;
  rows: Array<{
    row_number: number;
    data: Record<string, string | null>;
    valid: boolean;
    imported: boolean;
    errors: Record<string, string>;
  }>;
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function useEmployees(filters: EmployeeFilters, enabled = true) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => api.get<Paginated<Employee>>('/employees', { params: cleanParams(filters) }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useEmployee(id: number | string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      const response = await api.get<Employee | ResourceEnvelope<Employee>>(`/employees/${id}`);
      return 'data' in response ? response.data : response;
    },
    enabled: id !== undefined,
  });
}

/** Lightweight employee search used by the reporting-manager async select. */
export async function searchEmployees(query: string, filters: EmployeeFilters = {}): Promise<Employee[]> {
  const result = await api.get<Paginated<Employee>>('/employees', {
    params: cleanParams({ ...filters, search: query, per_page: filters.per_page ?? 10 }),
  });
  return result.data;
}

export interface UpdateEmployeePayload {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  work_email?: string;
  phone?: string | null;
  department_id?: number | null;
  unit_id?: number | null;
  designation_id?: number | null;
  employment_type_id?: number | null;
  organization_location_id?: number | null;
  start_date?: string | null;
  profile?: {
    date_of_birth?: string | null;
    gender?: string | null;
    personal_email?: string | null;
    residential_address?: string | null;
    next_of_kin_name?: string | null;
    next_of_kin_phone?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  };
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) =>
      api.post<CreateEmployeeResponse>('/employees', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post<TemplateImportResult>('/templates/employee_import/import', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export async function downloadEmployeeImportTemplate(): Promise<void> {
  const response = await apiClient.get('/templates/employee_import/download', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'employee-import-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function useApproveOnboarding(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<{ employee: Employee }>(`/employees/${employeeId}/approve-onboarding`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEmployeePayload) => api.patch<Employee>(`/employees/${employeeId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useChangeEmployeeStatus(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { new_status: string; effective_date: string; reason?: string; note?: string }) =>
      api.post(`/employees/${employeeId}/status-history`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMoveEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, ...payload }: { employeeId: number; new_status: string; effective_date: string; reason?: string; note?: string }) =>
      api.post(`/employees/${employeeId}/status-history`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useChangeEmployeeManager(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { new_manager_id?: number | null; effective_date: string; reason?: string; note?: string }) =>
      api.post(`/employees/${employeeId}/reporting-history`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRequestEmployeeCorrection(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { section: string; message: string }) =>
      api.post(`/employees/${employeeId}/correction-requests`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export async function downloadEmployeeProfileCsv(employee: Employee): Promise<void> {
  const response = await apiClient.get(`/employees/${employee.id}/export`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${employee.employee_number.toLowerCase()}-profile-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Streams the employees CSV export and triggers a browser download. A plain
 * <a href> won't carry the bearer token, so this fetches via the shared
 * axios client (which attaches Authorization) and saves the blob.
 */
export async function downloadEmployeesCsv(filters: EmployeeFilters): Promise<void> {
  const response = await apiClient.get('/employees/export', {
    params: cleanParams({ ...filters, format: 'csv' }),
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
