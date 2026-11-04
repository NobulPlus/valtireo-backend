<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'work_item_id', 'actor_id', 'event', 'title', 'from_value', 'to_value', 'metadata', 'created_at'])]
class OrbitWorkItemActivity extends Model
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected function casts(): array
    {
        return ['from_value' => 'array', 'to_value' => 'array', 'metadata' => 'array', 'created_at' => 'datetime'];
    }
}
