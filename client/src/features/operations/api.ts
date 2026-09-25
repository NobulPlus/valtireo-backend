import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type {
  LaravelPage,
  OperationAutomationAction,
  OperationAutomationCondition,
  OperationAutomationRule,
  OperationAutomationRun,
  OperationAutomationTrigger,
  OperationsAutomationCatalog,
  OperationsSignal,
  OperationsSummary,
  OperationTask,
  OperationTaskPriority,
  OperationTaskStatus,
} from '@/types/api';

const KEY = ['operations'] as const;

export interface OperationTaskFilters {
  status?: OperationTaskStatus;
  category?: string;
  priority?: OperationTaskPriority;
  assigned_user_id?: number;
  search?: string;
  due_from?: string;
  due_to?: string;
  sort?: 'created_at' | 'due_at' | 'priority' | 'status' | 'title';
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export function useOperationsCenter(filters: OperationTaskFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'center', filters],
    queryFn: () =>
      api.get<{ summary: OperationsSummary; signals: OperationsSignal[]; tasks: LaravelPage<OperationTask> }>('/operations/center', {
        params: filters,
      }),
    placeholderData: (previous) => previous,
  });
}

export interface OperationsLookups {
  assignable_users: Array<{ id: number; name: string; email: string; employee_number: string | null; employee_status: string | null }>;
  subject_employees: Array<{ id: number; employee_number: string; first_name: string; last_name: string }>;
}

export function useOperationsLookups(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'lookups'],
    queryFn: () => api.get<OperationsLookups>('/operations/lookups'),
    enabled,
    staleTime: 60_000,
  });
}

export interface OperationTaskPayload {
  title: string;
  description?: string | null;
  category?: string;
  priority?: OperationTaskPriority;
  assigned_user_id?: number | null;
  subject_employee_id?: number | null;
  due_at?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function useCreateOperationTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OperationTaskPayload) => api.post<{ task: OperationTask }>('/operations/tasks', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'center'] }),
  });
}

export function useUpdateOperationTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<OperationTaskPayload>) =>
      api.patch<{ task: OperationTask }>(`/operations/tasks/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'center'] }),
  });
}

export type OperationTaskLifecycleAction = 'start' | 'complete' | 'reopen' | 'cancel';

export function useOperationTaskAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: OperationTaskLifecycleAction }) =>
      api.post<{ task: OperationTask }>(`/operations/tasks/${id}/actions`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'center'] }),
  });
}

export function useAutomationCatalog() {
  return useQuery({
    queryKey: [...KEY, 'automation-catalog'],
    queryFn: () => api.get<OperationsAutomationCatalog>('/operations/automation-catalog'),
    staleTime: Infinity,
  });
}

export function useAutomationRules() {
  return useQuery({
    queryKey: [...KEY, 'automation-rules'],
    queryFn: () => api.get<{ data: LaravelPage<OperationAutomationRule> }>('/operations/automation-rules'),
    select: (response) => response.data,
  });
}

export interface AutomationRulePayload {
  name: string;
  trigger: OperationAutomationTrigger;
  conditions?: OperationAutomationCondition[];
  actions: OperationAutomationAction[];
  is_active?: boolean;
  execution_order?: number;
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AutomationRulePayload) => api.post<{ rule: OperationAutomationRule }>('/operations/automation-rules', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'automation-rules'] }),
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<AutomationRulePayload>) =>
      api.patch<{ rule: OperationAutomationRule }>(`/operations/automation-rules/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'automation-rules'] }),
  });
}

export function useAutomationRuns(page = 1) {
  return useQuery({
    queryKey: [...KEY, 'automation-runs', page],
    queryFn: () => api.get<LaravelPage<OperationAutomationRun>>('/operations/automation-runs', { params: { page } }),
    placeholderData: (previous) => previous,
  });
}
