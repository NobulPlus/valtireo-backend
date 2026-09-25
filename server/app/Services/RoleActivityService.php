<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Role;
use App\Models\RoleActivity;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class RoleActivityService
{
    /**
     * Org-wide feed — deliberately not scoped to a single role by default,
     * since a `role_deleted` activity has `role_id === null` (the role no
     * longer exists) and would otherwise be unreachable.
     */
    public function listFor(User $actor, ?int $roleId = null, int $perPage = 25): LengthAwarePaginator
    {
        return RoleActivity::query()
            ->where('organization_id', $actor->organization_id)
            ->when($roleId, fn ($query, int $id) => $query->where('role_id', $id))
            ->with(['role', 'actor'])
            ->latest('id')
            ->paginate(min(max($perPage, 1), 100));
    }

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
