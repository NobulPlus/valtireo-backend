import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Settings } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import {
  useCreateOrbitWorkItem,
  useMoveOrbitWorkItem,
  useOrbitProject,
  useOrbitWorkItems,
  type OrbitStatus,
  type OrbitWorkItem,
} from '@/features/orbit/api';
import { ApiError } from '@/lib/apiClient';
import { OrbitWorkItemDetailModal } from '@/features/orbit/OrbitWorkItemDetailModal';
import { OrbitProjectSettingsModal } from '@/features/orbit/OrbitProjectSettingsModal';

const TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'story', label: 'Story' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** Midpoint-insertion position math mirroring OrbitBoardOrderingService::between() on the server — the server is the source of truth (it re-derives nothing from this value beyond storing it), this just picks a sensible number to send. */
function computeDropPosition(columnItems: OrbitWorkItem[], overId: number | null): string {
  const sorted = [...columnItems].sort((a, b) => Number(a.position) - Number(b.position));
  const appendToEnd = () => String((sorted.length ? Number(sorted[sorted.length - 1].position) : 0) + 1024);

  if (overId === null) return appendToEnd();

  const overIndex = sorted.findIndex((item) => item.id === overId);
  if (overIndex === -1) return appendToEnd();

  const afterPos = Number(sorted[overIndex].position);
  const beforePos = overIndex > 0 ? Number(sorted[overIndex - 1].position) : null;

  if (beforePos === null) return String(afterPos / 2);

  const mid = (beforePos + afterPos) / 2;
  if (mid <= beforePos || mid >= afterPos) return appendToEnd();

  return String(mid);
}

function WorkItemCard({ item, onOpen }: { item: OrbitWorkItem; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', statusId: item.status_id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-md border border-border bg-surface p-3 shadow-sm', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onOpen}
        onPointerDown={(event) => event.stopPropagation()}
        className="block w-full text-left text-sm font-medium text-strong hover:underline"
      >
        <span className="mr-1 text-xs text-muted">{item.key}</span>
        {item.title}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={item.priority} />
        {item.assignee && <span className="text-xs text-muted">{item.assignee.name}</span>}
      </div>
    </div>
  );
}

