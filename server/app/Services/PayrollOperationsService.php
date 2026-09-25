<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\EmployeeStatutoryProfile;
use App\Models\LeaveRequest;
use App\Models\LeaveHoliday;
use App\Models\LeaveWorkDay;
use App\Models\LoanRepayment;
use App\Models\PayrollInput;
use App\Models\PayrollRun;
use App\Models\PayrollRunItem;
use App\Models\PayrollSetting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PayrollOperationsService
{
    public function apply(PayrollRunItem $item, Employee $employee, PayrollRun $run, PayrollSetting $settings): void
    {
        $this->applyUnpaidLeave($item, $employee, $run);
        $this->applyOvertime($item, $employee, $run, $settings);
        $this->applyManualInputs($item, $employee, $run);
        $this->applyLoanInstallments($item, $employee, $run);
        $this->applyStatutoryRules($item, $employee, $settings);
    }

    public function postFinalizedLoanRepayments(PayrollRun $run): void
    {
        DB::transaction(function () use ($run): void {
            $run->items()->with('lines')->get()->each(function (PayrollRunItem $item) use ($run): void {
                foreach ($item->lines->where('type', 'deduction') as $line) {
                    if (! str_starts_with($line->component_code, 'LOAN:')) continue;
                    $loanId = (int) Str::after($line->component_code, 'LOAN:');
                    $loan = EmployeeLoan::query()->where('organization_id', $run->organization_id)->whereKey($loanId)->lockForUpdate()->first();
                    if (! $loan || LoanRepayment::query()->where('employee_loan_id', $loan->id)->where('payroll_run_item_id', $item->id)->exists()) continue;
                    $amount = min((float) $line->amount, (float) $loan->outstanding_balance);
                    LoanRepayment::query()->create(['organization_id'=>$run->organization_id,'employee_loan_id'=>$loan->id,'payroll_run_item_id'=>$item->id,'amount'=>$amount,'paid_on'=>$run->payment_date,'reference'=>$run->reference]);
                    $balance = max(0, (float) $loan->outstanding_balance - $amount);
                    $loan->update(['outstanding_balance'=>$balance,'status'=>$balance <= 0 ? 'repaid' : 'active']);
                }
            });
        });
    }

    public function reverseFinalizedLoanRepayments(PayrollRun $run): void
    {
        DB::transaction(function () use ($run): void {
            $itemIds=$run->items()->pluck('id');
            LoanRepayment::query()->whereIn('payroll_run_item_id',$itemIds)->where('status','posted')->with('loan')->lockForUpdate()->get()->each(function(LoanRepayment $repayment): void {
                $repayment->loan?->update(['outstanding_balance'=>(float)$repayment->loan->outstanding_balance+(float)$repayment->amount,'status'=>'active']);
                $repayment->update(['status'=>'reversed']);
            });
        });
    }

    private function applyUnpaidLeave(PayrollRunItem $item, Employee $employee, PayrollRun $run): void
    {
        $days = LeaveRequest::query()->where('organization_id',$run->organization_id)->where('employee_id',$employee->id)->where('status','approved')
            ->whereHas('leaveType', fn($q)=>$q->where('is_paid',false))->whereDate('starts_on','<=',$run->period_end)->whereDate('ends_on','>=',$run->period_start)->get()
            ->sum(function (LeaveRequest $leave) use ($run): int {
                $start = CarbonImmutable::parse($leave->starts_on)->max(CarbonImmutable::parse($run->period_start));
                $end = CarbonImmutable::parse($leave->ends_on)->min(CarbonImmutable::parse($run->period_end));
                return $end->lessThan($start) ? 0 : $this->workingDays($leave->employee, $start, $end);
            });
        if ($days <= 0 || $item->period_days <= 0) return;
        $dailyRate = (float) $item->base_pay / $item->period_days;
        $this->line($item, 'UNPAID_LEAVE', 'Unpaid leave', 'deduction', round($dailyRate*$days,2), $days, $dailyRate, ['source'=>'leave','days'=>$days]);
    }

    private function applyOvertime(PayrollRunItem $item, Employee $employee, PayrollRun $run, PayrollSetting $settings): void
    {
        $rules = $settings->statutory_rules ?? [];
        if (! data_get($rules, 'overtime.enabled', false)) return;
        $eligibleStatuses = data_get($rules, 'overtime.eligible_attendance_statuses', ['present', 'late', 'corrected']);
        $minimumMinutes = max(0, (int) data_get($rules, 'overtime.minimum_minutes_per_day', 0));
        $minutes = AttendanceRecord::query()->with('workShift')->where('organization_id',$run->organization_id)->where('employee_id',$employee->id)
            ->whereNotNull('work_shift_id')->whereNotNull('check_out_at')->whereIn('status', $eligibleStatuses)
            ->whereBetween('attendance_date',[$run->period_start,$run->period_end])->get()->sum(function($record) use ($minimumMinutes){
                $expected = $this->expectedShiftMinutes($record->workShift);
                $overtime = max(0, ($record->duration_minutes ?? 0)-$expected);
                return $overtime >= $minimumMinutes ? $overtime : 0;
            });
        if ($minutes <= 0) return;
        $maximumHours = data_get($rules, 'overtime.maximum_hours_per_period');
        if ($maximumHours !== null) $minutes = min($minutes, max(0, (float) $maximumHours) * 60);
        $hours = $minutes/60; $monthlyHours=(float)data_get($rules,'overtime.standard_monthly_hours',173.33); $multiplier=(float)data_get($rules,'overtime.multiplier',1.5);
        $rate=$monthlyHours>0 ? ((float)$item->base_pay/$monthlyHours)*$multiplier : 0;
        $this->line($item,'OVERTIME','Overtime','earning',round($hours*$rate,2),$hours,$rate,['source'=>'attendance','minutes'=>$minutes,'multiplier'=>$multiplier]);
    }

    private function applyManualInputs(PayrollRunItem $item, Employee $employee, PayrollRun $run): void
    {
        PayrollInput::query()->with('component')->where('organization_id',$run->organization_id)->where('employee_id',$employee->id)
            ->whereBetween('effective_date',[$run->period_start,$run->period_end])
            ->where(fn($q)=>$q->where(fn($x)=>$x->where('status','approved')->whereNull('payroll_run_id'))->orWhere(fn($x)=>$x->where('status','consumed')->where('payroll_run_id',$run->id)))->get()
            ->each(function(PayrollInput $input) use($item,$run){
                $type=$input->component?->type ?? (in_array($input->type,['deduction','loan_repayment'],true)?'deduction':'earning');
                $this->line($item,$input->component?->code ?? strtoupper($input->type).':'.$input->id,$input->description,$type,(float)$input->amount,(float)$input->quantity,(float)$input->rate,['source'=>'manual_input','input_id'=>$input->id]);
                $input->update(['payroll_run_id'=>$run->id,'status'=>'consumed']);
            });
    }

    private function applyLoanInstallments(PayrollRunItem $item, Employee $employee, PayrollRun $run): void
    {
        EmployeeLoan::query()->where('organization_id',$run->organization_id)->where('employee_id',$employee->id)->where('status','active')->whereDate('starts_on','<=',$run->period_end)
            ->get()->each(function(EmployeeLoan $loan) use($item){ $amount=min((float)$loan->installment_amount,(float)$loan->outstanding_balance); if($amount>0)$this->line($item,'LOAN:'.$loan->id,$loan->name.' repayment','deduction',$amount,1,$amount,['source'=>'loan','loan_id'=>$loan->id]); });
    }

    private function applyStatutoryRules(PayrollRunItem $item, Employee $employee, PayrollSetting $settings): void
    {
        $profile=EmployeeStatutoryProfile::query()->where('employee_id',$employee->id)->first(); if(!$profile)return;
        $rules=$settings->statutory_rules ?? []; $pensionBase=(float)$item->base_pay;
        $employeePension=0.0;
        if($profile->pension_enabled && data_get($rules,'pension.enabled',true)){
            $employeePension=round($pensionBase*((float)data_get($rules,'pension.employee_rate',8)/100),2);
            $employerPension=round($pensionBase*((float)data_get($rules,'pension.employer_rate',10)/100),2);
            $this->line($item,'PENSION_EMPLOYEE','Employee pension','deduction',$employeePension,1,(float)data_get($rules,'pension.employee_rate',8),['statutory'=>'pension'],true);
            $this->line($item,'PENSION_EMPLOYER','Employer pension','employer_contribution',$employerPension,1,(float)data_get($rules,'pension.employer_rate',10),['statutory'=>'pension'],true);
        }
        $gross=(float)$item->lines()->where('type','earning')->sum('amount');
        if($profile->paye_enabled && data_get($rules,'paye.enabled',false)){
            $annualGross=$gross*12; $annualRelief=(float)collect($profile->reliefs ?? [])->sum('annual_amount'); $chargeable=max(0,$annualGross-($employeePension*12)-$annualRelief);
            $tax=$this->progressiveTax($chargeable,collect(data_get($rules,'paye.brackets',[]))); $monthly=round($tax/12,2);
            if($monthly>0)$this->line($item,'PAYE','Pay as you earn tax','deduction',$monthly,1,$monthly,['statutory'=>'paye','annual_chargeable'=>$chargeable,'rules_version'=>data_get($rules,'paye.version')],true);
        }
        if($profile->nhf_enabled && data_get($rules,'nhf.enabled',false)){
            $rate=(float)data_get($rules,'nhf.employee_rate',2.5); $this->line($item,'NHF','National Housing Fund','deduction',round($pensionBase*$rate/100,2),1,$rate,['statutory'=>'nhf'],true);
        }
    }

    private function progressiveTax(float $chargeable, Collection $brackets): float
    {
        $remaining=$chargeable;$tax=0.0; foreach($brackets as $bracket){if($remaining<=0)break;$limit=$bracket['amount']??null;$slice=$limit===null?$remaining:min($remaining,(float)$limit);$tax+=$slice*((float)($bracket['rate']??0)/100);$remaining-=$slice;} return round($tax,2);
    }

    private function expectedShiftMinutes($shift): int
    {
        if (! $shift?->starts_at || ! $shift?->ends_at) return 0;
        $start=\Carbon\CarbonImmutable::parse($shift->starts_at);$end=\Carbon\CarbonImmutable::parse($shift->ends_at);
        if($shift->is_overnight || $end->lessThanOrEqualTo($start))$end=$end->addDay();
        return max(0,$start->diffInMinutes($end)-($shift->break_minutes ?? 0));
    }

    private function workingDays(Employee $employee, CarbonImmutable $start, CarbonImmutable $end): int
    {
        $days = LeaveWorkDay::query()->where('organization_id', $employee->organization_id)->where('is_working_day', true)->pluck('day_of_week')->map(fn ($day) => (int) $day)->all();
        if ($days === []) $days = [1, 2, 3, 4, 5];
        $holidays = LeaveHoliday::query()->where('organization_id', $employee->organization_id)->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('organization_location_id')->orWhere('organization_location_id', $employee->organization_location_id))
            ->whereBetween('date', [$start, $end])->pluck('date')->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())->all();
        $count = 0;
        for ($date = $start; $date->lessThanOrEqualTo($end); $date = $date->addDay()) {
            if (in_array($date->dayOfWeek, $days, true) && ! in_array($date->toDateString(), $holidays, true)) $count++;
        }
        return $count;
    }

    private function line(PayrollRunItem $item,string $code,string $name,string $type,float $amount,float $quantity,float $rate,array $snapshot=[],bool $statutory=false): void
    { $item->lines()->create(['organization_id'=>$item->organization_id,'component_code'=>$code,'component_name'=>$name,'type'=>$type,'quantity'=>$quantity,'rate'=>$rate,'amount'=>$amount,'is_taxable'=>false,'is_statutory'=>$statutory,'calculation_snapshot'=>$snapshot]); }
}
