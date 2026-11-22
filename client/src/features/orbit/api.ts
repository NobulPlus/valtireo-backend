import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiClient } from '@/lib/apiClient';

export interface OrbitWorkspace {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'private' | 'organization';
  archived_at: string | null;
  projects_count?: number;
  memberships_count?: number;
  viewer_role?: 'admin' | 'member' | null;
  can_administer?: boolean;
}

export interface OrbitStatus {
  id: number;
  project_id: number;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  position: number;
  is_default: boolean;
  wip_limit: number | null;
}

export interface OrbitProject {
  id: number;
  workspace_id: number;
  name: string;
  key_prefix: string;
  description: string | null;
  mode: 'kanban' | 'scrum' | 'simple';
  visibility: 'private' | 'organization';
  archived_at: string | null;
  statuses?: OrbitStatus[];
  labels?: OrbitLabel[];
  work_items_count?: number;
  overdue_count?: number;
  viewer_role?: 'admin' | 'contributor' | 'viewer' | null;
  can_administer?: boolean;
  can_edit_work_items?: boolean;
}

export interface OrbitLabel {
  id: number;
  project_id?: number;
  name: string;
  color: string;
}

export interface OrbitMember {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface OrbitPerson {
  id: number;
  name: string;
  email: string;
}

export interface OrbitWorkItem {
  id: number;
  project_id: number;
  key: string;
  type: 'epic' | 'story' | 'bug' | 'task' | 'subtask';
  title: string;
  description: string | null;
  status_id: number;
  status?: OrbitStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reporter_id: number;
  reporter?: { id: number; name: string } | null;
  assignee_id: number | null;
  assignee?: { id: number; name: string } | null;
  parent_id: number | null;
  parent?: { id: number; key: string; title: string } | null;
  epic_id: number | null;
  epic?: { id: number; key: string; title: string } | null;
  iteration_id: number | null;
  iteration?: { id: number; name: string } | null;
  labels?: OrbitLabel[];
  acceptance_criteria: string | null;
  definition_of_done: string | null;
  estimate: number | null;
  remaining_estimate: number | null;
  due_at: string | null;
  start_at: string | null;
  position: string;
  backlog_rank: string;
  version: number;
  archived_at: string | null;
  completed_at: string | null;
  completed_by: { id: number; name: string } | null;
  completion_note: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  status_changed_at: string | null;
  comments_count?: number;
  attachments_count?: number;
  attachments?: OrbitAttachment[];
  watchers?: { id: number; name: string }[];
  activities?: OrbitWorkItemActivity[];
}

export interface OrbitWorkItemActivity {
  id: number;
  event: string;
  title: string;
  actor?: { id: number; name: string } | null;
  created_at: string;
}

export interface OrbitIteration {
  id: number;
  project_id: number;
  name: string;
  goal: string | null;
  starts_at: string;
  ends_at: string;
  capacity_note: string | null;
  capacity_points: number | null;
  status: 'planned' | 'active' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  work_items_count?: number;
  work_items?: OrbitWorkItem[];
}

export interface OrbitComment {
  id: number;
  work_item_id: number;
  author_id: number;
  author?: { id: number; name: string };
  body: string;
  mentions: number[];
  reply_to_id: number | null;
  reply_to?: { id: number; body: string; author_id: number } | null;
  created_at: string;
  edited_at: string | null;
}

export interface OrbitWorkItemLink {
  id: number;
  linked_type: string;
  linked_id: number;
  label: string | null;
  url: string | null;
  viewer_can_access: boolean;
}

export const ORBIT_LINK_TYPES: { value: string; label: string }[] = [
  { value: 'ticket', label: 'Ticket' },
  { value: 'asset', label: 'Asset' },
  { value: 'document', label: 'Document' },
  { value: 'leave_request', label: 'Leave request' },
  { value: 'operation_task', label: 'Operation task' },
];

export interface OrbitAttachment {
  id: number;
  work_item_id: number | null;
  comment_id: number | null;
  uploaded_by_id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
  is_deliverable: boolean;
}

export function useOrbitWorkspaces() {
  return useQuery({
    queryKey: ['orbit', 'workspaces'],
    queryFn: () => api.get<{ data: OrbitWorkspace[] }>('/orbit/workspaces'),
  });
}

export function useCreateOrbitWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; visibility?: 'private' | 'organization' }) =>
      api.post<{ workspace: OrbitWorkspace }>('/orbit/workspaces', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces'] }),
  });
}

