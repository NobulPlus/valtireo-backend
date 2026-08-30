import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useMyAssets } from '@/features/assets/api';
import { useDateFormatter } from '@/lib/dateFormat';

export function MyAssetsPage() {
  const { formatDate } = useDateFormatter();
  const assetsQuery = useMyAssets();
  const assets = assetsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader title="My assets" subtitle="Equipment and items currently assigned to you." />
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
                <li key={asset.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-strong">{asset.name}</p>
                    <p className="text-xs text-muted">
                      {asset.asset_tag} · {asset.category}
                      {asset.assigned_at && ` · Assigned ${formatDate(asset.assigned_at)}`}
                    </p>
                  </div>
                  <StatusBadge status={asset.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
