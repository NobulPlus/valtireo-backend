import { useMemo, useState } from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { Permission } from '@/types/api';
import { permissionGroup, permissionLabel } from '@/features/settings/RolesPermissionsPage';
import { usePermissionCatalog, useUpdatePermission } from '@/features/settings/rolesApi';

interface EditFormState {
  label: string;
  description: string;
  group: string;
}

function PermissionEditorModal({ permission, onClose }: { permission: Permission | null; onClose: () => void }) {
  const toast = useToast();
  const updateMutation = useUpdatePermission(permission?.id ?? 0);
  const [form, setForm] = useState<EditFormState>({
    label: permission?.label ?? '',
    description: permission?.description ?? '',
    group: permission?.group ?? '',
  });

  async function handleSubmit() {
    if (!permission) return;

    try {
      await updateMutation.mutateAsync({
        label: form.label.trim() || null,
        description: form.description.trim() || null,
        group: form.group.trim() || null,
      });
      toast.success('Permission updated', `${permission.name} has been saved.`);
      onClose();
    } catch (error) {
      toast.error('Could not save permission', error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal
      open={permission !== null}
      onClose={onClose}
      title={permission ? `Curate ${permission.name}` : 'Curate permission'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalSaveAction title="Save" isLoading={updateMutation.isPending} onClick={handleSubmit} />
        </>
      }
    >
      {permission && (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface-soft px-3 py-2">
            <p className="text-xs font-medium text-muted">Code key (never editable — every `can()` check depends on it)</p>
            <p className="mt-0.5 font-mono text-sm text-strong">{permission.name}</p>
          </div>
          <Field label="Display label" hint="Shown in the role permission-picker instead of the raw code key.">
            <Input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder={permissionLabel(permission)}
            />
          </Field>
          <Field label="Group" hint="Groups related permissions together in the picker.">
            <Input
              value={form.group}
              onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))}
              placeholder={permissionGroup(permission)}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What this permission grants"
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function PlatformPermissionCatalogContent() {
  const catalogQuery = usePermissionCatalog();
  const [editing, setEditing] = useState<Permission | null>(null);

  const groups = useMemo(() => {
    const byGroup = new Map<string, Permission[]>();
    for (const permission of catalogQuery.data ?? []) {
      const group = permissionGroup(permission);
      const list = byGroup.get(group) ?? [];
      list.push(permission);
      byGroup.set(group, list);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalogQuery.data]);

  if (catalogQuery.isLoading) return <LoadingState label="Loading permission catalog..." fill />;
  if (catalogQuery.isError) return <ErrorState error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />;
  if (!catalogQuery.data || catalogQuery.data.length === 0) {
    return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No permissions in the catalog" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        {catalogQuery.data.length} permission{catalogQuery.data.length === 1 ? '' : 's'} across {groups.length} group
        {groups.length === 1 ? '' : 's'}. Curate the label, description, and group shown to every organization's role
        picker — the code key itself can never be changed here.
      </p>

      {groups.map(([group, permissions]) => (
        <Card key={group} className="overflow-hidden">
          <div className="border-b border-border bg-surface-soft px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
          </div>
          <ul className="divide-y divide-border">
            {permissions.map((permission, index) => (
              <li
                key={permission.id}
                className={cn('flex items-center justify-between gap-3 px-4 py-3 text-sm', index === 0 && 'pt-3')}
              >
                <div className="min-w-0">
                  <p className="font-medium text-strong">{permissionLabel(permission)}</p>
                  <p className="truncate font-mono text-xs text-muted">{permission.name}</p>
                  {permission.description && <p className="mt-0.5 truncate text-xs text-muted">{permission.description}</p>}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(permission)}
                  title="Edit"
                  aria-label={`Edit ${permission.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <PermissionEditorModal permission={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export function PlatformPermissionCatalogPage() {
  return (
    <div>
      <PageHeader
        title="Permission catalog"
        subtitle="Curate how every permission in the system is labeled and grouped for organizations."
        breadcrumbs={[{ label: 'Platform console', to: '/platform' }]}
      />
      <PlatformPermissionCatalogContent />
    </div>
  );
}
