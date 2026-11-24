import { useMemo, useState, type FormEvent } from 'react';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatusBadge, toneClasses } from '@/components/ui/StatusBadge';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import { ApiError } from '@/lib/apiClient';
import {
  useCompleteOrbitIteration,
  useCreateOrbitIteration,
  useDeleteOrbitIteration,
  useOrbitIterations,
  useOrbitWorkItems,
  useStartOrbitIteration,
  useUpdateOrbitIteration,
  useUpdateOrbitWorkItem,
  type OrbitIteration,
  type OrbitProject,
  type OrbitWorkItem,
} from '@/features/orbit/api';

interface SprintFormState {
  name: string;
  goal: string;
  dateFrom: string;
  dateTo: string;
  capacityNote: string;
  capacityPoints: string;
}

const EMPTY_FORM: SprintFormState = { name: '', goal: '', dateFrom: '', dateTo: '', capacityNote: '', capacityPoints: '' };

function SprintForm({ value, onChange }: { value: SprintFormState; onChange: (next: SprintFormState) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" required>
        <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} autoFocus />
      </Field>
      <Field label="Dates" required>
        <DateRangePicker
          dateFrom={value.dateFrom}
          dateTo={value.dateTo}
          onChange={({ dateFrom, dateTo }) => onChange({ ...value, dateFrom, dateTo })}
        />
      </Field>
      <Field label="Goal" hint="Optional">
        <Textarea value={value.goal} onChange={(event) => onChange({ ...value, goal: event.target.value })} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Capacity (points)" hint="Optional">
          <Input type="number" min="0" step="0.5" value={value.capacityPoints} onChange={(event) => onChange({ ...value, capacityPoints: event.target.value })} />
        </Field>
        <Field label="Capacity note" hint="Optional — e.g. team availability">
          <Input value={value.capacityNote} onChange={(event) => onChange({ ...value, capacityNote: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function SprintPlanner({ project, iteration }: { project: OrbitProject; iteration: OrbitIteration }) {
  const { data: committedData, isLoading: committedLoading } = useOrbitWorkItems(project.id, { iteration_id: iteration.id });
  const { data: backlogData, isLoading: backlogLoading } = useOrbitWorkItems(project.id, { iteration_id: 'none', parent_id: 'none' });
  const updateItem = useUpdateOrbitWorkItem(project.id);
  const [error, setError] = useState<string | null>(null);
  const canEdit = Boolean(project.can_edit_work_items);

  const committed = committedData?.data ?? [];
  const backlog = backlogData?.data ?? [];
  const committedTotal = committed.reduce((sum, item) => sum + Number(item.estimate ?? 0), 0);
  const capacity = iteration.capacity_points;
  const overCapacity = capacity != null && committedTotal > capacity;

  async function moveItem(item: OrbitWorkItem, iterationId: number | null) {
    setError(null);
    try {
      await updateItem.mutateAsync({ key: item.key, version: item.version, iteration_id: iterationId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this item.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={cn('inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium', capacity != null ? toneClasses[overCapacity ? 'warning' : 'success'] : 'bg-surface-soft text-muted')}>
        {committedTotal} {capacity != null ? `/ ${capacity}` : ''} pts committed
      </span>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">In this sprint</h4>
          {committedLoading ? (
            <LoadingState />
          ) : committed.length === 0 ? (
            <p className="py-2 text-sm text-muted">No items planned yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {committed.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <span className="flex-shrink-0 text-xs text-muted">{item.key}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-strong">{item.title}</span>
                  {item.estimate != null && <span className="flex-shrink-0 text-xs text-muted">{item.estimate} pts</span>}
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Remove from sprint" onClick={() => void moveItem(item, null)} disabled={updateItem.isPending}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Backlog</h4>
          {backlogLoading ? (
            <LoadingState />
          ) : backlog.length === 0 ? (
            <p className="py-2 text-sm text-muted">Backlog is empty.</p>
          ) : (
            <ul className="divide-y divide-border">
              {backlog.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <span className="flex-shrink-0 text-xs text-muted">{item.key}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-strong">{item.title}</span>
                  {item.estimate != null && <span className="flex-shrink-0 text-xs text-muted">{item.estimate} pts</span>}
                  {canEdit && (
                    <Button variant="secondary" size="sm" onClick={() => void moveItem(item, iteration.id)} disabled={updateItem.isPending}>
                      Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SprintItems({ projectId, iterationId }: { projectId: number; iterationId: number }) {
  const { data, isLoading } = useOrbitWorkItems(projectId);
  const items = useMemo(() => (data?.data ?? []).filter((item) => item.iteration_id === iterationId), [data, iterationId]);

  if (isLoading) return <LoadingState />;
  if (items.length === 0) return <p className="py-2 text-sm text-muted">No items in this sprint yet.</p>;

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-2">
          <span className="flex-shrink-0 text-xs text-muted">{item.key}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-strong">{item.title}</span>
          <StatusBadge status={item.status?.category} />
        </li>
      ))}
    </ul>
  );
}

function SprintCard({
  iteration,
  project,
  plannedSprints,
  onEdit,
}: {
  iteration: OrbitIteration;
  project: OrbitProject;
  plannedSprints: OrbitIteration[];
  onEdit: () => void;
}) {
  const { formatDate } = useDateFormatter();
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [carryTo, setCarryTo] = useState('backlog');
  const [error, setError] = useState<string | null>(null);

  const startMutation = useStartOrbitIteration(project.id);
  const completeMutation = useCompleteOrbitIteration(project.id);
  const deleteMutation = useDeleteOrbitIteration(project.id);

  const carryOptions = [
    { value: 'backlog', label: 'Backlog' },
    ...plannedSprints.filter((sprint) => sprint.id !== iteration.id).map((sprint) => ({ value: String(sprint.id), label: sprint.name })),
  ];

  async function handleStart() {
    setError(null);
    try {
      await startMutation.mutateAsync(iteration.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start this sprint.');
    }
  }

  async function handleComplete() {
    setError(null);
    try {
      await completeMutation.mutateAsync({
        iterationId: iteration.id,
        carry_to_iteration_id: carryTo === 'backlog' ? null : Number(carryTo),
      });
      setCompleting(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this sprint.');
    }
  }

  function handleDelete() {
    if (window.confirm(`Delete "${iteration.name}"? This cannot be undone.`)) {
      void deleteMutation.mutateAsync(iteration.id);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left" onClick={() => setExpanded((current) => !current)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-strong">{iteration.name}</span>
            <StatusBadge status={iteration.status} />
          </div>
          <span className="text-xs text-muted">
            {formatDate(iteration.starts_at)} – {formatDate(iteration.ends_at)} · {iteration.work_items_count ?? 0} item{iteration.work_items_count === 1 ? '' : 's'}
          </span>
          {iteration.goal && <span className="text-xs text-muted">{iteration.goal}</span>}
        </button>

        <div className="flex flex-shrink-0 items-center gap-2">
          {project.can_edit_work_items && iteration.status === 'planned' && (
            <Button variant="secondary" size="sm" onClick={handleStart} isLoading={startMutation.isPending}>
              Start sprint
            </Button>
          )}
          {project.can_edit_work_items && iteration.status === 'active' && (
            <Button variant="primary" size="sm" onClick={() => setCompleting(true)}>
              Complete sprint
            </Button>
          )}
          {project.can_administer && iteration.status === 'planned' && (
            <Dropdown
              trigger={({ toggle }) => (
                <Button variant="ghost" size="icon" aria-label="Sprint actions" onClick={toggle}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              )}
            >
              <DropdownMenuItem onClick={onEdit}>Edit sprint</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-danger">
                Delete sprint
              </DropdownMenuItem>
            </Dropdown>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {expanded && (
        <div className="mt-3 border-t border-border pt-2">
          {iteration.status === 'planned' ? (
            <SprintPlanner project={project} iteration={iteration} />
          ) : (
            <SprintItems projectId={project.id} iterationId={iteration.id} />
          )}
        </div>
      )}

      <Modal
        open={completing}
        onClose={() => setCompleting(false)}
        title="Complete sprint"
        footer={
          <>
            <ModalCancelAction onClick={() => setCompleting(false)} disabled={completeMutation.isPending} />
            <ModalConfirmAction onClick={handleComplete} isLoading={completeMutation.isPending} title="Complete sprint" />
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Unfinished items will move to:</p>
          <SelectMenu value={carryTo} onChange={setCarryTo} options={carryOptions} />
        </div>
      </Modal>
    </div>
  );
}

export function OrbitSprintsPanel({ project }: { project: OrbitProject }) {
  const { data, isLoading } = useOrbitIterations(project.id);
  const iterations = data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrbitIteration | null>(null);
  const [form, setForm] = useState<SprintFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateOrbitIteration(project.id);
  const updateMutation = useUpdateOrbitIteration(project.id);

  const active = iterations.filter((iteration) => iteration.status === 'active');
  const planned = iterations.filter((iteration) => iteration.status === 'planned');
  const completed = iterations.filter((iteration) => iteration.status === 'completed');

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(iteration: OrbitIteration) {
    setEditing(iteration);
    setForm({
      name: iteration.name,
      goal: iteration.goal ?? '',
      dateFrom: iteration.starts_at,
      dateTo: iteration.ends_at,
      capacityNote: iteration.capacity_note ?? '',
      capacityPoints: iteration.capacity_points != null ? String(iteration.capacity_points) : '',
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      goal: form.goal || undefined,
      starts_at: form.dateFrom,
      ends_at: form.dateTo,
      capacity_note: form.capacityNote || undefined,
      capacity_points: form.capacityPoints ? Number(form.capacityPoints) : undefined,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ iterationId: editing.id, ...payload });
        setEditing(null);
      } else {
        await createMutation.mutateAsync(payload);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this sprint.');
    }
  }

  if (isLoading) return <LoadingState fill />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        {project.can_administer && (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New sprint
          </Button>
        )}
      </div>

      {iterations.length === 0 && <p className="text-sm text-muted">No sprints yet. Create one to start planning.</p>}

      {[...active, ...planned].length > 0 && (
        <div className="flex flex-col gap-3">
          {[...active, ...planned].map((iteration) => (
            <SprintCard key={iteration.id} iteration={iteration} project={project} plannedSprints={planned} onEdit={() => openEdit(iteration)} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Completed</h3>
          <div className="flex flex-col gap-3">
            {completed.map((iteration) => (
              <SprintCard key={iteration.id} iteration={iteration} project={project} plannedSprints={planned} onEdit={() => openEdit(iteration)} />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={open || Boolean(editing)}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit sprint' : 'New sprint'}
        footer={
          <>
            <ModalCancelAction
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <ModalSaveAction form="orbit-sprint-form" isLoading={createMutation.isPending || updateMutation.isPending} disabled={!form.name.trim() || !form.dateFrom || !form.dateTo} />
          </>
        }
      >
        <form id="orbit-sprint-form" onSubmit={handleSubmit}>
          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          <SprintForm value={form} onChange={setForm} />
        </form>
      </Modal>
    </div>
  );
}
