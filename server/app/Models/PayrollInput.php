<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use OwenIt\Auditing\Auditable; use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
#[Fillable(['organization_id','employee_id','payroll_run_id','payroll_component_id','type','description','effective_date','quantity','rate','amount','status','metadata','created_by_id'])]
class PayrollInput extends Model implements AuditableContract { use Auditable; public function employee(): BelongsTo{return $this->belongsTo(Employee::class);} public function component(): BelongsTo{return $this->belongsTo(PayrollComponent::class,'payroll_component_id');} protected function casts(): array{return ['effective_date'=>'date','metadata'=>'array'];} }
