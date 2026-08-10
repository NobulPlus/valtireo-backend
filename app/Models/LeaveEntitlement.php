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
    'employee_id',
    'leave_type_id',
    'leave_period_id',
    'days_allocated',
    'days_used',
    'days_pending',
    'notes',
])]
class LeaveEntitlement extends Model implements AuditableContract
{
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function leavePeriod(): BelongsTo
    {
        return $this->belongsTo(LeavePeriod::class);
    }

    protected function casts(): array
    {
        return [
            'days_allocated' => 'decimal:2',
            'days_used' => 'decimal:2',
            'days_pending' => 'decimal:2',
        ];
    }
}
