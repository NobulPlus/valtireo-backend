import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Dependent, EmergencyContact, EmployeeDocument, EmployeeProfileOverview, EmployeeProfileSummary } from '../../types/api';
import type { RNFile } from '../leave/api';

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
  passport_photo?: RNFile | null;
}

/** PHP doesn't reliably parse multipart on a true PATCH, so this sends a `_method` override, matching the web client. */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: (payload: UpdateMyProfilePayload) => {
      const formData = new FormData();
      formData.append('_method', 'PATCH');
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'passport_photo') return;
        if (value === undefined) return;
        // Laravel's ConvertEmptyStringsToNull middleware turns "" back into null server-side, so an
        // explicit clear (null here) must still be sent — omitting the key entirely leaves the old value.
        formData.append(key, value === null ? '' : String(value));
      });
      if (payload.passport_photo) formData.append('passport_photo', payload.passport_photo as unknown as Blob);

      return api.post<{ profile: EmployeeProfileSummary }>('/me/employee-profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (response) => {
      queryClient.setQueryData<EmployeeProfileOverview>(OVERVIEW_KEY, (previous) => previous ? { ...previous, profile: response.profile } : previous);
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
      // The home screen reads session.user.photo_url from AuthContext, not either query above.
      void refresh();
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
  file: RNFile;
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
      formData.append('file', payload.file as unknown as Blob);
      if (payload.issued_at) formData.append('issued_at', payload.issued_at);
      if (payload.expires_at) formData.append('expires_at', payload.expires_at);
      if (payload.notes) formData.append('notes', payload.notes);

      return api.post<{ document: EmployeeDocument }>('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
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
  file: RNFile;
  notes?: string;
}

export function useSubmitSignedCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, file, notes }: SubmitSignedCopyPayload) => {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);
      if (notes) formData.append('notes', notes);

      return api.post<{ document: EmployeeDocument }>(`/documents/${documentId}/signed-copy`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'me'] });
    },
  });
}

/**
 * Emergency contacts and dependents — the backend has had full CRUD for
 * these since the web self-service profile shipped; mobile's profile screen
 * never called any of it even though useMyProfileOverview() already returns
 * both lists. These hooks close that gap.
 */
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
    mutationFn: (payload: EmergencyContactPayload) => api.post<{ emergency_contact: EmergencyContact }>('/employee-profile/emergency-contacts', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useUpdateEmergencyContact(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<EmergencyContactPayload>) => api.patch<{ emergency_contact: EmergencyContact }>(`/employee-profile/emergency-contacts/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useDeleteEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ message: string }>(`/employee-profile/emergency-contacts/${id}`),
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

export function useUpdateDependent(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<DependentPayload>) => api.patch<{ dependent: Dependent }>(`/employee-profile/dependents/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useDeleteDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ message: string }>(`/employee-profile/dependents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}
