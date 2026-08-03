<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'employee_id',
    'date_of_birth',
    'gender',
    'personal_email',
    'residential_address',
    'next_of_kin_name',
    'next_of_kin_phone',
    'emergency_contact_name',
    'emergency_contact_phone',
    'completion_status',
])]
class EmployeeProfile extends Model implements AuditableContract
{
    use Auditable;

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
        ];
    }
}
