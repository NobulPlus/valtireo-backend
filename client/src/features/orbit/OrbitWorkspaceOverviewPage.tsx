import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import {
  useAddOrbitWorkspaceMember,
  useArchiveOrbitWorkspace,
  useCreateOrbitProject,
  useOrbitProjects,
  useOrbitWorkspace,
  useOrbitWorkspaceMembers,
  useRemoveOrbitWorkspaceMember,
  useRestoreOrbitWorkspace,
  useUpdateOrbitWorkspaceMember,
} from '@/features/orbit/api';
import { OrbitMemberManager } from '@/features/orbit/OrbitMemberManager';
import { ApiError } from '@/lib/apiClient';

const WORKSPACE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const MODES = [
  { value: 'kanban', label: 'Kanban', description: 'Continuous flow with configurable board columns' },
  { value: 'simple', label: 'Simple tasks', description: 'A lightweight list or board, no agile fields' },
  { value: 'scrum', label: 'Scrum (coming soon)', description: 'Backlog and sprints — arriving in a later phase', disabled: true },
];

export function OrbitWorkspaceOverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const id = Number(workspaceId);
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: workspaceData } = useOrbitWorkspace(id);
  const { data, isLoading, isError, error, refetch } = useOrbitProjects(id);
  const createProject = useCreateOrbitProject(id);

  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [mode, setMode] = useState('kanban');
  const [description, setDescription] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const workspace = workspaceData?.workspace;
  const canAdminister = Boolean(workspace?.can_administer);
  const projects = data?.data ?? [];
  const createError = createProject.error instanceof ApiError ? createProject.error.message : null;

  const members = useOrbitWorkspaceMembers(membersOpen ? id : undefined);
  const addMember = useAddOrbitWorkspaceMember(id);
  const updateMember = useUpdateOrbitWorkspaceMember(id);
  const removeMember = useRemoveOrbitWorkspaceMember(id);
  const archiveWorkspace = useArchiveOrbitWorkspace();
  const restoreWorkspace = useRestoreOrbitWorkspace();

  async function handleArchiveToggle() {
    if (!workspace) return;
    setArchiveError(null);
    try {
      if (workspace.archived_at) {
        await restoreWorkspace.mutateAsync(workspace.id);
      } else if (window.confirm(`Archive "${workspace.name}"? Its projects will be archived too. You can restore it later.`)) {
        await archiveWorkspace.mutateAsync(workspace.id);
      }
    } catch (err) {
      setArchiveError(err instanceof ApiError ? err.message : 'Could not update the workspace’s archive status.');
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const result = await createProject.mutateAsync({
      name,
      key_prefix: keyPrefix.toUpperCase(),
      mode: mode as 'kanban' | 'simple' | 'scrum',
      description: description || undefined,
    });
    setOpen(false);
    setName('');
    setKeyPrefix('');
    setDescription('');
    navigate(`/orbit/projects/${result.project.id}`);
  }

  return (
    <div>
      <PageHeader
        title={workspace?.name ?? 'Workspace'}
        subtitle={workspace?.description ?? undefined}
        breadcrumbs={[{ label: 'Orbit', to: '/orbit' }, { label: 'Workspaces', to: '/orbit/workspaces' }, { label: workspace?.name ?? '...' }]}
        actions={
          <div className="flex items-center gap-2">
            {canAdminister && (
              <>
                <Button variant="secondary" size="icon" aria-label="Manage members" onClick={() => setMembersOpen(true)}>
                  <Users className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={workspace?.archived_at ? 'Restore workspace' : 'Archive workspace'}
                  onClick={handleArchiveToggle}
                  isLoading={archiveWorkspace.isPending || restoreWorkspace.isPending}
                >
                  {workspace?.archived_at ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                </Button>
              </>
            )}
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New project
            </Button>
          </div>
        }
      />
      {archiveError && <p className="mb-3 text-sm text-danger">{archiveError}</p>}

      <Card>
        {isLoading && <LoadingState fill />}
        {isError && <ErrorState error={error} onRetry={refetch} />}
        {!isLoading && !isError && projects.length === 0 && (
          <EmptyState title="No projects yet" description="Create a project to start a board for this workspace." />
        )}
        {!isLoading && !isError && projects.length > 0 && (
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project.id}>
                <Link to={`/orbit/projects/${project.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-surface-soft">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-strong">
                      <span className="mr-2 rounded bg-surface-soft px-1.5 py-0.5 text-xs font-mono text-muted">{project.key_prefix}</span>
                      {project.name}
                    </p>
                    {project.description && <p className="truncate text-xs text-muted">{project.description}</p>}
                  </div>
                  <p className="flex-shrink-0 text-xs capitalize text-muted">{project.mode}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} disabled={createProject.isPending} />
            <ModalSaveAction form="create-orbit-project" isLoading={createProject.isPending} disabled={!name.trim() || !keyPrefix.trim()} />
          </>
        }
      >
        <form id="create-orbit-project" onSubmit={handleCreate} className="flex flex-col gap-4">
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <Field label="Name" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mobile App Redesign" autoFocus />
          </Field>
          <Field label="Key" required hint="Used in work item references, e.g. PROJ-124">
            <Input
              value={keyPrefix}
              onChange={(event) => setKeyPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))}
              placeholder="MOBI"
            />
          </Field>
          <Field label="Mode" required>
            <SelectMenu value={mode} onChange={setMode} options={MODES} />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
        </form>
      </Modal>

      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`${workspace?.name ?? 'Workspace'} members`}>
        <OrbitMemberManager
          members={members.data?.data ?? []}
          isLoading={members.isLoading}
          roleOptions={WORKSPACE_ROLE_OPTIONS}
          canManage={canAdminister}
          currentUserId={session?.user.id}
          onAdd={(userId, role) => addMember.mutateAsync({ user_id: userId, role: role as 'admin' | 'member' })}
          onChangeRole={(userId, role) => updateMember.mutateAsync({ userId, role: role as 'admin' | 'member' })}
          onRemove={(userId) => removeMember.mutateAsync(userId)}
          isAdding={addMember.isPending}
          isRemoving={removeMember.isPending}
        />
      </Modal>
    </div>
  );
}