export function useOrbitWorkspace(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'workspaces', workspaceId],
    queryFn: () => api.get<{ workspace: OrbitWorkspace }>(`/orbit/workspaces/${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export function useOrbitProjects(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'workspaces', workspaceId, 'projects'],
    queryFn: () => api.get<{ data: OrbitProject[] }>(`/orbit/workspaces/${workspaceId}/projects`),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateOrbitProject(workspaceId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; key_prefix: string; mode: 'kanban' | 'scrum' | 'simple'; description?: string }) =>
      api.post<{ project: OrbitProject }>(`/orbit/workspaces/${workspaceId}/projects`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId, 'projects'] }),
  });
}

export function useOrbitProject(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId],
    queryFn: () => api.get<{ project: OrbitProject }>(`/orbit/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export interface OrbitVelocityEntry {
  id: number;
  label: string;
  value: number;
  completed_at: string | null;
}

export interface OrbitSprintSummaryEntry {
  iteration_id: number;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  committed_count: number;
  committed_points: number;
  done_count: number;
  done_points: number;
  carried_over_count: number;
  carried_over_points: number;
}

export interface OrbitCycleTimeByType {
  type: string;
  average_hours: number;
  sample_size: number;
}

export interface OrbitBurndownSeriesEntry {
  label: string;
  values: { ideal: number; actual: number };
}

export interface OrbitProjectReporting {
  generated_at: string;
  velocity: {
    entries: OrbitVelocityEntry[];
    average_points: number | null;
    median_points: number | null;
  };
  sprint_summary: OrbitSprintSummaryEntry[];
  cycle_time: {
    average_hours: number | null;
    median_hours: number | null;
    sample_size: number;
    by_type: OrbitCycleTimeByType[];
  };
  active_sprint_burndown: {
    iteration_id: number;
    name: string;
    starts_at: string | null;
    ends_at: string | null;
    total_points: number;
    series: OrbitBurndownSeriesEntry[];
    approximation_note: string;
  } | null;
}

export function useOrbitProjectReporting(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'reporting'],
    queryFn: () => api.get<{ data: OrbitProjectReporting }>(`/orbit/projects/${projectId}/reporting`),
    enabled: Boolean(projectId),
    select: (response) => response.data,
  });
}

export interface OrbitWorkItemFilters {
  status_id?: number;
  assignee_id?: number;
  type?: string;
  label_id?: number;
  epic_id?: number;
  iteration_id?: number | 'none';
  parent_id?: number | 'none';
  due_before?: string;
}

export function useOrbitWorkItems(projectId: number | undefined, filters: OrbitWorkItemFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'work-items', filters],
    queryFn: () => api.get<{ data: OrbitWorkItem[] }>(`/orbit/projects/${projectId}/work-items`, { params: filters }),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useCreateOrbitWorkItem(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      type: OrbitWorkItem['type'];
      title: string;
      description?: string;
      priority?: OrbitWorkItem['priority'];
      assignee_id?: number | null;
      status_id?: number;
      parent_id?: number | null;
      epic_id?: number | null;
      acceptance_criteria?: string;
      definition_of_done?: string;
      estimate?: number;
      due_at?: string;
      start_at?: string;
      label_ids?: number[];
      iteration_id?: number | null;
    }) =>
      api.post<{ work_item: OrbitWorkItem }>(`/orbit/projects/${projectId}/work-items`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] }),
  });
}

export function useOrbitWorkItem(key: string | undefined) {
  return useQuery({
    queryKey: ['orbit', 'work-items', key],
    queryFn: () => api.get<{ work_item: OrbitWorkItem }>(`/orbit/work-items/${key}`),
    enabled: Boolean(key),
  });
}

export function useMoveOrbitWorkItem(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, status_id, position, version, completion_note }: { key: string; status_id: number; position: string; version: number; completion_note?: string }) =>
      api.post<{ work_item: OrbitWorkItem }>(`/orbit/work-items/${key}/move`, { status_id, position, version, completion_note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] }),
  });
}

export function useSetWorkItemBlocked(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, is_blocked, blocked_reason }: { key: string; is_blocked: boolean; blocked_reason?: string | null }) =>
      api.patch<{ work_item: OrbitWorkItem }>(`/orbit/work-items/${key}/blocked`, { is_blocked, blocked_reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', variables.key] });
    },
  });
}

export function useReorderOrbitBacklogItem(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, backlog_rank, version }: { key: string; backlog_rank: string; version: number }) =>
      api.post<{ work_item: OrbitWorkItem }>(`/orbit/work-items/${key}/reorder-backlog`, { backlog_rank, version }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] }),
  });
}

