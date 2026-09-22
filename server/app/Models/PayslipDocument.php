<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
#[Fillable(['organization_id','payroll_run_item_id','file_path','file_name','mime_type','checksum','generated_by_id','generated_at'])]
class PayslipDocument extends Model { public function item(): BelongsTo{return $this->belongsTo(PayrollRunItem::class,'payroll_run_item_id');} protected function casts(): array{return ['generated_at'=>'datetime'];} }
