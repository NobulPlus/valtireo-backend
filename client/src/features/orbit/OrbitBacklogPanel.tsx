import { useMemo, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LabelDots } from '@/components/ui/LabelDots';
import { LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/apiClient';
import { computeDropPosition } from '@/features/orbit/positionMath';
import {
  useOrbitIterations,
  useOrbitProjectMembers,
  useOrbitWorkItems,
  useReorderOrbitBacklogItem,
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

function groupKeyFor(item: OrbitWorkItem): string {
  return item.epic_id ? String(item.epic_id) : 'none';
}

function BacklogRow({
  item,
  groupKey,
  sprintOptions,
  canEdit,
  onOpen,
}: {
  item: OrbitWorkItem;
  groupKey: string;
  sprintOptions: Array<{ value: string; label: string }>;
  canEdit: boolean;
  onOpen: (key: string) => void;
}) {
  const updateItem = useUpdateOrbitWorkItem(item.project_id);
  const [error, setError] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', group: groupKey },
    disabled: !canEdit,
  });

  async function moveToSprint(value: string) {
    setError(null);
    try {
      await updateItem.mutateAsync({ key: item.key, version: item.version, iteration_id: Number(value) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move this item to the sprint.');
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start border-t border-border first:border-t-0', isDragging && 'opacity-40')}
    >
      {canEdit && (
        <button
          type="button"
          className="mt-3 flex-shrink-0 touch-none px-2 py-3 text-muted hover:text-strong"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3 py-3 pr-3">
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
        {error && <p className="pb-3 pr-3 text-xs text-danger">{error}</p>}
      </div>
    </li>
  );
}

function BacklogGroupList({
  groupKey,
  items,
  sprintOptions,
  canEdit,
  onOpen,
  emptyLabel,
}: {
  groupKey: string;
  items: OrbitWorkItem[];
  sprintOptions: Array<{ value: string; label: string }>;
  canEdit: boolean;
  onOpen: (key: string) => void;
  emptyLabel: string;
}) {
  const { setNodeRef } = useDroppable({ id: `backlog-group-${groupKey}`, data: { type: 'group', group: groupKey } });

  return (
    <ul ref={setNodeRef}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <BacklogRow key={item.id} item={item} groupKey={groupKey} sprintOptions={sprintOptions} canEdit={canEdit} onOpen={onOpen} />
        ))}
      </SortableContext>
      {items.length === 0 && <li className="px-4 py-3 text-sm text-muted">{emptyLabel}</li>}
    </ul>
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
  const [reorderError, setReorderError] = useState<string | null>(null);
  const filters = useMemo(
    () => ({ iteration_id: 'none' as const, parent_id: 'none' as const, ...(type ? { type } : {}), ...(assigneeId ? { assignee_id: Number(assigneeId) } : {}) }),
    [assigneeId, type],
  );
  const { data, isLoading } = useOrbitWorkItems(project.id, filters);
  const { data: epicsData } = useOrbitWorkItems(project.id, EPIC_FILTERS);
  const { data: membersData } = useOrbitProjectMembers(project.id);
  const { data: iterationsData } = useOrbitIterations(project.id);
  const reorderItem = useReorderOrbitBacklogItem(project.id);

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

    for (const list of byEpic.values()) {
      list.sort((a, b) => Number(a.backlog_rank) - Number(b.backlog_rank));
    }
    withoutEpic.sort((a, b) => Number(a.backlog_rank) - Number(b.backlog_rank));

    return { grouped: byEpic, ungrouped: withoutEpic };
  }, [items]);

  const filterActive = Boolean(type || assigneeId);
  const visibleEpics = epics.filter((epic) => !filterActive || (grouped.get(epic.id)?.length ?? 0) > 0);

  const assigneeOptions = [{ value: '', label: 'All assignees' }, ...members.map((member) => ({ value: String(member.id), label: member.name }))];
  const canEdit = Boolean(project.can_edit_work_items);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function persistReorder(item: OrbitWorkItem, backlogRank: string) {
    setReorderError(null);
    try {
      await reorderItem.mutateAsync({ key: item.key, backlog_rank: backlogRank, version: item.version });
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : 'Could not reorder this item.');
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeItem = items.find((candidate) => candidate.id === active.id);
    if (!activeItem) return;

    const overData = over.data.current as { type: 'item' | 'group'; group: string } | undefined;
    if (!overData) return;

    const activeGroup = groupKeyFor(activeItem);
    if (overData.group !== activeGroup) return; // epic groups are separate drop scopes — a drag can't reassign an item's epic

    const siblings = items
      .filter((candidate) => candidate.id !== activeItem.id && groupKeyFor(candidate) === activeGroup)
      .map((candidate) => ({ id: candidate.id, rank: candidate.backlog_rank }));
    const overId = overData.type === 'item' ? Number(over.id) : null;
    const backlogRank = computeDropPosition(siblings, overId);

    if (Number(backlogRank) === Number(activeItem.backlog_rank)) return;
    void persistReorder(activeItem, backlogRank);
  }

  if (isLoading) return <LoadingState fill />;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
          <div className="w-44"><SelectMenu value={type} onChange={setType} options={TYPE_OPTIONS} /></div>
          <div className="w-52"><SelectMenu value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} /></div>
          <p className="ml-auto text-xs text-muted">Unscheduled top-level work. Drag to reorder, or move into a sprint.</p>
        </div>

        {reorderError && <p className="text-sm text-danger">{reorderError}</p>}
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted">No unscheduled backlog items match these filters.</p>}

        {visibleEpics.map((epic) => (
          <section key={epic.id} className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 bg-surface-soft px-4 py-3">
              <button type="button" onClick={() => onOpenItem(epic.key)} className="min-w-0 text-left">
                <p className="text-xs text-muted">{epic.key} · Epic</p>
                <h3 className="truncate text-sm font-semibold text-strong">{epic.title}</h3>
              </button>
              {canEdit && <Button size="sm" variant="secondary" onClick={() => onAddItem(epic.id)}><Plus className="h-3.5 w-3.5" /> Add item</Button>}
            </div>
            <BacklogGroupList
              groupKey={String(epic.id)}
              items={grouped.get(epic.id) ?? []}
              sprintOptions={sprintOptions}
              canEdit={canEdit}
              onOpen={onOpenItem}
              emptyLabel="No unscheduled items under this epic."
            />
          </section>
        ))}

        {(ungrouped.length > 0 || epics.length === 0) && (
          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 bg-surface-soft px-4 py-3">
              <h3 className="text-sm font-semibold text-strong">No epic</h3>
              {canEdit && <Button size="sm" variant="secondary" onClick={() => onAddItem()}><Plus className="h-3.5 w-3.5" /> Add item</Button>}
            </div>
            <BacklogGroupList
              groupKey="none"
              items={ungrouped}
              sprintOptions={sprintOptions}
              canEdit={canEdit}
              onOpen={onOpenItem}
              emptyLabel="No ungrouped backlog items."
            />
          </section>
        )}
      </div>
    </DndContext>
  );
}
