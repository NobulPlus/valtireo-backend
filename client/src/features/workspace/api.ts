import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { AllSetupLookups, SetupChecklist, WorkspaceSettings } from '@/types/api';

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
