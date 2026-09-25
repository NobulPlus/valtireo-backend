import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { AllSetupLookups, OrganizationVerificationDocument, OrganizationVerificationSummary, SetupChecklist, WorkspaceSettings } from '@/types/api';

type OrganizationVerificationDocumentsResponse =
  | OrganizationVerificationDocument[]
  | { data?: OrganizationVerificationDocument[] };

export function useWorkspace() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.get<{ workspace: WorkspaceSettings }>('/workspace'),
    enabled: hasPermission('workspace_settings.view'),
  });
}

export function useSetupChecklist() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['setup', 'checklist'],
    queryFn: () => api.get<SetupChecklist>('/setup/checklist'),
    enabled: hasPermission('workspace_settings.update'),
  });
}

/** All setup lookups in one call — used to populate form dropdowns/filters. */
export function useSetupLookups() {
  return useQuery({
    queryKey: ['setup', 'lookups'],
    queryFn: () => api.get<AllSetupLookups>('/setup/lookups'),
    staleTime: 5 * 60_000,
  });
}

export function useUploadWorkspaceLogo() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      return api.post<{ workspace: WorkspaceSettings }>('/workspace/identity/logo', formData);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await refresh();
    },
  });
}

export function useRemoveWorkspaceLogo() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: () => api.delete<{ workspace: WorkspaceSettings }>('/workspace/identity/logo'),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await refresh();
    },
  });
}

export function useOrganizationVerification() {
  return useQuery({
    queryKey: ['organization-verification'],
    queryFn: () =>
      api.get<{
        verification: OrganizationVerificationSummary;
        documents: OrganizationVerificationDocumentsResponse;
      }>('/organization-verification'),
  });
}

export interface UploadOrganizationVerificationDocumentPayload {
  document_type: string;
  title: string;
  notes?: string;
  file: File;
}

export function useUploadOrganizationVerificationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadOrganizationVerificationDocumentPayload) => {
      const formData = new FormData();
      formData.append('document_type', payload.document_type);
      formData.append('title', payload.title);
      if (payload.notes) formData.append('notes', payload.notes);
      formData.append('file', payload.file);
      return api.post<{
        document: OrganizationVerificationDocument;
        verification: OrganizationVerificationSummary;
      }>('/organization-verification/documents', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-verification'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'checklist'] });
    },
  });
}

export function useSubmitOrganizationVerification() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: () => api.post<{ message: string; verification: OrganizationVerificationSummary }>('/organization-verification/submit'),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['organization-verification'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'checklist'] });
      await refresh();
    },
  });
}
