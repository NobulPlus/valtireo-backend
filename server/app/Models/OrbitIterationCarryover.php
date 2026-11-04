<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['from_iteration_id', 'to_iteration_id', 'work_item_id', 'carried_by_id', 'created_at'])]
class OrbitIterationCarryover extends Model
{
    public $timestamps = false;

    protected static function booted(): void
    {
        static::creating(function (self $model): void {
            $model->created_at ??= now();
        });
    }

    public function fromIteration(): BelongsTo
    {
        return $this->belongsTo(OrbitIteration::class, 'from_iteration_id');
    }

    public function toIteration(): BelongsTo
    {
        return $this->belongsTo(OrbitIteration::class, 'to_iteration_id');
    }

    public function workItem(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkItem::class, 'work_item_id');
    }

    public function carriedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'carried_by_id');
    }

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
