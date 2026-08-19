import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { Permission, Role } from '@/types/api';

interface ResourceEnvelope<T> {
  data: T;
}

export function useRoles() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<ResourceEnvelope<Role[]>>('/roles'),
    enabled: hasPermission('roles.view'),
    select: (response) => response.data,
  });
}

/** The global permission catalog — powers the role permission-picker. */
export function usePermissionCatalog() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<ResourceEnvelope<Permission[]>>('/permissions'),
    enabled: hasPermission('roles.create') || hasPermission('roles.update'),
    select: (response) => response.data,
    staleTime: 5 * 60_000,
  });
}

export interface RolePayload {
  name: string;
  description?: string | null;
  permission_names: string[];
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RolePayload) => api.post<{ role: Role }>('/roles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useUpdateRole(roleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<RolePayload>) => api.patch<{ role: Role }>(`/roles/${roleId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => api.delete(`/roles/${roleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}
