import { useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import {
  useAddOrbitProjectMember,
  useArchiveOrbitProject,
  useCreateOrbitLabel,
  useCreateOrbitStatus,
  useDeleteOrbitLabel,
  useDeleteOrbitStatus,
  useOrbitLabels,
  useOrbitProjectMembers,
  useOrbitStatuses,
  useRemoveOrbitProjectMember,
  useRestoreOrbitProject,
  useUpdateOrbitLabel,
  useUpdateOrbitProjectMember,
  useUpdateOrbitStatus,
  type OrbitProject,
} from '@/features/orbit/api';
import { OrbitMemberManager } from '@/features/orbit/OrbitMemberManager';

const PROJECT_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'viewer', label: 'Viewer' },
];

const STATUS_CATEGORIES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const LABEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

type Tab = 'members' | 'statuses' | 'labels';

export function OrbitProjectSettingsModal({ project, onClose }: { project: OrbitProject; onClose: () => void }) {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('members');
  const canAdminister = Boolean(project.can_administer);

  return (
    <Modal open onClose={onClose} title={`${project.name} settings`} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-md bg-surface-soft p-1">
          {([
            ['members', 'Members'],
            ['statuses', 'Workflow'],
            ['labels', 'Labels'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === value ? 'bg-surface text-strong shadow-sm' : 'text-muted hover:text-strong',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'members' && (
          <MembersTab projectId={project.id} canAdminister={canAdminister} currentUserId={session?.user.id} />
        )}
        {tab === 'statuses' && <StatusesTab projectId={project.id} canAdminister={canAdminister} />}
        {tab === 'labels' && <LabelsTab projectId={project.id} canAdminister={canAdminister} />}

        {canAdminister && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted">
              {project.archived_at ? 'This project is archived.' : 'Archiving hides this project from the workspace while keeping its data.'}
            </p>
            <ArchiveToggle project={project} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function ArchiveToggle({ project }: { project: OrbitProject }) {
  const [error, setError] = useState<string | null>(null);
  const archive = useArchiveOrbitProject();
  const restore = useRestoreOrbitProject();

  async function handleClick() {
    setError(null);
    try {
      if (project.archived_at) {
        await restore.mutateAsync(project.id);
      } else if (window.confirm(`Archive "${project.name}"? Members will no longer see it on the workspace. You can restore it later from this screen.`)) {
        await archive.mutateAsync(project.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the project’s archive status.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        isLoading={archive.isPending || restore.isPending}
      >
        {project.archived_at ? (
          <>
            <ArchiveRestore className="h-3.5 w-3.5" /> Restore project
          </>
        ) : (
          <>
            <Archive className="h-3.5 w-3.5" /> Archive project
          </>
        )}
      </Button>
    </div>
  );
}

function MembersTab({ projectId, canAdminister, currentUserId }: { projectId: number; canAdminister: boolean; currentUserId: number | undefined }) {
  const members = useOrbitProjectMembers(projectId);
  const addMember = useAddOrbitProjectMember(projectId);
  const updateMember = useUpdateOrbitProjectMember(projectId);
  const removeMember = useRemoveOrbitProjectMember(projectId);

  return (
    <OrbitMemberManager
      members={members.data?.data ?? []}
      isLoading={members.isLoading}
      roleOptions={PROJECT_ROLE_OPTIONS}
      canManage={canAdminister}
      currentUserId={currentUserId}
      onAdd={(userId, role) => addMember.mutateAsync({ user_id: userId, role: role as 'admin' | 'contributor' | 'viewer' })}
      onChangeRole={(userId, role) => updateMember.mutateAsync({ userId, role: role as 'admin' | 'contributor' | 'viewer' })}
      onRemove={(userId) => removeMember.mutateAsync(userId)}
      isAdding={addMember.isPending}
      isRemoving={removeMember.isPending}
    />
  );
}

function StatusesTab({ projectId, canAdminister }: { projectId: number; canAdminister: boolean }) {
  const statuses = useOrbitStatuses(projectId);
  const createStatus = useCreateOrbitStatus(projectId);
  const updateStatus = useUpdateOrbitStatus(projectId);
  const deleteStatus = useDeleteOrbitStatus(projectId);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('todo');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createStatus.mutateAsync({ name, category: category as 'todo' | 'in_progress' | 'done' });
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that column.');
    }
  }

  async function handleDelete(statusId: number) {
    setError(null);
    try {
      await deleteStatus.mutateAsync(statusId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that column.');
    }
  }

  if (statuses.isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {(statuses.data?.data ?? []).map((status) => (
          <li key={status.id} className="flex items-center justify-between gap-3 py-2.5">
            {canAdminister ? (
              <>
                <Input
                  value={status.name}
                  onChange={(event) => void updateStatus.mutateAsync({ statusId: status.id, name: event.target.value })}
                  className="max-w-[12rem]"
                />
                <div className="flex items-center gap-2">
                  <SelectMenu
                    value={status.category}
                    onChange={(value) => void updateStatus.mutateAsync({ statusId: status.id, category: value as 'todo' | 'in_progress' | 'done' })}
                    options={STATUS_CATEGORIES}
                    className="w-36"
                  />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${status.name} column`} onClick={() => void handleDelete(status.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-strong">{status.name}</span>
                <span className="text-xs capitalize text-muted">{status.category.replace('_', ' ')}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {canAdminister && (
        <form onSubmit={handleCreate} className="flex items-center gap-2 border-t border-border pt-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New column name" className="flex-1" />
          <SelectMenu value={category} onChange={setCategory} options={STATUS_CATEGORIES} className="w-36" />
          <Button type="submit" variant="secondary" size="icon" aria-label="Add column" disabled={!name.trim()} isLoading={createStatus.isPending}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}

function LabelsTab({ projectId, canAdminister }: { projectId: number; canAdminister: boolean }) {
  const labels = useOrbitLabels(projectId);
  const createLabel = useCreateOrbitLabel(projectId);
  const updateLabel = useUpdateOrbitLabel(projectId);
  const deleteLabel = useDeleteOrbitLabel(projectId);

  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createLabel.mutateAsync({ name, color });
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that label.');
    }
  }

  async function handleDelete(labelId: number) {
    setError(null);
    try {
      await deleteLabel.mutateAsync(labelId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that label.');
    }
  }

  if (labels.isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {(labels.data?.data ?? []).map((label) => (
          <li key={label.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
              {canAdminister ? (
                <Input
                  value={label.name}
                  onChange={(event) => void updateLabel.mutateAsync({ labelId: label.id, name: event.target.value })}
                  className="max-w-[12rem]"
                />
              ) : (
                <span className="text-sm font-medium text-strong">{label.name}</span>
              )}
            </div>
            {canAdminister && (
              <Button variant="ghost" size="icon" aria-label={`Remove ${label.name} label`} onClick={() => void handleDelete(label.id)}>
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            )}
          </li>
        ))}
        {(labels.data?.data ?? []).length === 0 && <li className="py-2.5 text-sm text-muted">No labels yet.</li>}
      </ul>

      {canAdminister && (
        <form onSubmit={handleCreate} className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New label name" className="flex-1" />
            <Button type="submit" variant="secondary" size="icon" aria-label="Add label" disabled={!name.trim()} isLoading={createLabel.isPending}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {LABEL_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Choose color ${swatch}`}
                onClick={() => setColor(swatch)}
                className={cn('h-5 w-5 rounded-full ring-offset-1', color === swatch && 'ring-2 ring-strong')}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </form>
      )}
    </div>
  );
}
