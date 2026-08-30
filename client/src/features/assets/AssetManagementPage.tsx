import { useEffect, useState } from 'react';
import { History, Pencil, Plus, UserRound, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useToast } from '@/components/ui/Toast';
import { useEmployees } from '@/features/employees/api';
import { useAsset, useAssets, useCreateAsset, useUpdateAsset, type AssetFilters } from '@/features/assets/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Asset } from '@/types/api';

const CATEGORY_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
  { value: 'id_card', label: 'ID card' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function AssetFormModal({ asset, onClose }: { asset: Asset | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = asset === 'new';
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset(asset && asset !== 'new' ? asset.id : 0);

  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [category, setCategory] = useState('laptop');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (asset && asset !== 'new') {
      setName(asset.name);
      setAssetTag(asset.asset_tag);
      setCategory(asset.category);
      setNotes(asset.notes ?? '');
    } else if (asset === 'new') {
      setName('');
      setAssetTag('');
      setCategory('laptop');
      setNotes('');
    }
  }, [asset]);

  const mutation = isNew ? createMutation : updateMutation;

  async function handleSave() {
    try {
      if (isNew) {
        await createMutation.mutateAsync({ name, asset_tag: assetTag, category, notes: notes || null });
        toast.success('Asset added');
      } else {
        await updateMutation.mutateAsync({ name, asset_tag: assetTag, category, notes: notes || null });
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
          <ModalConfirmAction title="Save" isLoading={mutation.isPending} disabled={!name.trim() || !assetTag.trim()} onClick={handleSave} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Asset tag</span>
          <Input value={assetTag} onChange={(event) => setAssetTag(event.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Category</span>
          <SelectMenu value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        </label>
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
  const updateMutation = useUpdateAsset(asset?.id ?? 0);
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    setEmployeeId(asset?.assigned_to ? String(asset.assigned_to.id) : '');
  }, [asset]);

  async function handleAssign() {
    if (!employeeId) return;
    try {
      await updateMutation.mutateAsync({ status: 'assigned', assigned_to_employee_id: Number(employeeId) });
      toast.success('Asset assigned');
      onClose();
    } catch (error) {
      toast.error('Could not assign asset', actionError(error, 'Could not assign this asset.'));
    }
  }

  async function handleUnassign() {
    try {
      await updateMutation.mutateAsync({ status: 'available', assigned_to_employee_id: null });
      toast.success('Asset unassigned');
      onClose();
    } catch (error) {
      toast.error('Could not unassign asset', actionError(error, 'Could not unassign this asset.'));
    }
  }

  return (
    <Modal open={asset !== null} onClose={onClose} title={asset ? `Assign "${asset.name}"` : 'Assign asset'}>
      <div className="space-y-4">
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
        <div className="flex items-center justify-end gap-2">
          {asset?.assigned_to && (
            <Button type="button" variant="secondary" isLoading={updateMutation.isPending} onClick={handleUnassign}>
              <UserX className="h-3.5 w-3.5" /> Unassign
            </Button>
          )}
          <Button type="button" disabled={!employeeId} isLoading={updateMutation.isPending} onClick={handleAssign}>
            <UserRound className="h-3.5 w-3.5" /> Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssetTicketHistoryModal({ assetId, onClose }: { assetId: number | null; onClose: () => void }) {
  const { formatDateTime } = useDateFormatter();
  const assetQuery = useAsset(assetId);
  const asset = assetQuery.data;
  const tickets = asset?.tickets ?? [];

  return (
    <Modal open={assetId !== null} onClose={onClose} title={asset ? `Tickets — ${asset.name}` : 'Ticket history'}>
      {assetQuery.isLoading && <LoadingState label="Loading tickets..." />}
      {assetQuery.data && tickets.length === 0 && (
        <EmptyState title="No tickets yet" description="No service desk tickets have referenced this asset." />
      )}
      {tickets.length > 0 && (
        <ul className="-mx-1 space-y-1">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex items-center justify-between gap-3 rounded-md px-1 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-strong">{ticket.subject}</p>
                <p className="text-xs text-muted">{formatDateTime(ticket.submitted_at)}</p>
              </div>
              <StatusBadge status={ticket.status} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function AssetManagementContent() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | 'new' | null>(null);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);

  const filters: AssetFilters = { status: status || undefined, category: category || undefined, search: search || undefined };
  const assetsQuery = useAssets(filters);
  const assets = assetsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Track company equipment and who it's currently assigned to."
        actions={
          <Button type="button" variant="primary" onClick={() => setEditingAsset('new')}>
            <Plus className="h-3.5 w-3.5" /> Add asset
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input placeholder="Search name or tag" value={search} onChange={(event) => setSearch(event.target.value)} />
            <SelectMenu value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]} />
            <SelectMenu value={category} onChange={setCategory} options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]} />
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
                      {asset.asset_tag} · {asset.category}
                      {asset.assigned_to && ` · Assigned to ${asset.assigned_to.full_name}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={asset.status} />
                    <Button type="button" size="icon" title="Ticket history" aria-label="Ticket history" onClick={() => setHistoryAssetId(asset.id)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
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
      <AssetTicketHistoryModal assetId={historyAssetId} onClose={() => setHistoryAssetId(null)} />
    </div>
  );
}

export function AssetManagementPage() {
  return (
    <RequirePermission permission="assets.view">
      <AssetManagementContent />
    </RequirePermission>
  );
}
