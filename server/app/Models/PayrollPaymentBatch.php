<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use OwenIt\Auditing\Auditable; use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
#[Fillable(['organization_id','payroll_run_id','reference','format','status','payment_count','total_amount','file_path','checksum','generated_by_id','generated_at','marked_paid_at'])]
class PayrollPaymentBatch extends Model implements AuditableContract { use Auditable; public function payrollRun(): BelongsTo{return $this->belongsTo(PayrollRun::class);} protected function casts(): array{return ['generated_at'=>'datetime','marked_paid_at'=>'datetime'];} }
