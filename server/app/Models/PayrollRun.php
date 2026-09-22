<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable(['organization_id', 'pay_group_id', 'reference', 'name', 'period_start', 'period_end', 'payment_date', 'currency', 'status', 'employee_count', 'total_gross', 'total_deductions', 'total_net', 'total_employer_contributions', 'calculation_context', 'created_by_id', 'finalized_by_id', 'published_by_id', 'calculated_at', 'submitted_at', 'approved_at', 'finalized_at', 'published_at', 'voided_at', 'void_reason'])]
class PayrollRun extends Model implements AuditableContract
{
    use Auditable;
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function payGroup(): BelongsTo { return $this->belongsTo(PayGroup::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by_id'); }
    public function finalizedBy(): BelongsTo { return $this->belongsTo(User::class, 'finalized_by_id'); }
    public function publishedBy(): BelongsTo { return $this->belongsTo(User::class, 'published_by_id'); }
    public function items(): HasMany { return $this->hasMany(PayrollRunItem::class); }
    protected function casts(): array { return ['period_start' => 'date', 'period_end' => 'date', 'payment_date' => 'date', 'calculation_context' => 'array', 'calculated_at' => 'datetime', 'submitted_at' => 'datetime', 'approved_at' => 'datetime', 'finalized_at' => 'datetime', 'published_at' => 'datetime', 'voided_at' => 'datetime']; }
}
