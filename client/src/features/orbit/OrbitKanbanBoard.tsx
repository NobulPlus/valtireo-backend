import { useState } from 'react';
import { Ban, MessageSquare, Paperclip } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { EpicChip } from '@/components/ui/EpicChip';
import { LabelDots } from '@/components/ui/LabelDots';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import { computeDropPosition } from '@/features/orbit/positionMath';
import type { OrbitStatus, OrbitWorkItem } from '@/features/orbit/api';

function agingClassName(statusChangedAt: string | null): { label: string; className: string } {
  if (!statusChangedAt) return { label: '', className: '' };
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(statusChangedAt).getTime()) / 86_400_000));
  const className = ageDays >= 5 ? 'text-danger' : ageDays >= 2 ? 'text-warning' : 'text-muted';
  return { label: `${ageDays}d in column`, className };
}

function dueDateClassName(dueAt: string | null, isDone: boolean): string {
  if (!dueAt || isDone) return 'text-muted';
  const today = new Date().toISOString().slice(0, 10);
  const due = dueAt.slice(0, 10);
  if (due < today) return 'bg-danger-bg text-danger';
  if (due === today) return 'bg-warning-bg text-warning';
  return 'text-muted';
}

function KanbanWorkItemCard({ item, onOpen }: { item: OrbitWorkItem; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', statusId: item.status_id },
  });
  const { formatDate } = useDateFormatter();
  const aging = agingClassName(item.status_changed_at);
  const isDone = item.status?.category === 'done';
  const commentsCount = item.comments_count ?? 0;
  const attachmentsCount = item.attachments_count ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-md border border-border bg-surface p-3 shadow-sm',
        item.is_blocked && 'border-l-4 border-l-danger',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <EpicChip epic={item.epic} />
        {item.is_blocked && <Ban className="h-3 w-3 flex-shrink-0 text-danger" aria-label="Blocked" />}
      </div>
      <button
        type="button"
        onClick={onOpen}
        onPointerDown={(event) => event.stopPropagation()}
        className="block w-full text-left text-sm font-medium text-strong hover:underline"
      >
        <span className="mr-1 text-xs text-muted">{item.key}</span>
        {item.title}
      </button>
      <LabelDots labels={item.labels} className="mt-1.5" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={item.priority} />
        <div className="flex items-center gap-2 text-xs">
          {aging.label && <span className={aging.className}>{aging.label}</span>}
          {item.assignee && <span className="text-muted">{item.assignee.name}</span>}
        </div>
      </div>
      {(item.due_at || commentsCount > 0 || attachmentsCount > 0) && (
        <div className="mt-2 flex items-center gap-2.5 border-t border-border pt-2 text-xs text-muted">
          {item.due_at && (
            <span className={cn('rounded px-1.5 py-0.5', dueDateClassName(item.due_at, isDone))}>{formatDate(item.due_at)}</span>
          )}
          {commentsCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentsCount}
            </span>
          )}
          {attachmentsCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {attachmentsCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanStatusColumn({
  status,
  items,
  onOpenItem,
}: {
  status: OrbitStatus;
  items: OrbitWorkItem[];
  onOpenItem: (key: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${status.id}`, data: { type: 'column', statusId: status.id } });
  const sorted = [...items].sort((a, b) => Number(a.position) - Number(b.position));
  const overLimit = status.wip_limit != null && sorted.length > status.wip_limit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col rounded-lg border bg-surface-soft',
        overLimit ? 'border-danger' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-semibold text-strong">{status.name}</p>
        <span
          className={cn(
            'text-xs',
            overLimit ? 'rounded-full bg-danger-bg px-2 py-0.5 font-medium text-danger' : 'text-muted',
          )}
        >
          {sorted.length}
          {status.wip_limit != null && ` / ${status.wip_limit}`}
        </span>
      </div>
      <SortableContext items={sorted.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[2rem] flex-col gap-2 px-2 pb-2">
          {sorted.map((item) => (
            <div key={item.id}>
              <KanbanWorkItemCard item={item} onOpen={() => onOpenItem(item.key)} />
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function OrbitKanbanBoard({
  statuses,
  items,
  onOpenItem,
  onMove,
}: {
  statuses: OrbitStatus[];
  items: OrbitWorkItem[];
  onOpenItem: (key: string) => void;
  onMove: (item: OrbitWorkItem, statusId: number, position: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggingItem, setDraggingItem] = useState<OrbitWorkItem | null>(null);

  const byStatus = new Map<number, OrbitWorkItem[]>();
  for (const item of items) {
    byStatus.set(item.status_id, [...(byStatus.get(item.status_id) ?? []), item]);
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
    const targetColumnItems = items
      .filter((candidate) => candidate.status_id === targetStatusId && candidate.id !== activeItem.id)
      .map((candidate) => ({ id: candidate.id, rank: candidate.position }));
    const overId = overData.type === 'item' ? Number(over.id) : null;
    const position = computeDropPosition(targetColumnItems, overId);

    if (targetStatusId === activeItem.status_id && Number(position) === Number(activeItem.position)) return;

    onMove(activeItem, targetStatusId, position);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <KanbanStatusColumn key={status.id} status={status} items={byStatus.get(status.id) ?? []} onOpenItem={onOpenItem} />
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
  );
}