export function useUpdateOrbitWorkItem(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...payload }: { key: string; version: number } & Record<string, unknown>) =>
      api.patch<{ work_item: OrbitWorkItem }>(`/orbit/work-items/${key}`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', variables.key] });
    },
  });
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
    mutationFn: (payload: { body: string; mentions?: number[]; reply_to_id?: number | null }) =>
      api.post<{ comment: OrbitComment }>(`/orbit/work-items/${key}/comments`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key, 'comments'] }),
  });
}

export function useWatchOrbitWorkItem(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/orbit/work-items/${key}/watch`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] }),
  });
}

export function useUnwatchOrbitWorkItem(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/orbit/work-items/${key}/watch`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] }),
  });
}

export function useOrbitWorkItemLinks(key: string | undefined) {
  return useQuery({
    queryKey: ['orbit', 'work-items', key, 'links'],
    queryFn: () => api.get<{ data: OrbitWorkItemLink[] }>(`/orbit/work-items/${key}/links`),
    enabled: Boolean(key),
  });
}

export function useMyOrbitWork(filter: string) {
  return useQuery({
    queryKey: ['orbit', 'my-work', filter],
    queryFn: () => api.get<{ data: Array<OrbitWorkItem & { project: { id: number; name: string }; reason: string }> }>('/orbit/my-work', { params: { filter } }),
  });
}

export function useOrbitPeople(search: string) {
  return useQuery({
    queryKey: ['orbit', 'people', search],
    queryFn: () => api.get<{ data: OrbitPerson[] }>('/orbit/people', { params: search ? { search } : undefined }),
  });
}

// --- Workspace membership & lifecycle -------------------------------------

export function useOrbitWorkspaceMembers(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'workspaces', workspaceId, 'members'],
    queryFn: () => api.get<{ data: OrbitMember[] }>(`/orbit/workspaces/${workspaceId}/members`),
    enabled: Boolean(workspaceId),
  });
}

export function useAddOrbitWorkspaceMember(workspaceId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: number; role: 'admin' | 'member' }) =>
      api.post(`/orbit/workspaces/${workspaceId}/members`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId, 'members'] }),
  });
}

export function useUpdateOrbitWorkspaceMember(workspaceId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'admin' | 'member' }) =>
      api.patch(`/orbit/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId, 'members'] }),
  });
}

export function useRemoveOrbitWorkspaceMember(workspaceId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.delete(`/orbit/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId, 'members'] }),
  });
}

export function useArchiveOrbitWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: number) => api.post<{ workspace: OrbitWorkspace }>(`/orbit/workspaces/${workspaceId}/archive`),
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces'] });
    },
  });
}

export function useRestoreOrbitWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: number) => api.post<{ workspace: OrbitWorkspace }>(`/orbit/workspaces/${workspaceId}/restore`),
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'workspaces'] });
    },
  });
}

// --- Project membership & lifecycle ---------------------------------------

export function useOrbitProjectMembers(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'members'],
    queryFn: () => api.get<{ data: OrbitMember[] }>(`/orbit/projects/${projectId}/members`),
    enabled: Boolean(projectId),
  });
}

export function useAddOrbitProjectMember(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: number; role: 'admin' | 'contributor' | 'viewer' }) =>
      api.post(`/orbit/projects/${projectId}/members`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'members'] }),
  });
}

export function useUpdateOrbitProjectMember(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'admin' | 'contributor' | 'viewer' }) =>
      api.patch(`/orbit/projects/${projectId}/members/${userId}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'members'] }),
  });
}

export function useRemoveOrbitProjectMember(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.delete(`/orbit/projects/${projectId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'members'] }),
  });
}

export function useArchiveOrbitProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => api.post<{ project: OrbitProject }>(`/orbit/projects/${projectId}/archive`),
    onSuccess: (_data, projectId) => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId] }),
  });
}

export function useRestoreOrbitProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => api.post<{ project: OrbitProject }>(`/orbit/projects/${projectId}/restore`),
    onSuccess: (_data, projectId) => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId] }),
  });
}

// --- Status (board column) configuration ----------------------------------

export function useOrbitStatuses(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'statuses'],
    queryFn: () => api.get<{ data: OrbitStatus[] }>(`/orbit/projects/${projectId}/statuses`),
    enabled: Boolean(projectId),
  });
}

export function useCreateOrbitStatus(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; category: 'todo' | 'in_progress' | 'done'; position?: number; wip_limit?: number | null }) =>
      api.post<{ status: OrbitStatus }>(`/orbit/projects/${projectId}/statuses`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId] });
    },
  });
}

export function useUpdateOrbitStatus(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statusId, ...payload }: { statusId: number } & Partial<Pick<OrbitStatus, 'name' | 'category' | 'position' | 'wip_limit'>>) =>
      api.patch<{ status: OrbitStatus }>(`/orbit/projects/${projectId}/statuses/${statusId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId] });
    },
  });
}

export function useDeleteOrbitStatus(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statusId: number) => api.delete(`/orbit/projects/${projectId}/statuses/${statusId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'statuses'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId] });
    },
  });
}

