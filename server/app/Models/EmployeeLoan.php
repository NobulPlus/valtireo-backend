<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\Relations\HasMany; use OwenIt\Auditing\Auditable; use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
#[Fillable(['organization_id','employee_id','reference','name','principal','interest_amount','total_repayable','installment_amount','outstanding_balance','starts_on','ends_on','status','created_by_id'])]
class EmployeeLoan extends Model implements AuditableContract { use Auditable; public function employee(): BelongsTo{return $this->belongsTo(Employee::class);} public function repayments(): HasMany{return $this->hasMany(LoanRepayment::class);} protected function casts(): array{return ['starts_on'=>'date','ends_on'=>'date'];} }
