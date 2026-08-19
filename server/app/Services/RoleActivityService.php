<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Role;
use App\Models\RoleActivity;
use App\Models\User;

class RoleActivityService
{
    /**
     * @param array<string, mixed> $metadata
     */
    public function record(
        Organization $organization,
        ?Role $role,
        ?User $actor,
        string $event,
        string $title,
        ?string $description = null,
        array $metadata = []
    ): RoleActivity {
        return RoleActivity::query()->create([
            'organization_id' => $organization->id,
            'role_id' => $role?->id,
            'actor_id' => $actor?->id,
            'event' => $event,
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata,
        ]);
    }
}
