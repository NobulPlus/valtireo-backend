import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { EmployeeCustomFieldDefinition, EmployeeCustomFieldType } from '@/types/api';

interface ResourceEnvelope<T> {
  data: T;
}

/**
 * Admins (anyone with employees.view) get every field, active or not — the
 * backend only trims to visible-and-active for non-managers, which doesn't
 * apply here since this hook is only ever enabled for managers.
 */
export function useCustomFields() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['employee-custom-fields'],
    queryFn: () => api.get<ResourceEnvelope<EmployeeCustomFieldDefinition[]>>('/employee-profile/custom-fields'),
    enabled: hasPermission('employees.view'),
    select: (response) => response.data,
  });
}

export interface CustomFieldPayload {
  name: string;
  key: string;
  type: EmployeeCustomFieldType;
  options?: string[];
  is_required?: boolean;
  visible_to_employee?: boolean;
  editable_by_employee?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomFieldPayload) =>
      api.post<{ custom_field: EmployeeCustomFieldDefinition }>('/employee-profile/custom-fields', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-custom-fields'] });
    },
  });
}

export function useUpdateCustomField(fieldId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CustomFieldPayload>) =>
      api.patch<{ custom_field: EmployeeCustomFieldDefinition }>(`/employee-profile/custom-fields/${fieldId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-custom-fields'] });
    },
  });
}

/** Row-level activate/deactivate toggle — separate from useUpdateCustomField since that hook binds one fixed field id at construction time (fine inside the single-field editor modal, wrong for a per-row table action). */
export function useSetCustomFieldActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, isActive }: { fieldId: number; isActive: boolean }) =>
      api.patch<{ custom_field: EmployeeCustomFieldDefinition }>(`/employee-profile/custom-fields/${fieldId}`, {
        is_active: isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-custom-fields'] });
    },
  });
}
