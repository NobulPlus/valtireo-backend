<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'work_item_id', 'linked_type', 'linked_id', 'created_by_id', 'created_at'])]
class OrbitWorkItemLink extends Model
{
    use BelongsToOrganization;

    public $timestamps = false;

    protected static function booted(): void
    {
        static::creating(function (self $model): void {
            $model->created_at ??= now();
        });
    }

    public function workItem(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkItem::class, 'work_item_id');
    }

    /**
     * `linked_type` stores a short registry key (e.g. "ticket"), not a
     * fully-qualified class name — resolved against
     * OrbitWorkItemLinkController::LINK_TYPES, never Eloquent's morph
     * machinery, so the API never has to accept or expose an internal
     * namespace string.
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
