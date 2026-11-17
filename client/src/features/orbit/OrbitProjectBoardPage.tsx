import { useMemo, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { DatePicker } from '@/components/ui/DatePicker';
import { OptionDot } from '@/components/ui/OptionDot';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { EpicChip } from '@/components/ui/EpicChip';
import { LabelDots } from '@/components/ui/LabelDots';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import {
  useCreateOrbitWorkItem,
  useMoveOrbitWorkItem,
  useOrbitIterations,
  useOrbitLabels,
  useOrbitProjectMembers,
  useOrbitProject,
  useOrbitWorkItems,
  type OrbitStatus,
  type OrbitWorkItem,
} from '@/features/orbit/api';
import { ApiError } from '@/lib/apiClient';
import { OrbitWorkItemDetailModal } from '@/features/orbit/OrbitWorkItemDetailModal';
import { OrbitProjectSettingsModal } from '@/features/orbit/OrbitProjectSettingsModal';
import { OrbitSprintsPanel } from '@/features/orbit/OrbitSprintsPanel';
import { OrbitBacklogPanel } from '@/features/orbit/OrbitBacklogPanel';
import { OrbitReportsPanel } from '@/features/orbit/OrbitReportsPanel';
import { OrbitSimpleTaskList } from '@/features/orbit/OrbitSimpleTaskList';
import { computeDropPosition } from '@/features/orbit/positionMath';

const MODE_LABELS: Record<string, string> = { kanban: 'Kanban', scrum: 'Scrum', simple: 'Simple' };

// Categorical, not severity — reuses the chart palette index.css reserves
// for "distinguish categories, don't imply severity" rather than the
// StatusBadge tone system.
const TYPES = [
  { value: 'task', label: 'Task', icon: <OptionDot className="bg-chart-1" /> },
  { value: 'bug', label: 'Bug', icon: <OptionDot className="bg-chart-2" /> },
  { value: 'story', label: 'Story', icon: <OptionDot className="bg-chart-3" /> },
];

const EPIC_TYPE = { value: 'epic', label: 'Epic', icon: <OptionDot className="bg-chart-4" /> };

// Fetched independently of the (now sprint-scoped) board items so the create
// form's epic picker always lists every epic in the project, not just the
// ones that happen to be in the active sprint.
const EPIC_FILTERS = { type: 'epic' } as const;

// Severity — reuses PriorityBadge's exact tone mapping (low: draft,
// medium: info, high: warning, urgent: danger).
const PRIORITIES = [
  { value: 'low', label: 'Low', icon: <OptionDot className="bg-draft" /> },
  { value: 'medium', label: 'Medium', icon: <OptionDot className="bg-info" /> },
  { value: 'high', label: 'High', icon: <OptionDot className="bg-warning" /> },
  { value: 'urgent', label: 'Urgent', icon: <OptionDot className="bg-danger" /> },
];

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
      <EpicChip epic={item.epic} className="mb-1.5" />
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
        {item.assignee && <span className="text-xs text-muted">{item.assignee.name}</span>}
      </div>
    </div>
  );
}

