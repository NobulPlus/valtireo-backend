<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'name', 'goal', 'starts_at', 'ends_at', 'capacity_note', 'status', 'started_at', 'completed_at'])]
class OrbitIteration extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(OrbitProject::class, 'project_id');
    }

    public function workItems(): HasMany
    {
        return $this->hasMany(OrbitWorkItem::class, 'iteration_id');
    }

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
