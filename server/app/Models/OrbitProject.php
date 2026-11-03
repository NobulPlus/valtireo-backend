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

#[Fillable(['organization_id', 'workspace_id', 'name', 'key_prefix', 'description', 'mode', 'visibility', 'next_item_number', 'archived_at'])]
class OrbitProject extends Model implements AuditableContract
{
    use Auditable, BelongsToOrganization;

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkspace::class, 'workspace_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrbitProjectMember::class, 'project_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'orbit_project_members', 'project_id', 'user_id')
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function statuses(): HasMany
    {
        return $this->hasMany(OrbitStatus::class, 'project_id')->orderBy('position');
    }

    public function labels(): HasMany
    {
        return $this->hasMany(OrbitLabel::class, 'project_id');
    }

    public function iterations(): HasMany
    {
        return $this->hasMany(OrbitIteration::class, 'project_id');
    }

    public function workItems(): HasMany
    {
        return $this->hasMany(OrbitWorkItem::class, 'project_id');
    }

    protected function casts(): array
    {
        return ['next_item_number' => 'integer', 'archived_at' => 'datetime'];
    }
}
