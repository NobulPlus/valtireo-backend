<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'name', 'slug', 'description', 'visibility', 'owner_id', 'archived_at'])]
class OrbitWorkspace extends Model implements AuditableContract
{
    use Auditable, BelongsToOrganization;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrbitWorkspaceMember::class, 'workspace_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'orbit_workspace_members', 'workspace_id', 'user_id')
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function projects(): HasMany
    {
        return $this->hasMany(OrbitProject::class, 'workspace_id');
    }

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }
}
