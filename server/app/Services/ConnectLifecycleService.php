<?php

namespace App\Services;

use App\Models\ConnectMeeting;
use Illuminate\Support\Facades\DB;

class ConnectLifecycleService
{
    public function __construct(private readonly ConnectMediaService $media, private readonly ModuleEntitlementService $modules) {}

    public function reconcile(string $id): void
    {
        $meeting = DB::transaction(function () use ($id) {
            $meeting = ConnectMeeting::with(['host.employee', 'organization'])->lockForUpdate()->findOrFail($id);
            if (! $meeting->ended_at) {
                $hostActive = $meeting->host?->organization_id === $meeting->organization_id
                    && $meeting->host?->employee?->organization_id === $meeting->organization_id
                    && $meeting->host?->employee?->status === 'active';
                $organizationActive = $meeting->organization && ! in_array($meeting->organization->status, ['suspended', 'rejected']);
                $subscribed = $meeting->organization && $this->modules->organizationHasActiveSubscription($meeting->organization, 'connect');
                if (now()->gte($meeting->ends_at) || ! $hostActive || ! $organizationActive || ! $subscribed) {
                    $meeting->update(['status' => $meeting->started_at ? 'ended' : 'cancelled', 'ended_at' => now()]);
                }
            }

            return $meeting;
        });

        if ($meeting->ended_at) {
            if ($meeting->started_at && ! $meeting->room_closed_at) {
                $this->media->closeRoom($meeting);
                $meeting->update(['room_closed_at' => now()]);
            }

            return;
        }
        if ($meeting->status !== 'live') {
            return;
        }

        $allowed = $meeting->members()->where('users.organization_id', $meeting->organization_id)
            ->whereHas('employee', fn ($query) => $query->where('organization_id', $meeting->organization_id)->where('status', 'active'))
            ->pluck('users.id')->map(fn ($id) => 'user-'.$id)->all();
        foreach ($this->media->participants($meeting) as $participant) {
            $identity = $participant['identity'] ?? null;
            if (is_string($identity) && ! in_array($identity, $allowed, true)) {
                $this->media->removeParticipant($meeting, $identity);
            }
        }
    }
}
