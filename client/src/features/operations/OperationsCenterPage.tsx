import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { RequirePermission } from '@/components/shell/RequirePermission';
import {
  useAutomationCatalog,
  useAutomationRules,
  useAutomationRuns,
  useCreateAutomationRule,
  useCreateOperationTask,
  useOperationsCenter,
  useOperationsLookups,
  useOperationTaskAction,
  useUpdateAutomationRule,
  useUpdateOperationTask,
  type AutomationRulePayload,
  type OperationTaskFilters,
  type OperationTaskLifecycleAction,
  type OperationTaskPayload,
} from '@/features/operations/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type {
  OperationAutomationAction,
  OperationAutomationCondition,
  OperationAutomationRule,
  OperationAutomationTrigger,
  OperationTask,
  OperationTaskPriority,
  OperationTaskStatus,
} from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type Tab = 'tasks' | 'automation';

const TASK_STATUS_OPTIONS: Array<{ value: OperationTaskStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: Array<{ value: OperationTaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const LIFECYCLE_ACTIONS: Record<OperationTaskStatus, OperationTaskLifecycleAction[]> = {
  open: ['start', 'complete', 'cancel'],
  in_progress: ['complete', 'cancel'],
  completed: ['reopen'],
  cancelled: ['reopen'],
};

const ACTION_ICON: Record<OperationTaskLifecycleAction, typeof Play> = {
  start: Play,
  complete: CheckCircle2,
  reopen: RotateCcw,
  cancel: Ban,
};

const ACTION_LABEL: Record<OperationTaskLifecycleAction, string> = {
  start: 'Start',
  complete: 'Complete',
  reopen: 'Reopen',
  cancel: 'Cancel',
};

// ---------------------------------------------------------------------------
// Tasks tab
// ---------------------------------------------------------------------------

function TaskModal({ task, onClose }: { task: OperationTask | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = task === 'new';
  const open = task !== null;
  const createMutation = useCreateOperationTask();
  const updateMutation = useUpdateOperationTask();
  const lookupsQuery = useOperationsLookups(open);
  const userOptions = (lookupsQuery.data?.assignable_users ?? []).map((user) => ({
    value: String(user.id),
    label: user.employee_number ? `${user.name} · ${user.employee_number}` : `${user.name} · ${user.email}`,
  }));

  const [title, setTitle] = useState(task && task !== 'new' ? task.title : '');
  const [description, setDescription] = useState(task && task !== 'new' ? (task.description ?? '') : '');
  const [category, setCategory] = useState(task && task !== 'new' ? task.category : 'general');
  const [priority, setPriority] = useState<OperationTaskPriority>(task && task !== 'new' ? task.priority : 'normal');
  const [assignedUserId, setAssignedUserId] = useState(task && task !== 'new' && task.assigned_user_id ? String(task.assigned_user_id) : '');
  const [subjectEmployeeId, setSubjectEmployeeId] = useState(
    task && task !== 'new' && task.subject_employee_id ? String(task.subject_employee_id) : '',
  );
  const [dueAt, setDueAt] = useState(task && task !== 'new' && task.due_at ? task.due_at.slice(0, 10) : '');
  const [actionUrl, setActionUrl] = useState(task && task !== 'new' ? (task.action_url ?? '') : '');

  useEffect(() => {
    setTitle(task && task !== 'new' ? task.title : '');
    setDescription(task && task !== 'new' ? (task.description ?? '') : '');
    setCategory(task && task !== 'new' ? task.category : 'general');
    setPriority(task && task !== 'new' ? task.priority : 'normal');
    setAssignedUserId(task && task !== 'new' && task.assigned_user_id ? String(task.assigned_user_id) : '');
    setSubjectEmployeeId(task && task !== 'new' && task.subject_employee_id ? String(task.subject_employee_id) : '');
    setDueAt(task && task !== 'new' && task.due_at ? task.due_at.slice(0, 10) : '');
    setActionUrl(task && task !== 'new' ? (task.action_url ?? '') : '');
  }, [task]);

  async function handleSubmit() {
    if (!title.trim()) return;
    const payload: OperationTaskPayload = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || 'general',
      priority,
      assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
      subject_employee_id: subjectEmployeeId ? Number(subjectEmployeeId) : null,
      due_at: dueAt || null,
      action_url: actionUrl.trim() || null,
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Task created');
      } else if (task) {
        await updateMutation.mutateAsync({ id: task.id, ...payload });
        toast.success('Task updated');
      }
      onClose();
    } catch (error) {
      toast.error('Could not save task', actionError(error, 'Could not save this task.'));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Create task' : 'Edit task'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={isPending} disabled={!title.trim()} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Verify onboarding documents" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Description</span>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="general" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Priority</span>
            <SelectMenu value={priority} onChange={(value) => setPriority(value as OperationTaskPriority)} options={PRIORITY_OPTIONS} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Assign to</span>
          <SelectMenu
            value={assignedUserId}
            onChange={setAssignedUserId}
            searchable
            options={[{ value: '', label: 'Unassigned' }, ...userOptions]}
            placeholder="Select a user"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Subject employee (optional)</span>
          <SelectMenu
            value={subjectEmployeeId}
            onChange={setSubjectEmployeeId}
            searchable
            options={[
              { value: '', label: 'None' },
              ...(lookupsQuery.data?.subject_employees ?? []).map((employee) => ({
                value: String(employee.id),
                label: `${employee.first_name} ${employee.last_name} · ${employee.employee_number}`,
              })),
            ]}
            placeholder="Select an employee"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Due date</span>
            <DatePicker value={dueAt} onChange={setDueAt} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Link (optional)</span>
            <Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="/employees/123" />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function TasksTab() {
  const toast = useToast();
  const { session, hasPermission } = useAuth();
  const { formatDate } = useDateFormatter();
  const canManage = hasPermission('operations.manage');

  const [status, setStatus] = useState<OperationTaskStatus | ''>('');
  const [priority, setPriority] = useState<OperationTaskPriority | ''>('');
  const [search, setSearch] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);
  const [taskModal, setTaskModal] = useState<OperationTask | 'new' | null>(null);

  const filters: OperationTaskFilters = {
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
    assigned_user_id: assignedToMe && session ? session.user.id : undefined,
    page,
  };
  const centerQuery = useOperationsCenter(filters);
  const actionMutation = useOperationTaskAction();

  const summary = centerQuery.data?.summary;
  const signals = centerQuery.data?.signals ?? [];
  const tasks = centerQuery.data?.tasks.data ?? [];

  async function handleAction(task: OperationTask, action: OperationTaskLifecycleAction) {
    try {
      await actionMutation.mutateAsync({ id: task.id, action });
      toast.success(`Task ${action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : action === 'reopen' ? 'reopened' : 'started'}`);
    } catch (error) {
      toast.error('Could not update task', actionError(error, 'Could not update this task.'));
    }
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Open" value={summary.open} icon={ClipboardList} />
          <StatTile label="Overdue" value={summary.overdue} tone={summary.overdue > 0 ? 'danger' : 'default'} />
          <StatTile label="Due soon" value={summary.due_soon} tone={summary.due_soon > 0 ? 'warning' : 'default'} />
          <StatTile label="Critical" value={summary.critical} tone={summary.critical > 0 ? 'danger' : 'default'} />
          <StatTile label="Assigned to me" value={summary.assigned_to_me} />
        </div>
      )}

      {signals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {signals.map((signal) => (
                <li key={signal.key} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${signal.severity === 'critical' ? 'text-danger' : 'text-warning'}`} />
                    <span className="text-strong">{signal.title}</span>
                    <span className="font-semibold text-strong">({signal.count})</span>
                  </div>
                  <Link to={signal.actionUrl} className="flex items-center gap-1 text-xs font-medium text-teal hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search tasks…"
            className="w-56"
          />
          <SelectMenu
            value={status}
            onChange={(value) => {
              setStatus(value as OperationTaskStatus | '');
              setPage(1);
            }}
            options={TASK_STATUS_OPTIONS}
            className="w-40"
          />
          <SelectMenu
            value={priority}
            onChange={(value) => {
              setPriority(value as OperationTaskPriority | '');
              setPage(1);
            }}
            options={[{ value: '', label: 'All priorities' }, ...PRIORITY_OPTIONS]}
            className="w-40"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(e) => {
                setAssignedToMe(e.target.checked);
                setPage(1);
              }}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Assigned to me
          </label>
        </div>
        {canManage && (
          <Button type="button" variant="primary" onClick={() => setTaskModal('new')}>
            <Plus className="h-3.5 w-3.5" /> Create task
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {centerQuery.isLoading && <LoadingState label="Loading tasks…" />}
          {centerQuery.isError && <ErrorState error={centerQuery.error} onRetry={() => centerQuery.refetch()} />}
          {centerQuery.data && tasks.length === 0 && (
            <EmptyState title="No tasks found" description="Operational tasks assigned to you or your team will appear here." />
          )}
          {tasks.length > 0 && (
            <ul className="divide-y divide-border">
              {tasks.map((task) => {
                const isOverdue = task.due_at && ['open', 'in_progress'].includes(task.status) && new Date(task.due_at) < new Date();
                const canAct = canManage || task.assigned_user_id === session?.user.id;
                const availableActions = LIFECYCLE_ACTIONS[task.status] ?? [];
                return (
                  <li key={task.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-strong">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {task.category} · {task.assigned_user?.name ?? 'Unassigned'}
                        {task.subject_employee ? ` · ${task.subject_employee.first_name} ${task.subject_employee.last_name}` : ''}
                        {task.due_at ? ` · due ${formatDate(task.due_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {isOverdue && <StatusBadge status="critical" />}
                      <StatusBadge status={task.priority} />
                      <StatusBadge status={task.status} />
                      {canManage && (
                        <Button type="button" size="icon" variant="ghost" title="Edit task" aria-label="Edit task" onClick={() => setTaskModal(task)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canAct &&
                        availableActions.map((action) => {
                          const Icon = ACTION_ICON[action];
                          return (
                            <Button
                              key={action}
                              type="button"
                              size="icon"
                              variant="ghost"
                              title={ACTION_LABEL[action]}
                              aria-label={ACTION_LABEL[action]}
                              isLoading={actionMutation.isPending}
                              onClick={() => handleAction(task, action)}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </Button>
                          );
                        })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {centerQuery.data && <Pagination meta={centerQuery.data.tasks} onPageChange={setPage} />}
        </CardBody>
      </Card>

      <TaskModal task={taskModal} onClose={() => setTaskModal(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation tab
// ---------------------------------------------------------------------------

function ConditionsEditor({
  conditions,
  operators,
  onChange,
}: {
  conditions: OperationAutomationCondition[];
  operators: string[];
  onChange: (conditions: OperationAutomationCondition[]) => void;
}) {
  function update(index: number, patch: Partial<OperationAutomationCondition>) {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function remove(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...conditions, { field: '', operator: 'equals', value: '' }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Conditions (optional — all must match)</span>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add condition
        </Button>
      </div>
      {conditions.length === 0 && <p className="mt-1 text-xs text-muted">No conditions — this rule fires on every occurrence of the trigger.</p>}
      {conditions.length > 0 && (
        <div className="mt-2 space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2">
              <SelectMenu
                value={condition.field}
                onChange={(value) => update(index, { field: value })}
                searchable
                options={[
                  { value: 'context.new_status', label: 'New employee status' },
                  { value: 'context.previous_status', label: 'Previous employee status' },
                  { value: 'context.new_confirmation_status', label: 'New confirmation status' },
                  { value: 'context.previous_confirmation_status', label: 'Previous confirmation status' },
                  { value: 'subject.department_id', label: 'Employee department ID' },
                  { value: 'subject.employment_type_id', label: 'Employee employment type ID' },
                ]}
                placeholder="Select a condition field"
                className="flex-1"
              />
              <SelectMenu
                value={condition.operator}
                onChange={(value) => update(index, { operator: value as OperationAutomationCondition['operator'] })}
                options={operators.map((op) => ({ value: op, label: op.replaceAll('_', ' ') }))}
                className="w-36 flex-shrink-0"
              />
              {condition.operator !== 'present' && (
                <Input
                  value={typeof condition.value === 'string' ? condition.value : String(condition.value ?? '')}
                  onChange={(e) => update(index, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1"
                />
              )}
              <Button type="button" size="icon" variant="ghost" title="Remove condition" aria-label="Remove condition" onClick={() => remove(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionsEditor({
  actions,
  userOptions,
  onChange,
}: {
  actions: OperationAutomationAction[];
  userOptions: Array<{ value: string; label: string }>;
  onChange: (actions: OperationAutomationAction[]) => void;
}) {
  function update(index: number, patch: Partial<OperationAutomationAction>) {
    onChange(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function remove(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...actions, { type: 'create_task', title: '', priority: 'normal' }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Actions</span>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add action
        </Button>
      </div>
      <div className="mt-2 space-y-3">
        {actions.map((action, index) => (
          <div key={index} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <SelectMenu
                value={action.type}
                onChange={(value) => update(index, { type: value as OperationAutomationAction['type'] })}
                options={[
                  { value: 'create_task', label: 'Create a task' },
                  { value: 'notify_user', label: 'Notify a user' },
                ]}
                className="w-48"
              />
              <Button type="button" size="icon" variant="ghost" title="Remove action" aria-label="Remove action" onClick={() => remove(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <Input
                value={action.title ?? ''}
                onChange={(e) => update(index, { title: e.target.value })}
                placeholder="Title (supports {{subject.field}} and {{context.field}})"
              />
              {action.type === 'create_task' ? (
                <>
                  <Textarea
                    value={action.description ?? ''}
                    onChange={(e) => update(index, { description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={action.category ?? ''} onChange={(e) => update(index, { category: e.target.value })} placeholder="Category" />
                    <SelectMenu
                      value={action.priority ?? 'normal'}
                      onChange={(value) => update(index, { priority: value as OperationTaskPriority })}
                      options={PRIORITY_OPTIONS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SelectMenu
                      value={action.assigned_user_id !== undefined && action.assigned_user_id !== null ? String(action.assigned_user_id) : ''}
                      onChange={(value) => update(index, { assigned_user_id: value || null })}
                      searchable
                      options={[
                        { value: '', label: 'Leave unassigned' },
                        { value: 'context.assigned_user_id', label: 'The affected employee' },
                        { value: 'context.actor_user_id', label: 'The user who made the change' },
                        ...userOptions,
                      ]}
                      placeholder="Assign task to"
                    />
                    <SelectMenu
                      value={action.subject_employee_id !== undefined && action.subject_employee_id !== null ? String(action.subject_employee_id) : ''}
                      onChange={(value) => update(index, { subject_employee_id: value || null })}
                      options={[
                        { value: '', label: 'No subject employee' },
                        { value: 'context.subject_employee_id', label: 'The affected employee' },
                      ]}
                      placeholder="Subject employee"
                    />
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={action.due_in_days ?? ''}
                    onChange={(e) => update(index, { due_in_days: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Due in N days (optional)"
                  />
                </>
              ) : (
                <>
                  <SelectMenu
                    value={action.user_id !== undefined && action.user_id !== null ? String(action.user_id) : ''}
                    onChange={(value) => update(index, { user_id: value || null })}
                    searchable
                    options={[
                      { value: 'context.assigned_user_id', label: 'The affected employee' },
                      { value: 'context.actor_user_id', label: 'The user who made the change' },
                      ...userOptions,
                    ]}
                    placeholder="Choose notification recipient"
                  />
                  <Textarea value={action.message ?? ''} onChange={(e) => update(index, { message: e.target.value })} placeholder="Message" rows={2} />
                  <SelectMenu
                    value={action.severity ?? 'info'}
                    onChange={(value) => update(index, { severity: value as OperationAutomationAction['severity'] })}
                    options={[
                      { value: 'info', label: 'Info' },
                      { value: 'success', label: 'Success' },
                      { value: 'warning', label: 'Warning' },
                      { value: 'critical', label: 'Critical' },
                    ]}
                  />
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input value={action.action_label ?? ''} onChange={(e) => update(index, { action_label: e.target.value })} placeholder="Link label (optional)" />
                <Input value={action.action_url ?? ''} onChange={(e) => update(index, { action_url: e.target.value })} placeholder="Link URL (optional)" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationRuleModal({ rule, onClose }: { rule: OperationAutomationRule | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = rule === 'new';
  const open = rule !== null;
  const catalogQuery = useAutomationCatalog();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const lookupsQuery = useOperationsLookups(open);
  const userOptions = (lookupsQuery.data?.assignable_users ?? []).map((user) => ({
    value: String(user.id),
    label: user.employee_number ? `${user.name} · ${user.employee_number}` : `${user.name} · ${user.email}`,
  }));

  const [name, setName] = useState(rule && rule !== 'new' ? rule.name : '');
  const [trigger, setTrigger] = useState<OperationAutomationTrigger>(rule && rule !== 'new' ? rule.trigger : 'employee.status_changed');
  const [isActive, setIsActive] = useState(rule && rule !== 'new' ? rule.is_active : true);
  const [executionOrder, setExecutionOrder] = useState(rule && rule !== 'new' ? String(rule.execution_order) : '100');
  const [conditions, setConditions] = useState<OperationAutomationCondition[]>(rule && rule !== 'new' ? (rule.conditions ?? []) : []);
  const [actions, setActions] = useState<OperationAutomationAction[]>(
    rule && rule !== 'new' ? rule.actions : [{ type: 'create_task', title: '', priority: 'normal' }],
  );

  useEffect(() => {
    setName(rule && rule !== 'new' ? rule.name : '');
    setTrigger(rule && rule !== 'new' ? rule.trigger : 'employee.status_changed');
    setIsActive(rule && rule !== 'new' ? rule.is_active : true);
    setExecutionOrder(rule && rule !== 'new' ? String(rule.execution_order) : '100');
    setConditions(rule && rule !== 'new' ? (rule.conditions ?? []) : []);
    setActions(rule && rule !== 'new' ? rule.actions : [{ type: 'create_task', title: '', priority: 'normal' }]);
  }, [rule]);

  async function handleSubmit() {
    if (!name.trim() || actions.length === 0) return;
    const payload: AutomationRulePayload = {
      name: name.trim(),
      trigger,
      conditions,
      actions,
      is_active: isActive,
      execution_order: Number(executionOrder) || 100,
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Automation rule created');
      } else if (rule) {
        await updateMutation.mutateAsync({ id: rule.id, ...payload });
        toast.success('Automation rule updated');
      }
      onClose();
    } catch (error) {
      toast.error('Could not save rule', actionError(error, 'Could not save this automation rule.'));
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Create automation rule' : 'Edit automation rule'}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={isPending} disabled={!name.trim() || actions.length === 0} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome task on activation" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Trigger</span>
            <SelectMenu
              value={trigger}
              onChange={(value) => setTrigger(value as OperationAutomationTrigger)}
              options={(catalogQuery.data?.triggers ?? ['employee.status_changed', 'employee.activated', 'employee.exited']).map((t) => ({
                value: t,
                label: t.replaceAll('.', ' → ').replaceAll('_', ' '),
              }))}
            />
          </label>
        </div>

        <ConditionsEditor conditions={conditions} operators={catalogQuery.data?.condition_operators ?? ['equals', 'not_equals', 'in', 'not_in', 'present']} onChange={setConditions} />
        <ActionsEditor actions={actions} userOptions={userOptions} onChange={setActions} />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
            <span className="text-muted">Active</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Execution order</span>
            <Input type="number" min={1} className="w-20" value={executionOrder} onChange={(e) => setExecutionOrder(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function AutomationTab() {
  const toast = useToast();
  const { formatDateTime } = useDateFormatter();
  const rulesQuery = useAutomationRules();
  const [runsPage, setRunsPage] = useState(1);
  const runsQuery = useAutomationRuns(runsPage);
  const [ruleModal, setRuleModal] = useState<OperationAutomationRule | 'new' | null>(null);
  const toggleMutation = useUpdateAutomationRule();

  const rules = rulesQuery.data?.data ?? [];
  const runs = runsQuery.data?.data ?? [];

  async function toggleActive(rule: OperationAutomationRule) {
    try {
      await toggleMutation.mutateAsync({ id: rule.id, is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated');
    } catch (error) {
      toast.error('Could not update rule', actionError(error, 'Could not update this rule.'));
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" /> Automation rules
            </span>
          </CardTitle>
          <Button type="button" size="sm" onClick={() => setRuleModal('new')}>
            <Plus className="h-3.5 w-3.5" /> Create rule
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          {rulesQuery.isLoading && <LoadingState label="Loading automation rules…" />}
          {rulesQuery.isError && <ErrorState error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />}
          {rulesQuery.data && rules.length === 0 && (
            <EmptyState title="No automation rules yet" description="Rules react to employee lifecycle events by creating tasks or sending notifications." />
          )}
          {rules.length > 0 && (
            <ul className="divide-y divide-border">
              {rules.map((rule) => (
                <li key={rule.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{rule.name}</p>
                    <p className="text-xs text-muted">
                      {rule.trigger} · {rule.actions.length} action{rule.actions.length === 1 ? '' : 's'} · {rule.runs_count ?? 0} run
                      {(rule.runs_count ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={rule.is_active ? 'active' : 'inactive'} />
                    <Button type="button" size="sm" variant="secondary" onClick={() => toggleActive(rule)} isLoading={toggleMutation.isPending}>
                      {rule.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" title="Edit rule" aria-label="Edit rule" onClick={() => setRuleModal(rule)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation runs</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {runsQuery.isLoading && <LoadingState label="Loading run history…" />}
          {runsQuery.isError && <ErrorState error={runsQuery.error} onRetry={() => runsQuery.refetch()} />}
          {runsQuery.data && runs.length === 0 && <EmptyState title="No automation runs yet" description="Each time a trigger fires, its outcome is recorded here." />}
          {runs.length > 0 && (
            <ul className="divide-y divide-border">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{run.rule?.name ?? `Rule #${run.operation_automation_rule_id}`}</p>
                    <p className="text-xs text-muted">
                      {run.trigger} · {formatDateTime(run.started_at)}
                      {run.error ? ` · ${run.error}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={run.status} />
                </li>
              ))}
            </ul>
          )}
          {runsQuery.data && <Pagination meta={runsQuery.data} onPageChange={setRunsPage} />}
        </CardBody>
      </Card>

      <AutomationRuleModal rule={ruleModal} onClose={() => setRuleModal(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

function OperationsCenterContent() {
  const { hasPermission } = useAuth();
  const canConfigure = hasPermission('operations.configure');
  const [tab, setTab] = useState<Tab>('tasks');

  return (
    <div>
      <PageHeader title="Operations centre" subtitle="Operational tasks, cross-module signals, and lifecycle automation." />
      {canConfigure && (
        <div className="mb-5 inline-flex flex-wrap gap-1 rounded-md border border-border p-1">
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'tasks' ? 'bg-teal text-white' : 'text-muted hover:text-strong'}`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setTab('automation')}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'automation' ? 'bg-teal text-white' : 'text-muted hover:text-strong'}`}
          >
            Automation
          </button>
        </div>
      )}
      {tab === 'tasks' || !canConfigure ? <TasksTab /> : <AutomationTab />}
    </div>
  );
}

export function OperationsCenterPage() {
  return (
    <RequirePermission permission="operations.view">
      <OperationsCenterContent />
    </RequirePermission>
  );
}
