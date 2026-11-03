<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'name', 'category', 'position', 'is_default'])]
class OrbitStatus extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(OrbitProject::class, 'project_id');
    }

    public function workItems(): HasMany
    {
        return $this->hasMany(OrbitWorkItem::class, 'status_id');
    }

    protected function casts(): array
    {
        return ['position' => 'integer', 'is_default' => 'boolean'];
    }
}
