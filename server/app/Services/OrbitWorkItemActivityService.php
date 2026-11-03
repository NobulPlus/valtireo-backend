<?php

namespace App\Services;

use App\Models\OrbitWorkItem;
use App\Models\OrbitWorkItemActivity;
use App\Models\User;

/**
 * The fourth instance of this codebase's narrative-activity-log pattern
 * (RoleActivity, TicketActivity, EmployeeProfileActivity), applied to work
 * items — a table + a record() method per feature, not a shared one.
 */
class OrbitWorkItemActivityService
{
    /**
     * @param array<string, mixed>|null $from
     * @param array<string, mixed>|null $to
     * @param array<string, mixed> $metadata
     */
    public function record(OrbitWorkItem $workItem, ?User $actor, string $event, string $title, ?array $from = null, ?array $to = null, array $metadata = []): OrbitWorkItemActivity
    {
        return OrbitWorkItemActivity::create([
            'organization_id' => $workItem->organization_id,
            'work_item_id' => $workItem->id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'title' => $title,
            'from_value' => $from,
            'to_value' => $to,
            'metadata' => $metadata,
        ]);
    }
}