function StatusColumn({
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
  const project = projectData?.project;
  const isScrum = project?.mode === 'scrum';
  const { data: iterationsData } = useOrbitIterations(id, isScrum);
  const iterations = iterationsData?.data ?? [];
  const activeIteration = iterations.find((iteration) => iteration.status === 'active');
  // Scrum's "Board" is the active sprint's board, not every item in the
  // project — the Backlog tab is where unscheduled work lives. Disable the
  // fetch entirely (rather than fetch-then-filter) when there's nothing to
  // scope to yet, so a fresh Scrum project doesn't render a misleading
  // "everything" board before its first sprint starts.
  const boardFilters = useMemo(() => (isScrum && activeIteration ? { iteration_id: activeIteration.id } : {}), [isScrum, activeIteration]);
  const boardEnabled = !isScrum || Boolean(activeIteration);
  const { data, isLoading, isError, error, refetch } = useOrbitWorkItems(id, boardFilters, boardEnabled);
  const { data: epicsData } = useOrbitWorkItems(id, EPIC_FILTERS, isScrum);
  const { data: membersData } = useOrbitProjectMembers(id);
  const { data: labelsData } = useOrbitLabels(id);
  const createItem = useCreateOrbitWorkItem(id);
  const moveItem = useMoveOrbitWorkItem(id);

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [dueAt, setDueAt] = useState('');
  const [startAt, setStartAt] = useState('');
  const [epicId, setEpicId] = useState('none');
  const [iterationId, setIterationId] = useState('backlog');
  const [estimate, setEstimate] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = searchParams.get('item');
  const [draggingItem, setDraggingItem] = useState<OrbitWorkItem | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [tab, setTab] = useState<'board' | 'backlog' | 'sprints' | 'reports'>('board');
  const [pendingCompletion, setPendingCompletion] = useState<{ item: OrbitWorkItem; statusId: number; position: string } | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionError, setCompletionError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { formatDate } = useDateFormatter();

  const statuses = project?.statuses ?? [];
  const items = data?.data ?? [];
  const epicItems = epicsData?.data ?? [];
  const members = membersData?.data ?? [];
  const labels = labelsData?.data ?? [];
  const isSimple = project?.mode === 'simple';
  const createError = createItem.error instanceof ApiError ? createItem.error.message : null;

  function setActiveKey(key: string | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (key) next.set('item', key);
        else next.delete('item');
        return next;
      },
      { replace: true },
    );
  }

  const byStatus = useMemo(() => {
    const map = new Map<number, OrbitWorkItem[]>();
    for (const item of items) {
      const list = map.get(item.status_id) ?? [];
      list.push(item);
      map.set(item.status_id, list);
    }
    return map;
  }, [items]);

  const typeOptions = isScrum ? [...TYPES, EPIC_TYPE] : TYPES;
  const assigneeOptions = [{ value: 'unassigned', label: 'Unassigned' }, ...members.map((member) => ({ value: String(member.id), label: member.name }))];
  const epicOptions = [{ value: 'none', label: 'No epic' }, ...epicItems.map((item) => ({ value: String(item.id), label: `${item.key} · ${item.title}` }))];
  const iterationOptions = [
    { value: 'backlog', label: 'Backlog' },
    ...iterations.filter((iteration) => iteration.status !== 'completed').map((iteration) => ({ value: String(iteration.id), label: iteration.status === 'active' ? `${iteration.name} (active)` : iteration.name })),
  ];

  function resetCreateForm() {
    setTitle('');
    setType('task');
    setPriority('medium');
    setDescription('');
    setAssigneeId('unassigned');
    setDueAt('');
    setStartAt('');
    setEpicId('none');
    setIterationId('backlog');
    setEstimate('');
    setAcceptanceCriteria('');
    setDefinitionOfDone('');
    setSelectedLabels(new Set());
  }

  function openCreate(prefilledEpicId?: number) {
    resetCreateForm();
    if (prefilledEpicId) {
      setType('story');
      setEpicId(String(prefilledEpicId));
    }
    // Creating while looking at the sprint board should land the item in
    // that sprint — otherwise it would immediately vanish from view into
    // the backlog. Creating from the Backlog tab keeps defaulting there.
    if (tab === 'board' && activeIteration) {
      setIterationId(String(activeIteration.id));
    }
    setOpen(true);
  }

  function toggleLabel(labelId: number) {
    setSelectedLabels((current) => {
      const next = new Set(current);
      if (next.has(labelId)) next.delete(labelId);
      else next.add(labelId);
      return next;
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createItem.mutateAsync({
      type: type as OrbitWorkItem['type'],
      title,
      priority: priority as OrbitWorkItem['priority'],
      description: description || undefined,
      assignee_id: assigneeId === 'unassigned' ? undefined : Number(assigneeId),
      due_at: dueAt || undefined,
      start_at: isScrum ? startAt || undefined : undefined,
      epic_id: isScrum && epicId !== 'none' ? Number(epicId) : undefined,
      iteration_id: isScrum && iterationId !== 'backlog' ? Number(iterationId) : undefined,
      estimate: isScrum && estimate ? Number(estimate) : undefined,
      acceptance_criteria: isScrum ? acceptanceCriteria || undefined : undefined,
      definition_of_done: isScrum ? definitionOfDone || undefined : undefined,
      label_ids: selectedLabels.size > 0 ? [...selectedLabels] : undefined,
    });
    setOpen(false);
    resetCreateForm();
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

  function requestMove(item: OrbitWorkItem, statusId: number, position: string) {
    const targetIsDone = statuses.find((status) => status.id === statusId)?.category === 'done';
    const alreadyDone = item.status?.category === 'done';
    if (targetIsDone && !alreadyDone) {
      setCompletionNote('');
      setCompletionError(null);
      setPendingCompletion({ item, statusId, position });
      return;
    }
    void persistMove(item, statusId, position);
  }

  async function confirmCompletion() {
    if (!pendingCompletion) return;
    setCompletionError(null);
    try {
      await moveItem.mutateAsync({
        key: pendingCompletion.item.key,
        status_id: pendingCompletion.statusId,
        position: pendingCompletion.position,
        version: pendingCompletion.item.version,
        completion_note: completionNote || undefined,
      });
      setPendingCompletion(null);
    } catch (err) {
      setCompletionError(err instanceof ApiError ? err.message : 'Could not complete this item.');
    }
  }

  function handleMoveViaDropdown(item: OrbitWorkItem, statusId: number) {
    if (statusId === item.status_id) return;
    const column = items.filter((candidate) => candidate.status_id === statusId);
    const maxPosition = column.reduce((max, candidate) => Math.max(max, Number(candidate.position)), 0);
    requestMove(item, statusId, String(maxPosition + 1024));
  }

  function handleComplete(item: OrbitWorkItem) {
    const doneStatus = statuses.find((status) => status.category === 'done');
    if (doneStatus) handleMoveViaDropdown(item, doneStatus.id);
  }

  function handleReopen(item: OrbitWorkItem) {
    const todoStatus = statuses.find((status) => status.category === 'todo') ?? statuses[0];
    if (todoStatus) handleMoveViaDropdown(item, todoStatus.id);
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

    requestMove(activeItem, targetStatusId, position);
  }

  return (
    <div>
      <PageHeader
        title={project?.name ?? 'Board'}
        subtitle={project ? `${project.key_prefix} · ${MODE_LABELS[project.mode] ?? project.mode}${project.archived_at ? ' · Archived' : ''}` : undefined}
        breadcrumbs={[{ label: 'Orbit', to: '/orbit' }, { label: 'Workspaces', to: '/orbit/workspaces' }, { label: project?.name ?? '...' }]}
        actions={
          <div className="flex items-center gap-2">
            {project?.can_administer && (
              <Button variant="secondary" size="icon" aria-label="Project settings" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            )}
            {project?.can_edit_work_items && (
                <Button variant="primary" onClick={() => openCreate()}>
                <Plus className="h-3.5 w-3.5" /> New item
              </Button>
            )}
          </div>
        }
      />

      {project?.mode === 'scrum' && (
        <div className="mb-4 flex gap-1 border-b border-border">
          {(['backlog', 'board', 'sprints', 'reports'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'px-3 py-2 text-sm font-medium capitalize transition-colors',
                tab === value ? 'border-b-2 border-pine text-strong' : 'text-muted hover:text-strong',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {tab === 'backlog' && project?.mode === 'scrum' ? (
        <OrbitBacklogPanel project={project} onOpenItem={setActiveKey} onAddItem={openCreate} />
      ) : tab === 'sprints' && project?.mode === 'scrum' ? (
        <OrbitSprintsPanel project={project} />
      ) : tab === 'reports' && project?.mode === 'scrum' ? (
        <OrbitReportsPanel project={project} />
      ) : isScrum && !activeIteration ? (
        <EmptyState
          title="No active sprint"
          description="Start a sprint from the Backlog or Sprints tab to see its board here."
          action={
            <Button variant="secondary" size="sm" onClick={() => setTab('sprints')}>
              Go to Sprints
            </Button>
          }
        />
      ) : (
        <>
          {isScrum && activeIteration && (
            <div className="mb-4 rounded-lg border border-border bg-surface-soft px-4 py-3">
              <p className="text-sm font-medium text-strong">
                {activeIteration.name}{' '}
                <span className="text-xs font-normal text-muted">
                  · {formatDate(activeIteration.starts_at)} – {formatDate(activeIteration.ends_at)}
                </span>
              </p>
              {activeIteration.goal && <p className="mt-1 text-xs text-muted">{activeIteration.goal}</p>}
            </div>
          )}

          {moveError && <p className="mb-3 text-sm text-danger">{moveError}</p>}
          {isLoading && <LoadingState fill />}
          {isError && <ErrorState error={error} onRetry={refetch} />}

          {!isLoading && !isError && isSimple && (
            <OrbitSimpleTaskList
              items={items}
              canEdit={Boolean(project?.can_edit_work_items)}
              onOpenItem={setActiveKey}
              onComplete={handleComplete}
              onReopen={handleReopen}
            />
          )}

          {!isLoading && !isError && !isSimple && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {statuses.map((status) => (
                  <StatusColumn
                    key={status.id}
                    status={status}
                    items={byStatus.get(status.id) ?? []}
                    onOpenItem={setActiveKey}
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
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New work item"
        size={isScrum ? 'lg' : 'md'}
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} disabled={createItem.isPending} />
            <ModalSaveAction form="create-orbit-item" isLoading={createItem.isPending} disabled={!title.trim()} />
          </>
        }
      >
        <form id="create-orbit-item" onSubmit={handleCreate} className="flex flex-col gap-4">
          {createError && <p className="text-sm text-danger">{createError}</p>}
          {isScrum ? (
            // Landscape, two-pane layout: identity/content on the left, scheduling/delivery
            // metadata on the right, filling height in parallel instead of stacking every
            // field — the Scrum form has 13 fields vs. Kanban/Simple's 7, so only it needs
            // the wider (lg) modal and this split; the simpler form below keeps the modal
            // at its default width and a single stacked column.
            <div className="grid grid-cols-2 gap-7">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Type" required>
                    <SelectMenu value={type} onChange={setType} options={typeOptions} />
                  </Field>
                  <Field label="Priority">
                    <SelectMenu value={priority} onChange={setPriority} options={PRIORITIES} />
                  </Field>
                </div>
                <Field label="Title" required>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
                </Field>
                <Field label="Description" hint="Optional">
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
                </Field>
                {labels.length > 0 && (
                  <Field label="Labels" hint="Optional">
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map((label) => {
                        const selected = selectedLabels.has(label.id);
                        return <button key={label.id} type="button" onClick={() => toggleLabel(label.id)} className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition', selected ? 'text-white' : 'border border-border text-muted hover:text-strong')} style={selected ? { backgroundColor: label.color } : undefined}>{label.name}</button>;
                      })}
                    </div>
                  </Field>
                )}
              </div>
              <div className="flex flex-col gap-4 border-l border-border pl-7">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Assignee"><SelectMenu value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} /></Field>
                  <Field label="Due date"><DatePicker value={dueAt} onChange={setDueAt} /></Field>
                  <Field label="Start date"><DatePicker value={startAt} onChange={setStartAt} /></Field>
                  <Field label="Epic"><SelectMenu value={epicId} onChange={setEpicId} options={epicOptions} /></Field>
                  <Field label="Sprint"><SelectMenu value={iterationId} onChange={setIterationId} options={iterationOptions} /></Field>
                  <Field label="Estimate"><Input value={estimate} onChange={(event) => setEstimate(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="Story points or hours" /></Field>
                </div>
                <Field label="Acceptance criteria" hint="Optional"><Textarea value={acceptanceCriteria} onChange={(event) => setAcceptanceCriteria(event.target.value)} rows={2} /></Field>
                <Field label="Definition of done" hint="Optional"><Textarea value={definitionOfDone} onChange={(event) => setDefinitionOfDone(event.target.value)} rows={2} /></Field>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type" required>
                  <SelectMenu value={type} onChange={setType} options={typeOptions} />
                </Field>
                <Field label="Priority">
                  <SelectMenu value={priority} onChange={setPriority} options={PRIORITIES} />
                </Field>
              </div>
              <Field label="Title" required>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
              </Field>
              <Field label="Description" hint="Optional">
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Assignee">
                  <SelectMenu value={assigneeId} onChange={setAssigneeId} options={assigneeOptions} />
                </Field>
                <Field label="Due date">
                  <DatePicker value={dueAt} onChange={setDueAt} />
                </Field>
              </div>
              {labels.length > 0 && (
                <Field label="Labels" hint="Optional">
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => {
                      const selected = selectedLabels.has(label.id);
                      return <button key={label.id} type="button" onClick={() => toggleLabel(label.id)} className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition', selected ? 'text-white' : 'border border-border text-muted hover:text-strong')} style={selected ? { backgroundColor: label.color } : undefined}>{label.name}</button>;
                    })}
                  </div>
                </Field>
              )}
            </>
          )}
        </form>
      </Modal>

      {pendingCompletion && (
        <Modal
          open
          onClose={() => setPendingCompletion(null)}
          title="Confirm completion"
          footer={
            <>
              <ModalCancelAction onClick={() => setPendingCompletion(null)} disabled={moveItem.isPending} />
              <ModalConfirmAction onClick={() => void confirmCompletion()} isLoading={moveItem.isPending} title="Confirm completion" />
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {(pendingCompletion.item.acceptance_criteria || pendingCompletion.item.definition_of_done) && (
              <div className="rounded-lg border border-border bg-surface-soft p-3">
                {pendingCompletion.item.acceptance_criteria && (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Acceptance criteria</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-strong">{pendingCompletion.item.acceptance_criteria}</p>
                  </>
                )}
                {pendingCompletion.item.definition_of_done && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Definition of done</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-strong">{pendingCompletion.item.definition_of_done}</p>
                  </>
                )}
              </div>
            )}
            <Field label="Completion note" hint="Optional">
              <Textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} rows={3} />
            </Field>
            {completionError && <p className="text-sm text-danger">{completionError}</p>}
          </div>
        </Modal>
      )}

      {activeKey && (
        <OrbitWorkItemDetailModal
          itemKey={activeKey}
          projectId={id}
          statuses={statuses}
          onChangeStatus={handleMoveViaDropdown}
          onClose={() => setActiveKey(null)}
        />
      )}
      {settingsOpen && project && <OrbitProjectSettingsModal project={project} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
