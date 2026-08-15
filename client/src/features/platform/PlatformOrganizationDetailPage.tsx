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
  Power,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { Textarea } from '@/components/ui/Input';
import { ApiError } from '@/lib/apiClient';
import { usePlatformOrganization, useUpdateOrganizationStatus } from '@/features/platform/api';

function fallback(value: string | null | undefined): string {
  return value || 'Not set';
}

function formatDate(value: string | null): string {
  if (!value) return 'No expiry';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [statusAction, setStatusAction] = useState<'active' | 'suspended' | null>(null);
  const [reason, setReason] = useState('');
  const organization = usePlatformOrganization(id);
  const statusMutation = useUpdateOrganizationStatus(id);

  if (organization.isLoading) return <LoadingState label="Loading organization..." />;
  if (organization.isError) return <ErrorState error={organization.error} onRetry={() => organization.refetch()} />;
  if (!organization.data) return <EmptyState title="Organization data is not available" />;

  const data = organization.data;
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
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-medium text-strong hover:bg-surface-soft"
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
            <CardTitle>Subscribed modules</CardTitle>
            <Layers3 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody className="space-y-2">
            {data.modules.length === 0 ? (
              <EmptyState title="No modules subscribed" />
            ) : (
              data.modules.map((module) => (
                <div key={module.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-strong">{module.name ?? module.key}</p>
                    <p className="text-xs text-muted">{module.category ?? 'Uncategorized'} - expires {formatDate(module.expires_at)}</p>
                  </div>
                  <StatusBadge status={module.status} />
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
    </div>
  );
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
