import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export interface OrbitWorkItemSummary {
  id: number;
  key: string;
  title: string;
  type: string;
  priority: string;
  status: { id: number; name: string; category: string } | null;
  due_at: string | null;
  project: { id: number; name: string } | null;
  reason: string;
}

export function useMyOrbitWork(filter: string) {
  return useQuery({
    queryKey: ['orbit', 'my-work', filter],
    queryFn: () => api.get<{ data: OrbitWorkItemSummary[] }>('/orbit/my-work', { params: { filter } }),
  });
}

export interface OrbitWorkItemDetail {
  id: number;
  key: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status_id: number;
  status: { id: number; name: string } | null;
  project_id: number;
  version: number;
}

export function useOrbitWorkItem(key: string | undefined) {
  return useQuery({
    queryKey: ['orbit', 'work-items', key],
    queryFn: () => api.get<{ work_item: OrbitWorkItemDetail }>(`/orbit/work-items/${key}`),
    enabled: Boolean(key),
  });
}

export interface OrbitComment {
  id: number;
  body: string;
  author?: { id: number; name: string };
  created_at: string;
}

export function useOrbitComments(key: string | undefined) {
  return useQuery({
    queryKey: ['orbit', 'work-items', key, 'comments'],
    queryFn: () => api.get<{ data: OrbitComment[] }>(`/orbit/work-items/${key}/comments`),
    enabled: Boolean(key),
  });
}

export function useCreateOrbitComment(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<{ comment: OrbitComment }>(`/orbit/work-items/${key}/comments`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key, 'comments'] }),
  });
}

export interface OrbitStatusOption {
  id: number;
  name: string;
  category: string;
}

export function useOrbitStatuses(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'statuses'],
    queryFn: () => api.get<{ data: OrbitStatusOption[] }>(`/orbit/projects/${projectId}/statuses`),
    enabled: Boolean(projectId),
  });
}

export interface OrbitWorkspaceSummary {
  id: number;
  name: string;
  description: string | null;
  visibility: 'private' | 'organization';
  projects_count?: number;
  memberships_count?: number;
}

export function useOrbitWorkspaces() {
  return useQuery({
    queryKey: ['orbit', 'workspaces'],
    queryFn: () => api.get<{ data: OrbitWorkspaceSummary[] }>('/orbit/workspaces'),
  });
}

export interface OrbitProjectSummary {
  id: number;
  workspace_id: number;
  name: string;
  key_prefix: string;
  description: string | null;
  mode: 'kanban' | 'scrum' | 'simple';
  work_items_count?: number;
  overdue_count?: number;
}

export function useOrbitProjects(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'workspaces', workspaceId, 'projects'],
    queryFn: () => api.get<{ data: OrbitProjectSummary[] }>(`/orbit/workspaces/${workspaceId}/projects`),
    enabled: Boolean(workspaceId),
  });
}

export interface OrbitProjectDetail extends OrbitProjectSummary {
  statuses: OrbitStatusOption[];
  can_edit_work_items?: boolean;
}

export function useOrbitProject(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId],
    queryFn: () => api.get<{ project: OrbitProjectDetail }>(`/orbit/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export interface OrbitWorkItemSummaryForBoard {
  id: number;
  key: string;
  title: string;
  type: string;
  priority: string;
  status_id: number;
  assignee?: { id: number; name: string } | null;
  due_at: string | null;
}

export function useOrbitWorkItems(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'work-items'],
    queryFn: () => api.get<{ data: OrbitWorkItemSummaryForBoard[] }>(`/orbit/projects/${projectId}/work-items`),
    enabled: Boolean(projectId),
  });
}

export function useCreateOrbitWorkItem(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { type: string; title: string; description?: string; priority?: string; status_id?: number }) =>
      api.post<{ work_item: OrbitWorkItemSummaryForBoard }>(`/orbit/projects/${projectId}/work-items`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] }),
  });
}

export function useMoveOrbitWorkItem(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status_id, position, version }: { status_id: number; position: string; version: number }) =>
      api.post<{ work_item: OrbitWorkItemDetail }>(`/orbit/work-items/${key}/move`, { status_id, position, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'my-work'] });
    },
  });
}
