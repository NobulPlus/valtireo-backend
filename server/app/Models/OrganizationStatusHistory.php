<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'changed_by_id',
    'previous_status',
    'new_status',
    'reason',
])]
class OrganizationStatusHistory extends Model implements AuditableContract
{
    use Auditable;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_id');
    }
}
