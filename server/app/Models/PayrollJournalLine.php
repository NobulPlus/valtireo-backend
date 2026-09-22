<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
#[Fillable(['organization_id','payroll_journal_batch_id','account_code','account_name','description','debit','credit','dimensions'])]
class PayrollJournalLine extends Model { public function batch(): BelongsTo{return $this->belongsTo(PayrollJournalBatch::class,'payroll_journal_batch_id');} protected function casts(): array{return ['dimensions'=>'array'];} }
