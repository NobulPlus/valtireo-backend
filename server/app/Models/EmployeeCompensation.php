<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'employee_id', 'pay_group_id', 'base_salary', 'currency', 'pay_frequency', 'recurring_components', 'effective_from', 'effective_to', 'status', 'created_by_id'])]
class EmployeeCompensation extends Model implements AuditableContract
{
    use Auditable;

    protected $table = 'employee_compensations';

    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function payGroup(): BelongsTo { return $this->belongsTo(PayGroup::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by_id'); }
    protected function casts(): array { return ['base_salary' => 'decimal:2', 'recurring_components' => 'array', 'effective_from' => 'date', 'effective_to' => 'date']; }
}
