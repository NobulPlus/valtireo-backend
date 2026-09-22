<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['organization_id', 'payroll_run_id', 'employee_id', 'employee_compensation_id', 'employee_number', 'employee_name', 'employment_snapshot', 'bank_snapshot', 'bank_account_number', 'payable_days', 'period_days', 'base_pay', 'gross_pay', 'total_deductions', 'net_pay', 'employer_contributions', 'status', 'exceptions'])]
class PayrollRunItem extends Model
{
    protected $hidden = ['bank_account_number'];
    public function payrollRun(): BelongsTo { return $this->belongsTo(PayrollRun::class); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
    public function compensation(): BelongsTo { return $this->belongsTo(EmployeeCompensation::class, 'employee_compensation_id'); }
    public function lines(): HasMany { return $this->hasMany(PayrollRunItemLine::class); }
    public function payslipDocument(): \Illuminate\Database\Eloquent\Relations\HasOne { return $this->hasOne(PayslipDocument::class); }
    protected function casts(): array { return ['employment_snapshot' => 'array', 'bank_snapshot' => 'array', 'bank_account_number' => 'encrypted', 'exceptions' => 'array']; }
}
