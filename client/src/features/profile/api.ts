import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { Dependent, EmergencyContact, EmployeeDocument, EmployeeProfileOverview } from '@/types/api';

const OVERVIEW_KEY = ['profile', 'overview'];

export function useMyProfileOverview() {
  return useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => api.get<EmployeeProfileOverview>('/employee-profile/overview'),
    retry: false,
  });
}

export interface UpdateMyProfilePayload {
  date_of_birth?: string | null;
  gender?: string | null;
  personal_email?: string | null;
  residential_address?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  passport_photo?: File | null;
}

/**
 * PHP does not reliably parse multipart bodies on a true PATCH request, so
 * this posts with a `_method` override field (standard Laravel convention)
 * instead of sending a real PATCH — mirrors the org-logo upload endpoint's
 * POST-not-PATCH choice earlier this session, for the same reason.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMyProfilePayload) => {
      const formData = new FormData();
      formData.append('_method', 'PATCH');
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'passport_photo') return;
        if (value !== undefined && value !== null) formData.append(key, String(value));
      });
      if (payload.passport_photo) formData.append('passport_photo', payload.passport_photo);

      return api.post('/me/employee-profile', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export function useMyDocumentTypes() {
  return useQuery({
    queryKey: ['documents', 'types', 'mine'],
    queryFn: () => api.get<{ data: { id: number; name: string; code: string | null }[] }>('/documents/types?per_page=100'),
    staleTime: 5 * 60_000,
  });
}

export interface SubmitMyDocumentPayload {
  document_type_id: number;
  title: string;
  file: File;
  issued_at?: string;
  expires_at?: string;
  notes?: string;
}

export function useSubmitMyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitMyDocumentPayload) => {
      const formData = new FormData();
      formData.append('document_type_id', String(payload.document_type_id));
      formData.append('title', payload.title);
      formData.append('file', payload.file);
      if (payload.issued_at) formData.append('issued_at', payload.issued_at);
      if (payload.expires_at) formData.append('expires_at', payload.expires_at);
      if (payload.notes) formData.append('notes', payload.notes);

      return api.post<{ document: EmployeeDocument }>('/documents', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
  });
}

export function useAcknowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => api.patch<{ document: EmployeeDocument }>(`/documents/${documentId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export interface SubmitSignedCopyPayload {
  documentId: number;
  file: File;
  notes?: string;
}

export function useSubmitSignedCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, file, notes }: SubmitSignedCopyPayload) => {
      const formData = new FormData();
      formData.append('file', file);
      if (notes) formData.append('notes', notes);

      return api.post<{ document: EmployeeDocument }>(`/documents/${documentId}/signed-copy`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

export interface EmergencyContactPayload {
  name: string;
  relationship?: string | null;
  phone: string;
  alternate_phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_primary?: boolean;
}

export function useCreateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmergencyContactPayload) =>
      api.post<{ emergency_contact: EmergencyContact }>('/employee-profile/emergency-contacts', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useUpdateEmergencyContact(contactId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmergencyContactPayload) =>
      api.patch<{ emergency_contact: EmergencyContact }>(`/employee-profile/emergency-contacts/${contactId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useDeleteEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) => api.delete(`/employee-profile/emergency-contacts/${contactId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export interface DependentPayload {
  name: string;
  relationship: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_beneficiary?: boolean;
}

export function useCreateDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DependentPayload) => api.post<{ dependent: Dependent }>('/employee-profile/dependents', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useUpdateDependent(dependentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DependentPayload) =>
      api.patch<{ dependent: Dependent }>(`/employee-profile/dependents/${dependentId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useDeleteDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependentId: number) => api.delete(`/employee-profile/dependents/${dependentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useUpdateMyCustomFieldValues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: { key: string; value: unknown }[]) =>
      api.put<{ custom_field_values: unknown[] }>('/employee-profile/custom-field-values', { values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}
