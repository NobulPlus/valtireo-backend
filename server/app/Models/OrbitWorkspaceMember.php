<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['organization_id', 'workspace_id', 'user_id', 'role'])]
class OrbitWorkspaceMember extends Model
{
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(OrbitWorkspace::class, 'workspace_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
