import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarCheck,
  FileCheck2,
  Layers3,
  MapPin,
  Pencil,
  Power,
  Settings2,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { ApiError } from '@/lib/apiClient';
import { isValidEmail } from '@/lib/validation';
import {
  usePlatformOrganization,
  useUpdateOrganizationModule,
  useUpdateOrganizationStatus,
  useUpdateOrganizationWorkspace,
} from '@/features/platform/api';
import type { PlatformOrganizationDetail } from '@/types/api';

type ModuleRow = PlatformOrganizationDetail['modules'][number];
type ModuleStatus = 'active' | 'trial' | 'suspended';
type Duration = 'forever' | 'one_year' | 'custom';

const STATUS_OPTIONS: { value: ModuleStatus; label: string; description: string }[] = [
  { value: 'active', label: 'Active', description: 'Full access to the module' },
  { value: 'trial', label: 'Trial', description: 'Time-boxed evaluation access' },
  { value: 'suspended', label: 'Disabled', description: 'Hidden and inaccessible to the organization' },
];

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 'forever', label: 'Forever - no expiry' },
  { value: 'one_year', label: '1 year from today' },
  { value: 'custom', label: 'Specific date' },
];

function fallback(value: string | null | undefined): string {
  return value || 'Not set';
}

function formatDate(value: string | null): string {
  if (!value) return 'No expiry';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function PlatformOrganizationDetailContent({ data, id }: { data: PlatformOrganizationDetail; id: string | undefined }) {
  const [statusAction, setStatusAction] = useState<'active' | 'suspended' | null>(null);
  const [reason, setReason] = useState('');
  const [managingModule, setManagingModule] = useState<ModuleRow | null>(null);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus>('active');
  const [moduleDuration, setModuleDuration] = useState<Duration>('forever');
  const [moduleExpiresAt, setModuleExpiresAt] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSupportEmail, setWorkspaceSupportEmail] = useState('');
  const [workspaceTimezone, setWorkspaceTimezone] = useState('');
  const statusMutation = useUpdateOrganizationStatus(id);
  const moduleMutation = useUpdateOrganizationModule(id);
  const workspaceMutation = useUpdateOrganizationWorkspace(id);

  const org = data.organization;
  const isSuspended = org.status === 'suspended';
  const actionLabel = statusAction === 'suspended' ? 'Suspend organization' : 'Reactivate organization';
  const mutationError = statusMutation.error instanceof ApiError ? statusMutation.error.message : null;

  async function submitStatusAction() {
    if (!statusAction) return;

    await statusMutation.mutateAsync({
      status: statusAction,
      reason: reason.trim() || undefined,
    });
    setStatusAction(null);
    setReason('');
  }

  const moduleMutationError = moduleMutation.error instanceof ApiError ? moduleMutation.error.message : null;

  function openModuleManager(module: ModuleRow) {
    moduleMutation.reset();
    setModuleStatus(module.status === 'locked' || module.status === 'suspended' ? 'active' : module.status);
    setModuleDuration(module.expires_at ? 'custom' : 'forever');
    setModuleExpiresAt(module.expires_at ? module.expires_at.slice(0, 10) : '');
    setManagingModule(module);
  }

  async function submitModuleAction() {
    if (!managingModule) return;

    await moduleMutation.mutateAsync({
      moduleId: managingModule.id,
      status: moduleStatus,
      duration: moduleStatus === 'suspended' ? undefined : moduleDuration,
      expires_at: moduleStatus !== 'suspended' && moduleDuration === 'custom' ? moduleExpiresAt : undefined,
    });
    setManagingModule(null);
  }

  const workspaceMutationError = workspaceMutation.error instanceof ApiError ? workspaceMutation.error.message : null;
  const workspaceSupportEmailError =
    workspaceSupportEmail.trim() && !isValidEmail(workspaceSupportEmail) ? 'Enter a valid email address' : undefined;

  function openWorkspaceEditor() {
    workspaceMutation.reset();
    setWorkspaceName(data.workspace.workspace_name);
    setWorkspaceSupportEmail(data.workspace.identity.support_email ?? '');
    setWorkspaceTimezone(data.workspace.localization.timezone);
    setEditingWorkspace(true);
  }

  async function submitWorkspaceEdit() {
    await workspaceMutation.mutateAsync({
      name: workspaceName.trim(),
      support_email: workspaceSupportEmail.trim() || null,
      timezone: workspaceTimezone.trim(),
    });
    setEditingWorkspace(false);
  }

  return (
    <div>
      <PageHeader
        title={org.name}
        subtitle={`${org.code} - ${fallback(org.country)} - ${fallback(org.sector)}`}
        breadcrumbs={[{ label: 'Platform console', to: '/platform' }, { label: org.name }]}
        status={<StatusBadge status={org.status} />}
        actions={
          <>
            <Button
              variant={isSuspended ? 'primary' : 'danger'}
              onClick={() => {
                statusMutation.reset();
                setReason('');
                setStatusAction(isSuspended ? 'active' : 'suspended');
              }}
            >
              {isSuspended ? <Power className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {isSuspended ? 'Reactivate' : 'Suspend'}
            </Button>
            <Link
              to="/platform"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-strong hover:bg-surface-soft"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </>
        }
      />

      {isSuspended && (
        <div className="mb-5">
          <Alert tone="warning">
            This organization is suspended. Its users cannot sign in or use protected Valtireo APIs until it is reactivated.
          </Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Employees" value={data.metrics.employees} icon={Users} />
        <StatTile label="Active employees" value={data.metrics.active_employees} icon={CalendarCheck} tone="success" />
        <StatTile label="Departments" value={data.metrics.departments} icon={Building2} />
        <StatTile label="Pending documents" value={data.metrics.pending_documents} icon={FileCheck2} tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace identity</CardTitle>
            <Button variant="ghost" size="icon" title="Edit workspace identity" aria-label="Edit workspace identity" onClick={openWorkspaceEditor}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <InfoRow label="Workspace name" value={data.workspace.workspace_name} />
            <InfoRow label="Support email" value={data.workspace.identity.support_email} />
            <InfoRow label="Theme" value={`${data.workspace.theme.primary_color} / ${data.workspace.theme.font_family}`} />
            <InfoRow label="Timezone" value={data.workspace.localization.timezone} />
            <InfoRow label="Address" value={[org.address, org.city, org.state].filter(Boolean).join(', ') || null} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <Layers3 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody className="space-y-2">
            {data.modules.length === 0 ? (
              <EmptyState title="No modules configured on the platform" />
            ) : (
              data.modules.map((module) => (
                <div key={module.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-strong">{module.name ?? module.key}</p>
                    <p className="text-xs text-muted">
                      {module.category ?? 'Uncategorized'}
                      {module.status !== 'locked' && ` - expires ${formatDate(module.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={module.status} />
                    <Button variant="ghost" size="icon" title="Manage module" aria-label="Manage module" onClick={() => openModuleManager(module)}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization admins</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {data.admins.length === 0 ? (
              <EmptyState title="No organization admin found" />
            ) : (
              data.admins.map((admin) => (
                <div key={admin.id} className="rounded-md bg-surface-soft px-3 py-2">
                  <p className="text-sm font-medium text-strong">{admin.name}</p>
                  <p className="text-xs text-muted">{admin.email}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody className="space-y-2">
            {data.locations.length === 0 ? (
              <EmptyState title="No locations configured" />
            ) : (
              data.locations.map((location) => (
                <div key={location.id} className="flex items-start justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-strong">{location.name}</p>
                    <p className="text-xs text-muted">
                      {[location.city, location.state, location.country].filter(Boolean).join(', ') || 'Location not set'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {location.is_primary && <StatusBadge status="primary" />}
                    <StatusBadge status={location.is_active ? 'active' : 'suspended'} />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Operational footprint</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <InfoBlock label="Users" value={data.metrics.users} />
          <InfoBlock label="Pending invitations" value={data.metrics.pending_invitations} />
          <InfoBlock label="Document requirements" value={data.metrics.document_requirements} />
          <InfoBlock label="Leave requests pending" value={data.metrics.leave_requests_pending} />
          <InfoBlock label="Attendance records" value={data.metrics.attendance_records} />
          <InfoBlock label="Locations" value={data.metrics.locations} />
          <InfoBlock label="Phone" value={fallback(org.phone)} />
          <InfoBlock label="Website" value={fallback(org.website)} />
        </CardBody>
      </Card>

      <Modal
        open={Boolean(statusAction)}
        onClose={() => {
          if (!statusMutation.isPending) {
            setStatusAction(null);
            setReason('');
          }
        }}
        title={actionLabel}
        footer={
          <>
            <ModalCancelAction
              disabled={statusMutation.isPending}
              onClick={() => {
                setStatusAction(null);
                setReason('');
              }}
            />
            <ModalConfirmAction
              title={actionLabel}
              variant={statusAction === 'suspended' ? 'danger' : 'primary'}
              isLoading={statusMutation.isPending}
              onClick={submitStatusAction}
              icon={statusAction === 'suspended' ? Ban : Power}
            />
          </>
        }
      >
        <div className="space-y-4">
          <p className="leading-6 text-muted">
            {statusAction === 'suspended'
              ? `This will immediately cut off ${org.name}'s users from login and protected API access.`
              : `This will restore access for ${org.name}'s users.`}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Reason</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional note for audit/support context"
              disabled={statusMutation.isPending}
            />
          </label>
          {mutationError && <Alert>{mutationError}</Alert>}
        </div>
      </Modal>

      <Modal
        open={Boolean(managingModule)}
        onClose={() => {
          if (!moduleMutation.isPending) setManagingModule(null);
        }}
        title={managingModule ? `Manage ${managingModule.name ?? managingModule.key}` : 'Manage module'}
        footer={
          <>
            <ModalCancelAction disabled={moduleMutation.isPending} onClick={() => setManagingModule(null)} />
            <ModalSaveAction
              title="Save module access"
              isLoading={moduleMutation.isPending}
              disabled={moduleStatus !== 'suspended' && moduleDuration === 'custom' && !moduleExpiresAt}
              onClick={submitModuleAction}
            />
          </>
        }
      >
        <div className="space-y-4">
          {managingModule?.description && <p className="leading-6 text-muted">{managingModule.description}</p>}

          <Field label="Access">
            <SelectMenu
              value={moduleStatus}
              onChange={(value) => setModuleStatus(value as ModuleStatus)}
              options={STATUS_OPTIONS}
              disabled={moduleMutation.isPending}
            />
          </Field>

          {moduleStatus !== 'suspended' && (
            <Field label="Duration">
              <SelectMenu
                value={moduleDuration}
                onChange={(value) => setModuleDuration(value as Duration)}
                options={DURATION_OPTIONS}
                disabled={moduleMutation.isPending}
              />
            </Field>
          )}

          {moduleStatus !== 'suspended' && moduleDuration === 'custom' && (
            <Field label="Expires on">
              <DatePicker value={moduleExpiresAt} onChange={setModuleExpiresAt} />
            </Field>
          )}

          {moduleMutationError && <Alert>{moduleMutationError}</Alert>}
        </div>
      </Modal>

      <Modal
        open={editingWorkspace}
        onClose={() => {
          if (!workspaceMutation.isPending) setEditingWorkspace(false);
        }}
        title="Edit workspace identity"
        footer={
          <>
            <ModalCancelAction disabled={workspaceMutation.isPending} onClick={() => setEditingWorkspace(false)} />
            <ModalSaveAction
              isLoading={workspaceMutation.isPending}
              disabled={!workspaceName.trim() || !workspaceTimezone.trim() || Boolean(workspaceSupportEmailError)}
              onClick={submitWorkspaceEdit}
            />
          </>
        }
      >
        <div className="space-y-4">
          <p className="leading-6 text-muted">
            Changes here are made on behalf of {org.name} and apply immediately to their workspace.
          </p>

          <Field label="Workspace name" required>
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              disabled={workspaceMutation.isPending}
            />
          </Field>

          <Field
            label="Support email"
            hint="Shown to the organization's employees for help requests."
            error={workspaceSupportEmailError}
          >
            <Input
              type="email"
              invalid={Boolean(workspaceSupportEmailError)}
              value={workspaceSupportEmail}
              onChange={(event) => setWorkspaceSupportEmail(event.target.value)}
              placeholder="support@yourorg.com"
              disabled={workspaceMutation.isPending}
            />
          </Field>

          <Field label="Timezone" required hint="IANA timezone, e.g. Africa/Lagos.">
            <Input
              value={workspaceTimezone}
              onChange={(event) => setWorkspaceTimezone(event.target.value)}
              disabled={workspaceMutation.isPending}
            />
          </Field>

          {workspaceMutationError && <Alert>{workspaceMutationError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

export function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const organization = usePlatformOrganization(id);

  if (organization.isLoading) {
    return (
      <div>
        <PageHeader title="Organization" breadcrumbs={[{ label: 'Platform console', to: '/platform' }]} />
        <LoadingState label="Loading organization..." fill />
      </div>
    );
  }

  if (organization.isError) {
    return (
      <div>
        <PageHeader title="Organization" breadcrumbs={[{ label: 'Platform console', to: '/platform' }]} />
        <ErrorState error={organization.error} onRetry={() => organization.refetch()} />
      </div>
    );
  }

  if (!organization.data) {
    return (
      <div>
        <PageHeader title="Organization" breadcrumbs={[{ label: 'Platform console', to: '/platform' }]} />
        <EmptyState title="Organization data is not available" />
      </div>
    );
  }

  return <PlatformOrganizationDetailContent data={organization.data} id={id} />;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-strong">{fallback(value)}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-soft px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-medium text-strong">{value}</p>
    </div>
  );
}
