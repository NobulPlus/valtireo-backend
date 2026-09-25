import { useState } from 'react';
import { AlertTriangle, CalendarClock, MapPin, Package, ShieldCheck, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSendAction } from '@/components/ui/ModalActions';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useMyAssets, useReportAssetFault } from '@/features/assets/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Asset } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-strong">{value || 'Not set'}</span>
    </div>
  );
}

function FaultModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const mutation = useReportAssetFault(asset?.id ?? 0);

  async function submit() {
    if (!asset || !note.trim()) return;

    try {
      await mutation.mutateAsync(note);
      toast.success('Fault reported', `${asset.name} has been sent to asset maintenance.`);
      setNote('');
      onClose();
    } catch (error) {
      toast.error('Could not report fault', actionError(error, 'Please try again.'));
    }
  }

  return (
    <Modal
      open={Boolean(asset)}
      onClose={onClose}
      title={asset ? `Report fault - ${asset.name}` : 'Report fault'}
      footer={
        <>
          <ModalCancelAction disabled={mutation.isPending} onClick={onClose} />
          <ModalSendAction title="Report fault" disabled={!note.trim()} isLoading={mutation.isPending} onClick={submit} />
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted">Describe the issue so HR or operations can assess, repair, or replace the item.</p>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is wrong with the asset?" />
      </div>
    </Modal>
  );
}

export function MyAssetsPage() {
  const { formatDate } = useDateFormatter();
  const assetsQuery = useMyAssets();
  const assets = assetsQuery.data?.data ?? [];
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [faultAsset, setFaultAsset] = useState<Asset | null>(null);

  const inMaintenance = assets.filter((asset) => asset.status === 'maintenance').length;
  const underWarranty = assets.filter((asset) => asset.warranty_expires_at && new Date(asset.warranty_expires_at) >= new Date()).length;

  return (
    <div>
      <PageHeader title="My assets" subtitle="Equipment and items assigned to you, with support and lifecycle details." />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Assigned assets" value={assets.length} icon={Package} />
        <StatTile label="Under warranty" value={underWarranty} icon={ShieldCheck} tone="success" />
        <StatTile label="Needs service" value={inMaintenance} icon={Wrench} tone={inMaintenance ? 'warning' : 'default'} />
      </div>

      <Card>
        <CardBody className="p-0">
          {assetsQuery.isLoading && <LoadingState label="Loading your assets..." />}
          {assetsQuery.isError && <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />}
          {assetsQuery.data && assets.length === 0 && (
            <EmptyState title="No assets assigned" description="Equipment assigned to you will appear here." />
          )}
          {assets.length > 0 && (
            <ul className="divide-y divide-border">
              {assets.map((asset) => (
                <li key={asset.id} className="flex flex-col gap-3 px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
                  <button type="button" onClick={() => setSelectedAsset(asset)} className="min-w-0 text-left">
                    <p className="font-medium text-strong">{asset.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {asset.asset_tag} · {asset.category?.name ?? 'Uncategorized'}
                      {asset.assigned_at && ` · Assigned ${formatDate(asset.assigned_at)}`}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={asset.status} />
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedAsset(asset)}>
                      Details
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setFaultAsset(asset)}>
                      <AlertTriangle className="h-4 w-4" />
                      Report fault
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} title={selectedAsset?.name ?? 'Asset detail'} size="lg">
        {selectedAsset && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Asset information</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <InfoRow label="Asset tag" value={selectedAsset.asset_tag} />
                <InfoRow label="Serial number" value={selectedAsset.serial_number} />
                <InfoRow label="Category" value={selectedAsset.category?.name} />
                <InfoRow label="Status" value={selectedAsset.status} />
                <InfoRow label="Condition" value={selectedAsset.condition} />
                <InfoRow label="Notes" value={selectedAsset.notes} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <InfoRow label="Assigned on" value={selectedAsset.assigned_at ? formatDate(selectedAsset.assigned_at) : null} />
                <InfoRow label="Location" value={selectedAsset.location?.name} />
                <InfoRow label="Purchase date" value={selectedAsset.purchase_date ? formatDate(selectedAsset.purchase_date) : null} />
                <InfoRow label="Warranty expires" value={selectedAsset.warranty_expires_at ? formatDate(selectedAsset.warranty_expires_at) : null} />
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent history</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2">
                {(selectedAsset.assignment_history ?? []).length === 0 ? (
                  <p className="text-sm text-muted">No assignment history is available yet.</p>
                ) : (
                  (selectedAsset.assignment_history ?? []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="rounded-md bg-surface-soft px-3 py-2 text-sm">
                      <p className="font-medium text-strong">
                        {entry.returned_at ? 'Returned' : 'Assigned'}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                        {entry.assigned_at ? formatDate(entry.assigned_at) : 'Date not set'}
                        {entry.returned_at ? ` · returned ${formatDate(entry.returned_at)}` : ''}
                        {selectedAsset.location?.name ? (
                          <>
                            {' · '}
                            <MapPin className="mr-1 inline h-3.5 w-3.5" />
                            {selectedAsset.location.name}
                          </>
                        ) : null}
                      </p>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </Modal>

      <FaultModal asset={faultAsset} onClose={() => setFaultAsset(null)} />
    </div>
  );
}
