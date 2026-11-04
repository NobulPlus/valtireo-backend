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

#[Fillable([
    'organization_id', 'project_id', 'key', 'type', 'title', 'description',
    'story_template', 'acceptance_criteria', 'definition_of_done',
    'status_id', 'priority', 'reporter_id', 'assignee_id', 'parent_id', 'epic_id', 'iteration_id',
    'estimate', 'remaining_estimate', 'due_at', 'start_at', 'position', 'version',
    'started_at', 'completed_at', 'archived_at',
])]
class OrbitWorkItem extends Model implements AuditableContract
{
    use Auditable, BelongsToOrganization;

    public function getRouteKeyName(): string
    {
        return 'key';
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(OrbitProject::class, 'project_id');
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(OrbitStatus::class, 'status_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function epic(): BelongsTo
    {
        return $this->belongsTo(self::class, 'epic_id');
    }

    public function epicItems(): HasMany
    {
        return $this->hasMany(self::class, 'epic_id');
    }

    public function iteration(): BelongsTo
    {
        return $this->belongsTo(OrbitIteration::class, 'iteration_id');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(OrbitLabel::class, 'orbit_work_item_labels', 'work_item_id', 'label_id')
            ->withTimestamps();
    }

    public function watchers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'orbit_work_item_watchers', 'work_item_id', 'user_id')
            ->withTimestamps();
    }

    public function comments(): HasMany
    {
        return $this->hasMany(OrbitComment::class, 'work_item_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(OrbitAttachment::class, 'work_item_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(OrbitWorkItemActivity::class, 'work_item_id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(OrbitWorkItemLink::class, 'work_item_id');
    }

    protected function casts(): array
    {
        return [
            'story_template' => 'array',
            'estimate' => 'decimal:2',
            'remaining_estimate' => 'decimal:2',
            'due_at' => 'date',
            'start_at' => 'date',
            'position' => 'decimal:10',
            'version' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}