// --- Sprints (iterations) ---------------------------------------------------

export function useOrbitIterations(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'iterations'],
    queryFn: () => api.get<{ data: OrbitIteration[] }>(`/orbit/projects/${projectId}/iterations`),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useOrbitIteration(iterationId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'iterations', iterationId],
    queryFn: () => api.get<{ iteration: OrbitIteration }>(`/orbit/iterations/${iterationId}`),
    enabled: Boolean(iterationId),
  });
}

export function useCreateOrbitIteration(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; goal?: string; starts_at: string; ends_at: string; capacity_note?: string; capacity_points?: number }) =>
      api.post<{ iteration: OrbitIteration }>(`/orbit/projects/${projectId}/iterations`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'iterations'] }),
  });
}

export function useUpdateOrbitIteration(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ iterationId, ...payload }: { iterationId: number } & Partial<Pick<OrbitIteration, 'name' | 'goal' | 'starts_at' | 'ends_at' | 'capacity_note' | 'capacity_points'>>) =>
      api.patch<{ iteration: OrbitIteration }>(`/orbit/iterations/${iterationId}`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'iterations', variables.iterationId] });
    },
  });
}

export function useStartOrbitIteration(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (iterationId: number) => api.post<{ iteration: OrbitIteration }>(`/orbit/iterations/${iterationId}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'iterations'] }),
  });
}

export function useCompleteOrbitIteration(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ iterationId, carry_to_iteration_id }: { iterationId: number; carry_to_iteration_id?: number | null }) =>
      api.post<{ iteration: OrbitIteration }>(`/orbit/iterations/${iterationId}/complete`, { carry_to_iteration_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] });
    },
  });
}

export function useDeleteOrbitIteration(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (iterationId: number) => api.delete(`/orbit/iterations/${iterationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'iterations'] });
      queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'work-items'] });
    },
  });
}

// --- Label configuration ---------------------------------------------------

export function useOrbitLabels(projectId: number | undefined) {
  return useQuery({
    queryKey: ['orbit', 'projects', projectId, 'labels'],
    queryFn: () => api.get<{ data: OrbitLabel[] }>(`/orbit/projects/${projectId}/labels`),
    enabled: Boolean(projectId),
  });
}

export function useCreateOrbitLabel(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      api.post<{ label: OrbitLabel }>(`/orbit/projects/${projectId}/labels`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'labels'] }),
  });
}

export function useUpdateOrbitLabel(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, ...payload }: { labelId: number } & Partial<Pick<OrbitLabel, 'name' | 'color'>>) =>
      api.patch<{ label: OrbitLabel }>(`/orbit/projects/${projectId}/labels/${labelId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'labels'] }),
  });
}

export function useDeleteOrbitLabel(projectId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: number) => api.delete(`/orbit/projects/${projectId}/labels/${labelId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'projects', projectId, 'labels'] }),
  });
}

// --- Links -------------------------------------------------------------

export function useCreateOrbitWorkItemLink(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { linked_type: string; linked_id: number }) =>
      api.post<{ link: OrbitWorkItemLink }>(`/orbit/work-items/${key}/links`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key, 'links'] }),
  });
}

export function useDeleteOrbitWorkItemLink(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => api.delete(`/orbit/work-item-links/${linkId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key, 'links'] }),
  });
}

// --- Attachments -----------------------------------------------------------

export async function openOrbitAttachment(attachment: Pick<OrbitAttachment, 'id' | 'mime_type'>): Promise<void> {
  const response = await apiClient.get(`/orbit/attachments/${attachment.id}/file`, { responseType: 'blob' });
  const responseType = response.headers['content-type'];
  const blob = new Blob([response.data], {
    type: attachment.mime_type ?? (typeof responseType === 'string' ? responseType : 'application/octet-stream'),
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

export function useUploadOrbitWorkItemAttachment(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<{ attachment: OrbitAttachment }>(`/orbit/work-items/${key}/attachments`, formData);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] }),
  });
}

export function useSetAttachmentDeliverable(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, is_deliverable }: { attachmentId: number; is_deliverable: boolean }) =>
      api.patch<{ attachment: OrbitAttachment }>(`/orbit/attachments/${attachmentId}/deliverable`, { is_deliverable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] }),
  });
}

export function useDeleteOrbitAttachment(key: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: number) => api.delete(`/orbit/attachments/${attachmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orbit', 'work-items', key] }),
  });
}
