import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useCreateOrbitWorkspace, useOrbitWorkspaces } from '@/features/orbit/api';
import { ApiError } from '@/lib/apiClient';

export function OrbitWorkspacesPage() {
  const { hasPermission } = useAuth();
  const { data, isLoading, isError, error, refetch } = useOrbitWorkspaces();
  const createWorkspace = useCreateOrbitWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const workspaces = data?.data ?? [];
  const createError = createWorkspace.error instanceof ApiError ? createWorkspace.error.message : null;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createWorkspace.mutateAsync({ name, description: description || undefined });
    setOpen(false);
    setName('');
    setDescription('');
  }

  return (
    <div>
      <PageHeader
        title="Orbit workspaces"
        subtitle="Workspaces group projects by team or function — Product & Engineering, HR, Operations, and so on."
        actions={
          hasPermission('orbit.workspaces.create') ? (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New workspace
            </Button>
          ) : undefined
        }
      />

      <Card>
        {isLoading && <LoadingState fill />}
        {isError && <ErrorState error={error} onRetry={refetch} />}
        {!isLoading && !isError && workspaces.length === 0 && (
          <EmptyState title="No workspaces yet" description="Create one to start organizing your team's work." />
        )}
        {!isLoading && !isError && workspaces.length > 0 && (
          <ul className="divide-y divide-border">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link to={`/orbit/workspaces/${workspace.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-surface-soft">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-strong">{workspace.name}</p>
                    {workspace.description && <p className="truncate text-xs text-muted">{workspace.description}</p>}
                  </div>
                  <p className="flex-shrink-0 text-xs text-muted">{workspace.projects_count ?? 0} project{workspace.projects_count === 1 ? '' : 's'}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New workspace"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} disabled={createWorkspace.isPending} />
            <ModalSaveAction form="create-orbit-workspace" isLoading={createWorkspace.isPending} disabled={!name.trim()} />
          </>
        }
      >
        <form id="create-orbit-workspace" onSubmit={handleCreate} className="flex flex-col gap-4">
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <Field label="Name" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Product & Engineering" autoFocus />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
