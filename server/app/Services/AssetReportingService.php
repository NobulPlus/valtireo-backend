<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetIncident;
use App\Models\User;

class AssetReportingService
{
    /**
     * @return array<string, mixed>
     */
    public function reporting(User $user): array
    {
        $organizationId = $user->organization_id;

        $assets = Asset::query()
            ->with('category:id,name')
            ->where('organization_id', $organizationId)
            ->get(['id', 'asset_category_id', 'status']);

        $incidents = AssetIncident::query()
            ->where('organization_id', $organizationId)
            ->orderBy('asset_id')
            ->orderBy('created_at')
            ->get(['asset_id', 'event', 'created_at']);

        return [
            'total' => $assets->count(),
            'by_status' => $this->byStatus($assets),
            'by_category' => $this->byCategory($assets),
            'average_days_in_maintenance' => $this->averageDaysInMaintenance($incidents),
            'open_incidents' => $this->openIncidents($organizationId),
        ];
    }

    /**
     * @param \Illuminate\Support\Collection<int, Asset> $assets
     *
     * @return array<int, array<string, mixed>>
     */
    private function byStatus($assets): array
    {
        return $assets
            ->groupBy('status')
            ->map(fn ($group, $status) => ['status' => $status, 'total' => $group->count()])
            ->values()
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @param \Illuminate\Support\Collection<int, Asset> $assets
     *
     * @return array<int, array<string, mixed>>
     */
    private function byCategory($assets): array
    {
        return $assets
            ->groupBy(fn (Asset $asset) => $asset->category?->name ?? 'Uncategorized')
            ->map(fn ($group, $name) => ['name' => $name, 'total' => $group->count()])
            ->values()
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * Pairs each fault_reported incident with the next returned_to_service
     * incident for the same asset (chronologically) to measure turnaround
     * time. Assets currently still in maintenance have no matching return
     * yet and are excluded from the average, not counted as zero days.
     *
     * @param \Illuminate\Support\Collection<int, AssetIncident> $incidents
     */
    private function averageDaysInMaintenance($incidents): ?float
    {
        $durations = [];

        foreach ($incidents->groupBy('asset_id') as $assetIncidents) {
            $openedAt = null;

            foreach ($assetIncidents as $incident) {
                if ($incident->event === 'fault_reported') {
                    $openedAt = $incident->created_at;
                } elseif ($incident->event === 'returned_to_service' && $openedAt) {
                    $durations[] = $openedAt->diffInHours($incident->created_at) / 24;
                    $openedAt = null;
                }
            }
        }

        return $durations === [] ? null : round(array_sum($durations) / count($durations), 1);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function openIncidents(int $organizationId): array
    {
        return Asset::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'maintenance')
            ->with(['category:id,name', 'incidents' => fn ($query) => $query->where('event', 'fault_reported')->with('reportedBy')->limit(1)])
            ->get()
            ->map(fn (Asset $asset) => [
                'asset_id' => $asset->id,
                'asset_name' => $asset->name,
                'category' => $asset->category?->name,
                'note' => $asset->incidents->first()?->note,
                'reported_by' => $asset->incidents->first()?->reportedBy?->name,
                'since' => $asset->incidents->first()?->created_at,
            ])
            ->all();
    }
}
