import { useEffect, useState } from 'react';
import { CheckCircle2, History, Package, Pencil, Plus, TriangleAlert, UserRound, UserX, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { DonutChart, RankedBarList } from '@/components/ui/Charts';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useToast } from '@/components/ui/Toast';
import { useEmployees } from '@/features/employees/api';
import { useSetupLookups } from '@/features/workspace/api';
import {
  useAsset,
  useAssetCategories,
  useAssetReporting,
  useAssets,
  useAssignAsset,
  useCreateAsset,
  useReportAssetFault,
  useReturnAsset,
  useReturnAssetToService,
  useUpdateAsset,
  type AssetFilters,
} from '@/features/assets/api';
import { AssetCategoriesPanel } from '@/features/settings/SetupDataPages';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Asset } from '@/types/api';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function AssetFormModal({ asset, onClose }: { asset: Asset | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = asset === 'new';
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset(asset && asset !== 'new' ? asset.id : 0);
  const categoriesQuery = useAssetCategories();
  const lookupsQuery = useSetupLookups();
  const categoryOptions = (categoriesQuery.data?.data ?? []).map((cat) => ({ value: String(cat.id), label: cat.name }));
  const locationOptions = (lookupsQuery.data?.locations ?? []).map((location) => ({ value: String(location.id), label: location.name }));

  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('');
  const [locationId, setLocationId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (asset && asset !== 'new') {
      setName(asset.name);
      setAssetTag(asset.asset_tag);
      setSerialNumber(asset.serial_number ?? '');
      setCategoryId(asset.category ? String(asset.category.id) : '');
      setCondition(asset.condition ?? '');
      setLocationId(asset.location ? String(asset.location.id) : '');
      setPurchaseDate(asset.purchase_date ?? '');
      setWarrantyExpiresAt(asset.warranty_expires_at ?? '');
      setNotes(asset.notes ?? '');
    } else if (asset === 'new') {
      setName('');
      setAssetTag('');
      setSerialNumber('');
      setCategoryId('');
      setCondition('');
      setLocationId('');
      setPurchaseDate('');
      setWarrantyExpiresAt('');
      setNotes('');
    }
  }, [asset]);

  const mutation = isNew ? createMutation : updateMutation;

  async function handleSave() {
    if (!categoryId) return;
    const payload = {
      name,
      asset_tag: assetTag,
      serial_number: serialNumber || null,
      asset_category_id: Number(categoryId),
      condition: condition || undefined,
      organization_location_id: locationId ? Number(locationId) : null,
      purchase_date: purchaseDate || null,
      warranty_expires_at: warrantyExpiresAt || null,
      notes: notes || null,
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Asset added');
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('Asset updated');
      }
      onClose();
    } catch (error) {
      toast.error('Could not save asset', actionError(error, 'Could not save this asset.'));
    }
  }

  return (
    <Modal
      open={asset !== null}
      onClose={onClose}
      title={isNew ? 'Add asset' : 'Edit asset'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction
            title="Save"
            isLoading={mutation.isPending}
            disabled={!name.trim() || !assetTag.trim() || !categoryId}
            onClick={handleSave}
          />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Asset tag</span>
            <Input value={assetTag} onChange={(event) => setAssetTag(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Serial number</span>
            <Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <SelectMenu value={categoryId} onChange={setCategoryId} options={categoryOptions} placeholder="Select a category" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Condition</span>
            <SelectMenu value={condition} onChange={setCondition} options={[{ value: '', label: 'Unspecified' }, ...CONDITION_OPTIONS]} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Location</span>
          <SelectMenu value={locationId} onChange={setLocationId} options={[{ value: '', label: 'No fixed location' }, ...locationOptions]} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Purchase date</span>
            <Input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Warranty expires</span>
            <Input type="date" value={warrantyExpiresAt} onChange={(event) => setWarrantyExpiresAt(event.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

function AssignAssetModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const toast = useToast();
  const employeesQuery = useEmployees({ per_page: 100, status: 'active' }, asset !== null);
  const assignMutation = useAssignAsset(asset?.id ?? 0);
  const returnMutation = useReturnAsset(asset?.id ?? 0);
  const [employeeId, setEmployeeId] = useState('');
  const [condition, setCondition] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setEmployeeId(asset?.assigned_to ? String(asset.assigned_to.id) : '');
    setCondition(asset?.condition ?? '');
    setNote('');
  }, [asset]);

  const isAssigned = Boolean(asset?.assigned_to);
  const isReassigning = isAssigned && employeeId !== String(asset?.assigned_to?.id ?? '');

  async function handleAssign() {
    if (!employeeId) return;
    try {
      await assignMutation.mutateAsync({ employee_id: Number(employeeId), condition: condition || undefined, note: note || null });
      toast.success(isReassigning ? 'Asset reassigned' : 'Asset assigned');
      onClose();
    } catch (error) {
      toast.error('Could not assign asset', actionError(error, 'Could not assign this asset.'));
    }
  }

  async function handleReturn() {
    if (!condition) return;
    try {
      await returnMutation.mutateAsync({ condition, note: note || null });
      toast.success('Asset returned');
      onClose();
    } catch (error) {
      toast.error('Could not return asset', actionError(error, 'Could not return this asset.'));
    }
  }

  return (
    <Modal open={asset !== null} onClose={onClose} title={asset ? `Assign "${asset.name}"` : 'Assign asset'}>
      <div className="space-y-4">
        {isAssigned && (
          <p className="text-sm text-muted">
            Currently assigned to <span className="font-medium text-strong">{asset?.assigned_to?.full_name}</span>.
          </p>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
          <SelectMenu
            value={employeeId}
            onChange={setEmployeeId}
            options={(employeesQuery.data?.data ?? []).map((employee) => ({
              value: String(employee.id),
              label: `${employee.first_name} ${employee.last_name}`,
            }))}
            placeholder="Select an employee"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Condition {isAssigned ? 'on handover' : 'on issue'}</span>
          <SelectMenu value={condition} onChange={setCondition} options={CONDITION_OPTIONS} placeholder="Select condition" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Note</span>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note..." />
        </label>
        <div className="flex items-center justify-end gap-2">
          {isAssigned && (
            <Button type="button" variant="secondary" disabled={!condition} isLoading={returnMutation.isPending} onClick={handleReturn}>
              <UserX className="h-3.5 w-3.5" /> Return
            </Button>
          )}
          <Button type="button" disabled={!employeeId || assignMutation.isPending} isLoading={assignMutation.isPending} onClick={handleAssign}>
            <UserRound className="h-3.5 w-3.5" /> {isReassigning ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const INCIDENT_LABELS: Record<string, string> = {
  fault_reported: 'Sent to maintenance',
  returned_to_service: 'Returned to service',
  retired: 'Retired',
};

type HistoryRow =
  | { kind: 'ticket'; at: string | null; ticket: NonNullable<Asset['tickets']>[number] }
  | { kind: 'incident'; at: string; incident: NonNullable<Asset['incidents']>[number] }
  | { kind: 'assignment'; at: string | null; assignment: NonNullable<Asset['assignment_history']>[number] };

function AssetHistoryModal({ assetId, onClose }: { assetId: number | null; onClose: () => void }) {
  const { formatDateTime } = useDateFormatter();
  const assetQuery = useAsset(assetId);
  const asset = assetQuery.data;

  const rows: HistoryRow[] = [
    ...(asset?.tickets ?? []).map((ticket): HistoryRow => ({ kind: 'ticket', at: ticket.submitted_at, ticket })),
    ...(asset?.incidents ?? []).map((incident): HistoryRow => ({ kind: 'incident', at: incident.created_at, incident })),
    ...(asset?.assignment_history ?? []).map(
      (assignment): HistoryRow => ({ kind: 'assignment', at: assignment.returned_at ?? assignment.assigned_at, assignment }),
    ),
  ].sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());

  return (
    <Modal open={assetId !== null} onClose={onClose} title={asset ? `History — ${asset.name}` : 'Asset history'}>
      {assetQuery.isLoading && <LoadingState label="Loading history..." />}
      {assetQuery.data && rows.length === 0 && (
        <EmptyState title="No history yet" description="Tickets, assignments, and maintenance events for this asset will appear here." />
      )}
      {rows.length > 0 && (
        <ul className="-mx-1 space-y-1">
          {rows.map((row) => {
            if (row.kind === 'ticket') {
              return (
                <li key={`ticket-${row.ticket.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{row.ticket.subject}</p>
                    <p className="text-xs text-muted">Ticket · {formatDateTime(row.ticket.submitted_at)}</p>
                  </div>
                  <StatusBadge status={row.ticket.status} />
                </li>
              );
            }

            if (row.kind === 'incident') {
              return (
                <li key={`incident-${row.incident.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{INCIDENT_LABELS[row.incident.event] ?? row.incident.event}</p>
                    <p className="text-xs text-muted">
                      {row.incident.reported_by?.name ?? 'System'} · {formatDateTime(row.incident.created_at)}
                      {row.incident.note && ` · ${row.incident.note}`}
                    </p>
                  </div>
                  <StatusBadge status={row.incident.new_status ?? 'maintenance'} />
                </li>
              );
            }

            const { assignment } = row;
            const isReturned = Boolean(assignment.returned_at);

            return (
              <li key={`assignment-${assignment.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-strong">
                    {isReturned ? 'Returned by' : 'Issued to'} {assignment.employee?.full_name ?? `employee #${assignment.employee_id}`}
                  </p>
                  <p className="text-xs text-muted">
                    {isReturned ? formatDateTime(assignment.returned_at) : formatDateTime(assignment.assigned_at)}
                    {isReturned && assignment.return_condition && ` · condition: ${assignment.return_condition}`}
                    {!isReturned && assignment.issue_condition && ` · condition: ${assignment.issue_condition}`}
                    {(isReturned ? assignment.return_note : assignment.issue_note) &&
                      ` · ${isReturned ? assignment.return_note : assignment.issue_note}`}
                  </p>
                </div>
                <StatusBadge status={isReturned ? 'returned' : 'assigned'} />
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function MaintenanceActionModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const reportFaultMutation = useReportAssetFault(asset?.id ?? 0);
  const returnToServiceMutation = useReturnAssetToService(asset?.id ?? 0);
  const isSendingToMaintenance = asset?.status !== 'maintenance';
  const mutation = isSendingToMaintenance ? reportFaultMutation : returnToServiceMutation;

  useEffect(() => {
    setNote('');
  }, [asset]);

  async function handleSubmit() {
    if (!note.trim()) return;
    try {
      await mutation.mutateAsync(note);
      toast.success(isSendingToMaintenance ? 'Asset sent to maintenance' : 'Asset returned to service');
      onClose();
    } catch (error) {
      toast.error('Could not update asset', actionError(error, 'Could not update this asset.'));
    }
  }

  return (
    <Modal
      open={asset !== null}
      onClose={onClose}
      title={asset ? `${isSendingToMaintenance ? 'Send to maintenance' : 'Return to service'} — ${asset.name}` : 'Update asset'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Confirm" isLoading={mutation.isPending} disabled={!note.trim()} onClick={handleSubmit} />
        </>
      }
    >
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted">
          {isSendingToMaintenance ? 'What is wrong with this asset?' : 'What was done to fix it?'}
        </span>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the issue or repair..." />
      </label>
    </Modal>
  );
}

function AssetReportingSection() {
  const { formatDateTime } = useDateFormatter();
  const reportingQuery = useAssetReporting();
  const reporting = reportingQuery.data;

  if (reportingQuery.isLoading) return <LoadingState label="Loading reporting..." />;
  if (reportingQuery.isError || !reporting) return <ErrorState error={reportingQuery.error} onRetry={() => reportingQuery.refetch()} />;

  const maintenanceCount = reporting.by_status.find((entry) => entry.status === 'maintenance')?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total assets" value={reporting.total} icon={Package} />
        <StatTile label="In maintenance" value={maintenanceCount} icon={Wrench} tone={maintenanceCount ? 'warning' : 'default'} />
        <StatTile
          label="Avg. time in maintenance"
          value={reporting.average_days_in_maintenance !== null ? `${reporting.average_days_in_maintenance}d` : '—'}
          icon={TriangleAlert}
        />
        <StatTile label="Open incidents" value={reporting.open_incidents.length} icon={TriangleAlert} tone={reporting.open_incidents.length ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardBody>
            <DonutChart totalLabel="Assets" entries={reporting.by_category.map((entry) => ({ label: entry.name, value: entry.total }))} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList valueLabel="Assets" entries={reporting.by_status.map((entry) => ({ label: entry.status, value: entry.total }))} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Currently in maintenance</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {reporting.open_incidents.length === 0 && (
              <EmptyState title="Nothing in maintenance" description="Every asset is currently in service." />
            )}
            {reporting.open_incidents.length > 0 && (
              <ul className="divide-y divide-border">
                {reporting.open_incidents.map((incident) => (
                  <li key={incident.asset_id} className="px-5 py-3 text-sm">
                    <p className="font-medium text-strong">{incident.asset_name}</p>
                    <p className="text-xs text-muted">
                      {incident.reported_by ?? 'System'} · {incident.since ? formatDateTime(incident.since) : '—'}
                    </p>
                    {incident.note && <p className="mt-1 text-xs text-muted">{incident.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AssetManagementContent() {
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | 'new' | null>(null);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState<Asset | null>(null);

  const categoriesQuery = useAssetCategories();
  const categoryOptions = (categoriesQuery.data?.data ?? []).map((cat) => ({ value: String(cat.id), label: cat.name }));

  const filters: AssetFilters = {
    status: status || undefined,
    asset_category_id: categoryId ? Number(categoryId) : undefined,
    search: search || undefined,
  };
  const assetsQuery = useAssets(filters);
  const assets = assetsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Track company equipment and who it's currently assigned to."
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setCategoriesModalOpen(true)}>
              Categories
            </Button>
            <Button type="button" variant="primary" onClick={() => setEditingAsset('new')}>
              <Plus className="h-3.5 w-3.5" /> Add asset
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <AssetReportingSection />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input placeholder="Search name or tag" value={search} onChange={(event) => setSearch(event.target.value)} />
            <SelectMenu value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]} />
            <SelectMenu value={categoryId} onChange={setCategoryId} options={[{ value: '', label: 'All categories' }, ...categoryOptions]} />
          </div>

          {assetsQuery.isLoading && <LoadingState label="Loading assets..." />}
          {assetsQuery.isError && <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />}
          {assetsQuery.data && assets.length === 0 && (
            <EmptyState title="No assets found" description="Add an asset or adjust your filters." />
          )}
          {assets.length > 0 && (
            <ul className="-mx-5 divide-y divide-border">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{asset.name}</p>
                    <p className="text-xs text-muted">
                      {asset.asset_tag} · {asset.category?.name ?? 'Uncategorized'}
                      {asset.assigned_to && ` · Assigned to ${asset.assigned_to.full_name}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={asset.status} />
                    <Button type="button" size="icon" title="History" aria-label="History" onClick={() => setHistoryAssetId(asset.id)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    {asset.status !== 'retired' && (
                      <Button
                        type="button"
                        size="icon"
                        title={asset.status === 'maintenance' ? 'Return to service' : 'Send to maintenance'}
                        aria-label={asset.status === 'maintenance' ? 'Return to service' : 'Send to maintenance'}
                        onClick={() => setMaintenanceAsset(asset)}
                      >
                        {asset.status === 'maintenance' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button type="button" size="icon" title="Assign" aria-label="Assign" onClick={() => setAssigningAsset(asset)}>
                      <UserRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" title="Edit" aria-label="Edit" onClick={() => setEditingAsset(asset)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <AssetFormModal asset={editingAsset} onClose={() => setEditingAsset(null)} />
      <AssignAssetModal asset={assigningAsset} onClose={() => setAssigningAsset(null)} />
      <AssetHistoryModal assetId={historyAssetId} onClose={() => setHistoryAssetId(null)} />
      <MaintenanceActionModal asset={maintenanceAsset} onClose={() => setMaintenanceAsset(null)} />

      <Modal open={categoriesModalOpen} onClose={() => setCategoriesModalOpen(false)} title="Asset categories" size="lg">
        <AssetCategoriesPanel />
      </Modal>
    </div>
  );
}

export function AssetManagementPage() {
  return (
    <RequirePermission permission="assets.view" moduleKey="assets">
      <AssetManagementContent />
    </RequirePermission>
  );
}
