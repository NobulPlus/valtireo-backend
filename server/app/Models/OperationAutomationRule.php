<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'name', 'trigger', 'conditions', 'actions', 'is_active', 'execution_order', 'created_by_id'])]
class OperationAutomationRule extends Model implements AuditableContract
{
    use Auditable;

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(OperationAutomationRun::class);
    }

    protected function casts(): array
    {
        return ['conditions' => 'array', 'actions' => 'array', 'is_active' => 'boolean'];
    }
}
