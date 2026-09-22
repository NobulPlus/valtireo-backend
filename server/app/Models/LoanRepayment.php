<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Attributes\Fillable; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo;
#[Fillable(['organization_id','employee_loan_id','payroll_run_item_id','amount','paid_on','status','reference'])]
class LoanRepayment extends Model { public function loan(): BelongsTo{return $this->belongsTo(EmployeeLoan::class,'employee_loan_id');} }