function StatusColumn({
  status,
  items,
  onOpenItem,
  onMoveViaDropdown,
  allStatuses,
}: {
  status: OrbitStatus;
  items: OrbitWorkItem[];
  onOpenItem: (key: string) => void;
  onMoveViaDropdown: (item: OrbitWorkItem, statusId: number) => void;
  allStatuses: OrbitStatus[];
}) {
  const { setNodeRef } = useDroppable({ id: `column-${status.id}`, data: { type: 'column', statusId: status.id } });
  const sorted = [...items].sort((a, b) => Number(a.position) - Number(b.position));

  return (
    <div ref={setNodeRef} className="flex w-72 flex-shrink-0 flex-col rounded-lg border border-border bg-surface-soft">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-semibold text-strong">{status.name}</p>
        <span className="text-xs text-muted">{sorted.length}</span>
      </div>
      <SortableContext items={sorted.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[2rem] flex-col gap-2 px-2 pb-2">
          {sorted.map((item) => (
            <div key={item.id}>
              <WorkItemCard item={item} onOpen={() => onOpenItem(item.key)} />
              {allStatuses.length > 1 && (
                <select
                  value={item.status_id}
                  onChange={(event) => onMoveViaDropdown(item, Number(event.target.value))}
                  aria-label={`Move ${item.key} to a different column`}
                  className="mt-1 h-7 w-full rounded border border-border bg-surface px-1 text-xs text-muted"
                >
                  {allStatuses.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      Move to: {candidate.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function OrbitProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const { data: projectData } = useOrbitProject(id);
  const { data, isLoading, isError, error, refetch } = useOrbitWorkItems(id);
  const createItem = useCreateOrbitWorkItem(id);
  const moveItem = useMoveOrbitWorkItem(id);

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<OrbitWorkItem | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const project = projectData?.project;
  const statuses = project?.statuses ?? [];
  const items = data?.data ?? [];
  const createError = createItem.error instanceof ApiError ? createItem.error.message : null;

  const byStatus = useMemo(() => {
    const map = new Map<number, OrbitWorkItem[]>();
    for (const item of items) {
      const list = map.get(item.status_id) ?? [];
      list.push(item);
      map.set(item.status_id, list);
    }
    return map;
  }, [items]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createItem.mutateAsync({ type, title, priority, description: description || undefined });
    setOpen(false);
    setTitle('');
    setDescription('');
  }

  async function persistMove(item: OrbitWorkItem, statusId: number, position: string) {
    setMoveError(null);
    try {
      await moveItem.mutateAsync({ key: item.key, status_id: statusId, position, version: item.version });
    } catch (err) {
      setMoveError(
        err instanceof ApiError
          ? err.message
          : 'This item was changed by someone else. The board has been refreshed.',
      );
      await refetch();
    }
  }

  function handleMoveViaDropdown(item: OrbitWorkItem, statusId: number) {
    if (statusId === item.status_id) return;
    const column = items.filter((candidate) => candidate.status_id === statusId);
    const maxPosition = column.reduce((max, candidate) => Math.max(max, Number(candidate.position)), 0);
    void persistMove(item, statusId, String(maxPosition + 1024));
  }

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((candidate) => candidate.id === event.active.id);
    setDraggingItem(item ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingItem(null);
    if (!over) return;

    const activeItem = items.find((candidate) => candidate.id === active.id);
    if (!activeItem) return;

    const overData = over.data.current as { type: 'item' | 'column'; statusId: number } | undefined;
    if (!overData) return;

    const targetStatusId = overData.statusId;
    const targetColumnItems = items.filter((candidate) => candidate.status_id === targetStatusId && candidate.id !== activeItem.id);
    const overId = overData.type === 'item' ? Number(over.id) : null;
    const position = computeDropPosition(targetColumnItems, overId);

    if (targetStatusId === activeItem.status_id && Number(position) === Number(activeItem.position)) return;

    void persistMove(activeItem, targetStatusId, position);
  }

  return (
    <div>
      <PageHeader
        title={project?.name ?? 'Board'}
        subtitle={project ? `${project.key_prefix} · ${project.mode}${project.archived_at ? ' · Archived' : ''}` : undefined}
        breadcrumbs={[{ label: 'Orbit', to: '/orbit' }, { label: 'Workspaces', to: '/orbit/workspaces' }, { label: project?.name ?? '...' }]}
        actions={
          <div className="flex items-center gap-2">
            {project?.can_administer && (
              <Button variant="secondary" size="icon" aria-label="Project settings" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            )}
            {project?.can_edit_work_items && (
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New item
              </Button>
            )}
          </div>
        }
      />

      {moveError && <p className="mb-3 text-sm text-danger">{moveError}</p>}
      {isLoading && <LoadingState fill />}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !isError && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((status) => (
              <StatusColumn
                key={status.id}
                status={status}
                items={byStatus.get(status.id) ?? []}
                allStatuses={statuses}
                onOpenItem={setActiveKey}
                onMoveViaDropdown={handleMoveViaDropdown}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingItem && (
              <div className="w-72 rounded-md border border-border bg-surface p-3 shadow-lg">
                <span className="mr-1 text-xs text-muted">{draggingItem.key}</span>
                <span className="text-sm font-medium text-strong">{draggingItem.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New work item"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} disabled={createItem.isPending} />
            <ModalSaveAction form="create-orbit-item" isLoading={createItem.isPending} disabled={!title.trim()} />
          </>
        }
      >
        <form id="create-orbit-item" onSubmit={handleCreate} className="flex flex-col gap-4">
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <Field label="Type" required>
            <SelectMenu value={type} onChange={setType} options={TYPES} />
          </Field>
          <Field label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </Field>
          <Field label="Priority">
            <SelectMenu value={priority} onChange={setPriority} options={PRIORITIES} />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
        </form>
      </Modal>

      {activeKey && <OrbitWorkItemDetailModal itemKey={activeKey} projectId={id} onClose={() => setActiveKey(null)} />}
      {settingsOpen && project && <OrbitProjectSettingsModal project={project} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
