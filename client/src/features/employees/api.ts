import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type {
  CreateEmployeePayload,
  CreateEmployeeResponse,
  Dependent,
  Employee,
  EmployeeDirectoryResponse,
  EmployeeDocument,
  EmergencyContact,
  OrgChartNode,
  Paginated,
} from '@/types/api';

interface ResourceEnvelope<T> {
  data: T;
}

export interface EmployeeFilters {
  search?: string;
  status?: string;
  confirmation_status?: string;
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

export function useOrgChart(enabled = true) {
  return useQuery({
    queryKey: ['employees', 'org-chart'],
    queryFn: () => api.get<{ employees: OrgChartNode[] }>('/employees/org-chart'),
    enabled,
    select: (response) => response.employees,
  });
}

export interface DirectoryFilters {
  search?: string;
  department_id?: number | 'all';
  page?: number;
  per_page?: number;
}

export function useEmployeeDirectory(filters: DirectoryFilters) {
  return useQuery({
    queryKey: ['employees', 'directory', filters],
    queryFn: () => api.get<EmployeeDirectoryResponse>('/employees/directory', { params: cleanParams(filters) }),
    placeholderData: (previous) => previous,
  });
}

export function useDepartmentOptions() {
  return useQuery({
    queryKey: ['setup', 'departments'],
    queryFn: () => api.get<{ data: Array<{ id: number; name: string }> }>('/setup/departments'),
    staleTime: 5 * 60_000,
    select: (response) => response.data,
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

/** All document types visible to the acting user — admins with employee_documents.create see HR-only types too. */
export function useDocumentTypesForUpload() {
  return useQuery({
    queryKey: ['documents', 'types', 'upload'],
    queryFn: () => api.get<{ data: { id: number; name: string; code: string | null }[] }>('/documents/types?per_page=100'),
    staleTime: 5 * 60_000,
  });
}

export function useDocumentRequirementsForType(documentTypeId: number | undefined) {
  return useQuery({
    queryKey: ['documents', 'requirements', documentTypeId],
    queryFn: () =>
      api.get<{ data: { id: number; name: string }[] }>('/documents/requirements', {
        params: { document_type_id: documentTypeId, per_page: 100 },
      }),
    enabled: documentTypeId !== undefined,
  });
}

export interface UploadEmployeeDocumentPayload {
  employee_id: number;
  document_type_id: number;
  document_requirement_id?: number;
  title: string;
  file: File;
  issued_at?: string;
  expires_at?: string;
  notes?: string;
}

export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadEmployeeDocumentPayload) => {
      const formData = new FormData();
      formData.append('employee_id', String(payload.employee_id));
      formData.append('document_type_id', String(payload.document_type_id));
      if (payload.document_requirement_id) formData.append('document_requirement_id', String(payload.document_requirement_id));
      formData.append('title', payload.title);
      formData.append('file', payload.file);
      if (payload.issued_at) formData.append('issued_at', payload.issued_at);
      if (payload.expires_at) formData.append('expires_at', payload.expires_at);
      if (payload.notes) formData.append('notes', payload.notes);

      return api.post<{ document: EmployeeDocument }>('/documents', formData);
    },
    onSuccess: () => {
      // `useEmployee` keys on the route param (a string), so match broadly
      // by prefix rather than guessing the exact key shape.
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
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
  cluster_id?: number | null;
  designation_id?: number | null;
  employment_type_id?: number | null;
  organization_location_id?: number | null;
  start_date?: string | null;
  pending_role_id?: number | null;
  profile?: {
    date_of_birth?: string | null;
    gender?: string | null;
    personal_email?: string | null;
    residential_address?: string | null;
    next_of_kin_name?: string | null;
    next_of_kin_phone?: string | null;
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
    mutationFn: (payload: {
      confirmation_status: 'not_applicable' | 'probation' | 'confirmed';
      /** Required when confirmation_status is "probation" — powers the probation review reminder. */
      probation_ends_at?: string;
    }) => api.patch<{ employee: Employee }>(`/employees/${employeeId}/approve-onboarding`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
    mutationFn: (payload: {
      new_status?: string;
      new_confirmation_status?: string;
      effective_date: string;
      reason?: string;
      note?: string;
      /** Required when new_confirmation_status is "probation" — powers the probation review reminder. */
      probation_ends_at?: string;
    }) => api.post(`/employees/${employeeId}/status-history`, payload),
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

export interface EmployeeEmergencyContactPayload {
  name: string;
  relationship?: string | null;
  phone: string;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_primary?: boolean;
}

export function useCreateEmployeeEmergencyContact(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeEmergencyContactPayload) =>
      api.post<{ emergency_contact: EmergencyContact }>('/employee-profile/emergency-contacts', {
        ...payload,
        employee_id: employeeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateEmployeeEmergencyContact(contactId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeEmergencyContactPayload) =>
      api.patch<{ emergency_contact: EmergencyContact }>(`/employee-profile/emergency-contacts/${contactId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteEmployeeEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) => api.delete(`/employee-profile/emergency-contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export interface EmployeeDependentPayload {
  name: string;
  relationship: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_beneficiary?: boolean;
}

export function useCreateEmployeeDependent(employeeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeDependentPayload) =>
      api.post<{ dependent: Dependent }>('/employee-profile/dependents', {
        ...payload,
        employee_id: employeeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateEmployeeDependent(dependentId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeDependentPayload) =>
      api.patch<{ dependent: Dependent }>(`/employee-profile/dependents/${dependentId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteEmployeeDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependentId: number) => api.delete(`/employee-profile/dependents/${dependentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
