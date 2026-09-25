<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\Relations\HasMany; use OwenIt\Auditing\Auditable; use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
#[Fillable(['organization_id','payroll_run_id','reference','status','journal_date','currency','total_debit','total_credit','created_by_id'])]
class PayrollJournalBatch extends Model implements AuditableContract { use Auditable; public function lines(): HasMany{return $this->hasMany(PayrollJournalLine::class);} public function payrollRun(): BelongsTo{return $this->belongsTo(PayrollRun::class);} protected function casts(): array{return ['journal_date'=>'date'];} }
