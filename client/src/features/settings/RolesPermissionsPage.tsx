import { useMemo, useState, type FormEvent } from 'react';
import { Lock, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { Permission, Role } from '@/types/api';
import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useRoles,
  useUpdateRole,
  type RolePayload,
} from '@/features/settings/rolesApi';

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Permissions aren't required to have a curated `group` yet — fall back to the code key's prefix (e.g. "employees.view_department" → "Employees") so the picker is still organized. */
export function permissionGroup(permission: Permission): string {
  return permission.group || titleCase(permission.name.split('.')[0] ?? 'General');
}

export function permissionLabel(permission: Permission): string {
  if (permission.label) return permission.label;
  const action = permission.name.split('.').slice(1).join(' ');
  return titleCase(action || permission.name);
}

function roleColumns({
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}): Column<Role>[] {
  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Role',
      render: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-strong">{role.name}</span>
          {role.key && (
            <span className="flex-shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-muted">
              Starter
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (role) => <span className="text-muted">{role.description || '—'}</span>,
      className: 'max-w-sm',
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (role) => role.permissions.length,
    },
    {
      key: 'users',
      header: 'Users',
      render: (role) => role.user_count ?? 0,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (role) => (
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                toggle();
              }}
              aria-label={`Actions for ${role.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        >
          {canUpdate && (
            <DropdownMenuItem icon={Pencil} onClick={() => onEdit(role)}>
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem icon={Trash2} onClick={() => onDelete(role)} className="text-danger">
              Delete
            </DropdownMenuItem>
          )}
        </Dropdown>
      ),
    });
  }

  return columns;
}

interface RoleFormState {
  name: string;
  description: string;
  permissionNames: Set<string>;
}

function RoleEditorModal({
  onClose,
  role,
  permissions,
  permissionsLoading,
  actorPermissions,
}: {
  onClose: () => void;
  role: Role | null;
  permissions: Permission[];
  permissionsLoading: boolean;
  actorPermissions: Set<string>;
}) {
  const toast = useToast();
  const isEditing = role !== null;
  const [form, setForm] = useState<RoleFormState>(() =>
    role
      ? { name: role.name, description: role.description ?? '', permissionNames: new Set(role.permissions) }
      : { name: '', description: '', permissionNames: new Set() },
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole(role?.id ?? 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const groups = useMemo(() => {
    const byGroup = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const group = permissionGroup(permission);
      const list = byGroup.get(group) ?? [];
      list.push(permission);
      byGroup.set(group, list);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  function togglePermission(name: string) {
    setForm((current) => {
      const next = new Set(current.permissionNames);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return { ...current, permissionNames: next };
    });
  }

  function toggleGroup(groupPermissions: Permission[], nextChecked: boolean) {
    setForm((current) => {
      const next = new Set(current.permissionNames);
      for (const permission of groupPermissions) {
        if (!actorPermissions.has(permission.name)) continue;
        if (nextChecked) {
          next.add(permission.name);
        } else {
          next.delete(permission.name);
        }
      }
      return { ...current, permissionNames: next };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNameError(null);
    setPermissionError(null);

    const name = form.name.trim();
    if (!name) {
      setNameError('Role name is required.');
      return;
    }

    const payload: RolePayload = {
      name,
      description: form.description.trim() || null,
      permission_names: Array.from(form.permissionNames),
    };

    try {
      if (isEditing && role) {
        await updateMutation.mutateAsync(payload);
        toast.success('Role updated', `${name} has been saved.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Role created', `${name} is ready to assign.`);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const nameMessage = error.fieldError('name');
        const permissionMessage = error.fieldError('permission_names');
        if (nameMessage) setNameError(nameMessage);
        if (permissionMessage) setPermissionError(permissionMessage);
        if (!nameMessage && !permissionMessage) {
          toast.error(isEditing ? 'Could not update role' : 'Could not create role', error.message);
        }
      } else {
        toast.error(isEditing ? 'Could not update role' : 'Could not create role', 'Something went wrong. Please try again.');
      }
    }
  }

  const formId = 'role-editor-form';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? `Edit ${role.name}` : 'New role'}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={onClose} disabled={isSaving} />
          <ModalSaveAction form={formId} isLoading={isSaving} />
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Role name" htmlFor="role-name" error={nameError ?? undefined} required>
            <Input
              id="role-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              invalid={Boolean(nameError)}
            />
          </Field>
          <Field label="Description" htmlFor="role-description">
            <Input
              id="role-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What this role is for"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-strong">Permissions</p>
            <p className="text-xs text-muted">{form.permissionNames.size} selected</p>
          </div>
          {permissionError && <p className="mb-2 text-xs text-danger">{permissionError}</p>}

          {permissionsLoading ? (
            <p className="rounded-md border border-border px-3 py-6 text-center text-xs text-muted">Loading permissions…</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
              {groups.map(([group, groupPermissions], index) => {
                const grantable = groupPermissions.filter((permission) => actorPermissions.has(permission.name));
                const allChecked =
                  grantable.length > 0 && grantable.every((permission) => form.permissionNames.has(permission.name));

                return (
                  <div key={group} className={cn('p-3', index > 0 && 'border-t border-border')}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
                      {grantable.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(grantable, !allChecked)}
                          className="text-xs font-medium text-teal hover:underline"
                        >
                          {allChecked ? 'Clear' : 'Select all'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {groupPermissions.map((permission) => {
                        const held = actorPermissions.has(permission.name);
                        const checked = form.permissionNames.has(permission.name);
                        return (
                          <label
                            key={permission.id}
                            className={cn(
                              'relative flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors',
                              !held && 'cursor-not-allowed opacity-50',
                              held && checked ? 'border-teal bg-teal/5' : 'border-transparent hover:bg-surface-soft',
                            )}
                            title={!held ? "You don't hold this permission yourself, so you can't grant it." : undefined}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border-border"
                              checked={checked}
                              disabled={!held}
                              onChange={() => togglePermission(permission.name)}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-strong">{permissionLabel(permission)}</span>
                              {permission.description && (
                                <span className="block truncate text-xs text-muted">{permission.description}</span>
                              )}
                            </span>
                            {!held && <Lock className="ml-auto mt-0.5 h-3 w-3 flex-shrink-0 text-muted" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

function RolesPermissionsContent() {
  const { hasPermission, session } = useAuth();
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissionCatalog();
  const deleteMutation = useDeleteRole();
  const toast = useToast();

  const [editorState, setEditorState] = useState<{ role: Role | null; nonce: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const actorPermissions = useMemo(() => new Set(session?.permissions ?? []), [session]);
  const canCreate = hasPermission('roles.create');
  const canUpdate = hasPermission('roles.update');
  const canDelete = hasPermission('roles.delete');

  function openCreate() {
    setEditorState((current) => ({ role: null, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function openEdit(role: Role) {
    setEditorState((current) => ({ role, nonce: (current?.nonce ?? 0) + 1 }));
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Role deleted', `${deleteTarget.name} has been removed.`);
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.fieldError('role') ?? error.message : 'Could not delete this role.';
      toast.error('Could not delete role', message);
    }
  }

  if (rolesQuery.isLoading) return <LoadingState label="Loading roles..." fill />;
  if (rolesQuery.isError) return <ErrorState error={rolesQuery.error} onRetry={() => rolesQuery.refetch()} />;

  const roles = rolesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {roles.length} role{roles.length === 1 ? '' : 's'} defined for this organization.
        </p>
        {canCreate && (
          <Button type="button" variant="primary" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            New role
          </Button>
        )}
      </div>

      {roles.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="No roles yet"
          description="Roles determine what people can see and do once they sign in."
        />
      ) : (
        <Card>
          <DataTable
            columns={roleColumns({ canUpdate, canDelete, onEdit: openEdit, onDelete: setDeleteTarget })}
            rows={roles}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      {editorState && (
        <RoleEditorModal
          key={`${editorState.nonce}-${editorState.role?.id ?? 'new'}`}
          onClose={() => setEditorState(null)}
          role={editorState.role}
          permissions={permissionsQuery.data ?? []}
          permissionsLoading={permissionsQuery.isLoading}
          actorPermissions={actorPermissions}
        />
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete role"
        footer={
          <>
            <ModalCancelAction onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} />
            <ModalConfirmAction
              variant="danger"
              icon={Trash2}
              isLoading={deleteMutation.isPending}
              onClick={handleDelete}
              title="Delete"
            />
          </>
        }
      >
        <p className="text-sm text-strong">
          Delete <span className="font-medium">{deleteTarget?.name}</span>? This can't be undone.
        </p>
        {Boolean(deleteTarget?.user_count) && (
          <p className="mt-2 text-xs text-danger">
            This role is currently assigned to {deleteTarget?.user_count} user(s) — reassign them before deleting it.
          </p>
        )}
      </Modal>
    </div>
  );
}

export function RolesPermissionsPage() {
  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        subtitle="Define what each role in this organization can see and do."
        breadcrumbs={[{ label: 'Control center', to: '/settings/control-center' }, { label: 'Roles & permissions' }]}
      />
      <RequirePermission permission="roles.view">
        <RolesPermissionsContent />
      </RequirePermission>
    </div>
  );
}
