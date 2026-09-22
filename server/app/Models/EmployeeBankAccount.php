<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'employee_id', 'bank_name', 'bank_code', 'account_number', 'account_name', 'is_primary', 'verification_status', 'verified_at'])]
class EmployeeBankAccount extends Model implements AuditableContract
{
    use Auditable;
    protected $hidden = ['account_number'];
    protected $auditExclude = ['account_number'];
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    protected function casts(): array { return ['account_number' => 'encrypted', 'is_primary' => 'boolean', 'verified_at' => 'datetime']; }
}
