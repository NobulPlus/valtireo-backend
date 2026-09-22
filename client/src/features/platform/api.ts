import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';
import type {
  Paginated,
  OrganizationVerificationDocument,
  OrganizationVerificationSummary,
  PlatformDashboard,
  PlatformModuleCatalogEntry,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  ProvisionOrganizationPayload,
  ProvisionOrganizationResponse,
  SystemErrorLog,
  SystemErrorSummary,
} from '@/types/api';

export interface PlatformOrganizationFilters {
  page?: number;
  search?: string;
  status?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface PlatformDashboardFilters {
  date_from?: string;
  date_to?: string;
  search?: string;
  status?: string;
}

export interface SystemErrorLogFilters {
  page?: number;
  search?: string;
  level?: string;
  status?: 'open' | 'resolved' | '';
  organization_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
}

function queryString(filters: PlatformOrganizationFilters & PlatformDashboardFilters): string {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', String(filters.page));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_direction) params.set('sort_direction', filters.sort_direction);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);

  const query = params.toString();
  return query ? `?${query}` : '';
}

function cleanParams<T extends object>(filters: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export function usePlatformDashboard(filters: PlatformDashboardFilters = {}) {
  return useQuery({
    queryKey: ['platform', 'dashboard', filters],
    queryFn: () => api.get<PlatformDashboard>(`/platform/dashboard${queryString(filters)}`),
  });
}

export function usePlatformOrganizations(filters: PlatformOrganizationFilters) {
  return useQuery({
    queryKey: ['platform', 'organizations', filters],
    queryFn: () => api.get<Paginated<PlatformOrganizationSummary>>(`/platform/organizations${queryString(filters)}`),
  });
}

export function usePlatformOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'organizations', id],
    queryFn: () => api.get<PlatformOrganizationDetail>(`/platform/organizations/${id}`),
    enabled: Boolean(id),
  });
}

export function useSystemErrorLogSummary() {
  return useQuery({
    queryKey: ['platform', 'error-logs', 'summary'],
    queryFn: () => api.get<SystemErrorSummary>('/platform/error-logs/summary'),
  });
}

export function useSystemErrorLogs(filters: SystemErrorLogFilters) {
  return useQuery({
    queryKey: ['platform', 'error-logs', filters],
    queryFn: () => api.get<Paginated<SystemErrorLog>>('/platform/error-logs', { params: cleanParams(filters) }),
    placeholderData: (previous) => previous,
  });
}

export function useResolveSystemErrorLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      api.patch<{ message: string; error: SystemErrorLog }>(`/platform/error-logs/${id}/resolve`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'error-logs'] });
    },
  });
}

export function useUpdateOrganizationStatus(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { status: 'active' | 'suspended'; reason?: string }) =>
      api.patch<PlatformOrganizationDetail & { message: string }>(`/platform/organizations/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', id] });
    },
  });
}

export function usePlatformOrganizationVerificationDocuments(id: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'organizations', id, 'verification-documents'],
    queryFn: () =>
      api.get<{
        verification: OrganizationVerificationSummary;
        documents: { data: OrganizationVerificationDocument[] };
      }>(`/platform/organizations/${id}/verification-documents`),
    enabled: Boolean(id),
  });
}

export function useReviewOrganizationVerificationDocument(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      action,
      note,
    }: {
      documentId: number;
      action: 'approve' | 'reject' | 'request_changes';
      note?: string;
    }) =>
      api.patch<{
        document: OrganizationVerificationDocument;
        verification: OrganizationVerificationSummary;
      }>(`/platform/organizations/${organizationId}/verification-documents/${documentId}`, { action, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', organizationId, 'verification-documents'] });
    },
  });
}

export interface UpdateOrganizationModulePayload {
  status: 'active' | 'trial' | 'suspended';
  duration?: 'forever' | 'one_year' | 'custom';
  expires_at?: string;
}

export function useUpdateOrganizationModule(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ moduleId, ...payload }: UpdateOrganizationModulePayload & { moduleId: number }) =>
      api.patch<PlatformOrganizationDetail & { message: string }>(
        `/platform/organizations/${organizationId}/modules/${moduleId}`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', organizationId] });
    },
  });
}

export interface UpdateOrganizationWorkspacePayload {
  name?: string;
  support_email?: string | null;
  timezone?: string;
}

export function useUpdateOrganizationWorkspace(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateOrganizationWorkspacePayload) =>
      api.patch<PlatformOrganizationDetail & { message: string }>(
        `/platform/organizations/${organizationId}/workspace`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations', organizationId] });
    },
  });
}

export function usePlatformModuleCatalog() {
  return useQuery({
    queryKey: ['platform', 'modules'],
    queryFn: () => api.get<{ data: PlatformModuleCatalogEntry[] }>('/platform/modules'),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProvisionOrganizationPayload) =>
      api.post<ProvisionOrganizationResponse>('/platform/organizations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
    },
  });
}

export async function downloadPlatformOrganizationsCsv(
  filters: PlatformOrganizationFilters & PlatformDashboardFilters,
): Promise<void> {
  const response = await apiClient.get('/platform/organizations/export', {
    params: cleanParams(filters),
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `valtireo-organizations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
