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
    'previous_manager_id',
    'new_manager_id',
    'changed_by_id',
    'effective_date',
    'reason',
    'note',
])]
class EmployeeReportingHistory extends Model implements AuditableContract
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

    public function previousManager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'previous_manager_id');
    }

    public function newManager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'new_manager_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
        ];
    }
}
