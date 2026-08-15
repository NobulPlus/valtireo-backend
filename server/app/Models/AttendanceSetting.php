<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'timezone',
    'late_grace_minutes',
    'early_checkout_grace_minutes',
    'rounding_minutes',
    'allow_employee_clock_in',
    'allow_employee_corrections',
    'require_approval_for_corrections',
    'allowed_sources',
])]
class AttendanceSetting extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    protected function casts(): array
    {
        return [
            'late_grace_minutes' => 'integer',
            'early_checkout_grace_minutes' => 'integer',
            'rounding_minutes' => 'integer',
            'allow_employee_clock_in' => 'boolean',
            'allow_employee_corrections' => 'boolean',
            'require_approval_for_corrections' => 'boolean',
            'allowed_sources' => 'array',
        ];
    }
}
