import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LabelDots } from '@/components/ui/LabelDots';
import { LoadingState } from '@/components/ui/States';
import { ApiError } from '@/lib/apiClient';
import {
  useOrbitIterations,
  useOrbitProjectMembers,
  useOrbitWorkItems,
  useUpdateOrbitWorkItem,
  type OrbitProject,
  type OrbitWorkItem,
} from '@/features/orbit/api';

const EPIC_FILTERS = { type: 'epic', parent_id: 'none' } as const;

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'story', label: 'Stories' },
  { value: 'bug', label: 'Bugs' },
  { value: 'task', label: 'Tasks' },
  { value: 'subtask', label: 'Subtasks' },
];

function BacklogRow({
  item,
  sprintOptions,
  canEdit,
  onOpen,
}: {
  item: OrbitWorkItem;
  sprintOptions: Array<{ value: string; label: string }>;
  canEdit: boolean;
  onOpen: (key: string) => void;
}) {
  const updateItem = useUpdateOrbitWorkItem(item.project_id);
  const [error, setError] = useState<string | null>(null);

  async function moveToSprint(value: string) {
    setError(null);
    try {
      await updateItem.mutateAsync({ key: item.key, version: item.version, iteration_id: Number(value) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move this item to the sprint.');
    }
  }

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-center gap-3 px-3 py-3">
        <button type="button" onClick={() => onOpen(item.key)} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-shrink-0 text-xs text-muted">{item.key}</span>
            <span className="min-w-0 truncate text-sm font-medium text-strong">{item.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="capitalize">{item.type}</span>
            {item.assignee && <span>{item.assignee.name}</span>}
            {item.estimate != null && <span>{item.estimate} estimate</span>}
            <LabelDots labels={item.labels} />
          </div>
        </button>
        <PriorityBadge priority={item.priority} />
        {item.status && <StatusBadge status={item.status.category} />}
        {canEdit && sprintOptions.length > 0 && (
          <div className="w-44">
            <SelectMenu value="" onChange={(value) => value && void moveToSprint(value)} options={[{ value: '', label: 'Move to sprint' }, ...sprintOptions]} disabled={updateItem.isPending} />
          </div>
        )}
      </div>
      {error && <p className="px-3 pb-3 text-xs text-danger">{error}</p>}
    </li>
  );
}

export function OrbitBacklogPanel({
  project,
  onOpenItem,
  onAddItem,
}: {
  project: OrbitProject;
  onOpenItem: (key: string) => void;
  onAddItem: (epicId?: number) => void;
}) {
  const [type, setType] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const filters = useMemo(
    () => ({ iteration_id: 'none' as const, parent_id: 'none' as const, ...(type ? { type } : {}), ...(assigneeId ? { assignee_id: Number(assigneeId) } : {}) }),
    [assigneeId, type],
  );
  const { data, isLoading } = useOrbitWorkItems(project.id, filters);
  const { data: epicsData } = useOrbitWorkItems(project.id, EPIC_FILTERS);
  const { data: membersData } = useOrbitProjectMembers(project.id);
  const { data: iterationsData } = useOrbitIterations(project.id);

  const items = useMemo(() => data?.data ?? [], [data]);
  // Fetched unconditionally (not subject to the type/assignee filters above) so that
  // selecting e.g. "Stories" still shows the epic headers those stories group under —
  // the filtered item list alone would otherwise drop the epic record itself.
  const epics = useMemo(() => epicsData?.data ?? [], [epicsData]);
  const members = membersData?.data ?? [];
  const sprintOptions = (iterationsData?.data ?? [])
    .filter((iteration) => iteration.status !== 'completed')
    .map((iteration) => ({ value: String(iteration.id), label: iteration.status === 'active' ? `${iteration.name} (active)` : iteration.name }));

  const { grouped, ungrouped } = useMemo(() => {
    const byEpic = new Map<number, OrbitWorkItem[]>();
    const withoutEpic: OrbitWorkItem[] = [];

    for (const item of items) {
      if (item.type === 'epic') continue;
      if (item.epic_id) {
        byEpic.set(item.epic_id, [...(byEpic.get(item.epic_id) ?? []), item]);
      } else {
        withoutEpic.push(item);
      }
    }

    return { grouped: byEpic, ungrouped: withoutEpic };
  }, [items]);

  const filterActive = Boolean(type || assigneeId);
  const visibleEpics = epics.filter((epic) => !filterActive || (grouped.get(epic.id)?.length ?? 0) > 0);

  const assigneeOptions = [{ value: '', label: 'All assignees' }, ...members.map((member) => ({ value: String(member.id), label: member.name }))];

  if (isLoading) return <LoadingState fill />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="w-44"><SelectMenu value={type} onChange={setType} options={TYPE_OPTIONS} /></div>
        <div className="w-52"><SelectMenu value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} /></div>
        <p className="ml-auto text-xs text-muted">Unscheduled top-level work. Move ready work into a sprint.</p>
      </div>

      {items.length === 0 && <p className="py-8 text-center text-sm text-muted">No unscheduled backlog items match these filters.</p>}

      {visibleEpics.map((epic) => (
        <section key={epic.id} className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 bg-surface-soft px-4 py-3">
            <button type="button" onClick={() => onOpenItem(epic.key)} className="min-w-0 text-left">
              <p className="text-xs text-muted">{epic.key} · Epic</p>
              <h3 className="truncate text-sm font-semibold text-strong">{epic.title}</h3>
            </button>
            {project.can_edit_work_items && <Button size="sm" variant="secondary" onClick={() => onAddItem(epic.id)}><Plus className="h-3.5 w-3.5" /> Add item</Button>}
          </div>
          <ul>
            {(grouped.get(epic.id) ?? []).map((item) => <BacklogRow key={item.id} item={item} sprintOptions={sprintOptions} canEdit={Boolean(project.can_edit_work_items)} onOpen={onOpenItem} />)}
            {(grouped.get(epic.id) ?? []).length === 0 && <li className="px-4 py-3 text-sm text-muted">No unscheduled items under this epic.</li>}
          </ul>
        </section>
      ))}

      {(ungrouped.length > 0 || epics.length === 0) && (
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 bg-surface-soft px-4 py-3">
            <h3 className="text-sm font-semibold text-strong">No epic</h3>
            {project.can_edit_work_items && <Button size="sm" variant="secondary" onClick={() => onAddItem()}><Plus className="h-3.5 w-3.5" /> Add item</Button>}
          </div>
          <ul>
            {ungrouped.map((item) => <BacklogRow key={item.id} item={item} sprintOptions={sprintOptions} canEdit={Boolean(project.can_edit_work_items)} onOpen={onOpenItem} />)}
            {ungrouped.length === 0 && <li className="px-4 py-3 text-sm text-muted">No ungrouped backlog items.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
