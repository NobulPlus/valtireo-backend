<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['project_id', 'name', 'color'])]
class OrbitLabel extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(OrbitProject::class, 'project_id');
    }

    public function workItems(): BelongsToMany
    {
        return $this->belongsToMany(OrbitWorkItem::class, 'orbit_work_item_labels', 'label_id', 'work_item_id')
            ->withTimestamps();
    }
}
