<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeCompensation;
use App\Models\EmployeeStatusHistory;
use App\Models\LeaveHoliday;
use App\Models\LeaveWorkDay;
use App\Models\PayrollComponent;
use App\Models\PayrollRun;
use App\Models\PayrollSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollService
{
    public function __construct(private readonly ApprovalRequestService $approvals)
    {
    }

    public function settingsFor(int $organizationId): PayrollSetting
    {
        $settings = PayrollSetting::query()->firstOrCreate(
            ['organization_id' => $organizationId],
            ['currency' => 'NGN', 'default_pay_frequency' => 'monthly', 'pay_day' => 25, 'statutory_rules' => $this->defaultStatutoryRules()]
        );

        $rules = array_replace_recursive($this->defaultStatutoryRules(), $settings->statutory_rules ?? []);
        if ($rules !== $settings->statutory_rules) $settings->update(['statutory_rules' => $rules]);

        return $settings->refresh();
    }

    /** @param array<string, mixed> $data */
    public function setCompensation(User $actor, Employee $employee, array $data): EmployeeCompensation
    {
        $this->ensureTenant($actor, $employee->organization_id);

        return DB::transaction(function () use ($actor, $employee, $data): EmployeeCompensation {
            $effectiveFrom = CarbonImmutable::parse($data['effective_from']);
            $query = EmployeeCompensation::query()
                ->where('organization_id', $actor->organization_id)
                ->where('employee_id', $employee->id);

            if ((clone $query)->whereDate('effective_from', $effectiveFrom)->exists()) {
                throw ValidationException::withMessages([
                    'effective_from' => ['A compensation record already starts on this date. Use a different effective date.'],
                ]);
            }

            $previous = (clone $query)->whereDate('effective_from', '<', $effectiveFrom)->latest('effective_from')->lockForUpdate()->first();
            $next = (clone $query)->whereDate('effective_from', '>', $effectiveFrom)->oldest('effective_from')->lockForUpdate()->first();

            if ($previous && (! $previous->effective_to || $previous->effective_to->greaterThanOrEqualTo($effectiveFrom))) {
                $previous->update([
                    'effective_to' => $effectiveFrom->subDay()->toDateString(),
                    'status' => 'superseded',
                ]);
            }

            return EmployeeCompensation::query()->create([
                ...$data,
                'organization_id' => $actor->organization_id,
                'employee_id' => $employee->id,
                'created_by_id' => $actor->id,
                'effective_to' => $next ? CarbonImmutable::parse($next->effective_from)->subDay()->toDateString() : null,
                'status' => $next ? 'superseded' : 'active',
            ])->load(['payGroup', 'createdBy']);
        });
    }

    public function calculate(User $actor, PayrollRun $run): PayrollRun
    {
        $this->ensureTenant($actor, $run->organization_id);
        if (! in_array($run->status, ['draft', 'calculated'], true)) {
            throw ValidationException::withMessages(['status' => ['Only a draft or calculated payroll run can be recalculated.']]);
        }

        return DB::transaction(function () use ($run): PayrollRun {
            $lockedRun = PayrollRun::query()->whereKey($run->id)->lockForUpdate()->firstOrFail();
            $settings = $this->settingsFor($lockedRun->organization_id);
            $components = PayrollComponent::query()
                ->where('organization_id', $lockedRun->organization_id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->keyBy('id');

            $lockedRun->items()->delete();

            $periodStart = CarbonImmutable::parse($lockedRun->period_start);
            $periodEnd = CarbonImmutable::parse($lockedRun->period_end);
            $employees = Employee::query()
                ->with(['department', 'designation', 'gradeLevel', 'location', 'employmentType'])
                ->where('organization_id', $lockedRun->organization_id)
                ->where(fn ($query) => $query->whereNull('start_date')->orWhereDate('start_date', '<=', $periodEnd))
                ->where(function ($query) use ($periodStart): void {
                    $query->where('status', 'active')
                        ->orWhereHas('statusHistories', fn ($history) => $history
                            ->where('previous_status', 'active')
                            ->whereDate('effective_date', '>=', $periodStart));
                })
                ->when($lockedRun->pay_group_id, fn ($query, $groupId) => $query->whereHas('compensations', fn ($q) => $q->where('pay_group_id', $groupId)))
                ->orderBy('id')
                ->get();

            $totals = ['gross' => 0.0, 'deductions' => 0.0, 'net' => 0.0, 'employer' => 0.0];
            foreach ($employees as $employee) {
                $compensation = $this->effectiveCompensation($employee, $lockedRun);
                $exceptions = [];
                if (! $compensation) {
                    $exceptions[] = ['code' => 'missing_compensation', 'message' => 'No effective compensation record exists for this period.'];
                }
                if (! $employee->start_date) {
                    $exceptions[] = ['code' => 'missing_start_date', 'message' => 'No employment start date is configured.'];
                }

                $bank = $employee->bankAccounts()->where('is_primary', true)->first();
                if (! $bank) {
                    $exceptions[] = ['code' => 'missing_bank_account', 'message' => 'No primary bank account is configured.'];
                }

                $periodDays = $this->payrollDays($lockedRun->organization_id, $employee, $periodStart, $periodEnd, $settings->proration_basis);
                $payableStart = $settings->prorate_joiners && $employee->start_date && $employee->start_date->greaterThan($periodStart)
                    ? CarbonImmutable::parse($employee->start_date)
                    : $periodStart;
                $payableEnd = $periodEnd;
                if ($settings->prorate_leavers) {
                    $leavingTransition = EmployeeStatusHistory::query()
                        ->where('organization_id', $lockedRun->organization_id)
                        ->where('employee_id', $employee->id)
                        ->where('previous_status', 'active')
                        ->where('new_status', '!=', 'active')
                        ->whereBetween('effective_date', [$periodStart, $periodEnd])
                        ->oldest('effective_date')
                        ->first();
                    if ($leavingTransition) {
                        $payableEnd = CarbonImmutable::parse($leavingTransition->effective_date)->subDay();
                    }
                }
                $payableDays = $payableEnd->lessThan($payableStart)
                    ? 0
                    : $this->payrollDays($lockedRun->organization_id, $employee, $payableStart, $payableEnd, $settings->proration_basis);
                $ratio = $periodDays > 0 ? min(1, $payableDays / $periodDays) : 0;
                $basePay = round(((float) ($compensation?->base_salary ?? 0)) * $ratio, $settings->decimal_places);

                $item = $lockedRun->items()->create([
                    'organization_id' => $lockedRun->organization_id,
                    'employee_id' => $employee->id,
                    'employee_compensation_id' => $compensation?->id,
                    'employee_number' => $employee->employee_number,
                    'employee_name' => trim(implode(' ', array_filter([$employee->first_name, $employee->middle_name, $employee->last_name]))),
                    'employment_snapshot' => [
                        'department' => $employee->department?->name,
                        'designation' => $employee->designation?->name,
                        'grade_level' => $employee->gradeLevel?->name,
                        'employment_type' => $employee->employmentType?->name,
                        'location' => $employee->location?->name,
                    ],
                    'bank_snapshot' => $bank ? [
                        'bank_name' => $bank->bank_name,
                        'bank_code' => $bank->bank_code,
                        'account_name' => $bank->account_name,
                        'account_number_last_four' => substr($bank->account_number, -4),
                        'verification_status' => $bank->verification_status,
                    ] : null,
                    'bank_account_number' => $bank?->account_number,
                    'period_days' => $periodDays,
                    'payable_days' => $payableDays,
                    'base_pay' => $basePay,
                    'status' => $exceptions ? 'exception' : 'calculated',
                    'exceptions' => $exceptions,
                ]);

                $item->lines()->create([
                    'organization_id' => $lockedRun->organization_id,
                    'component_code' => 'BASIC',
                    'component_name' => 'Basic salary',
                    'type' => 'earning',
                    'rate' => $compensation?->base_salary ?? 0,
                    'amount' => $basePay,
                    'is_taxable' => true,
                    'calculation_snapshot' => ['proration_ratio' => $ratio, 'period_days' => $periodDays, 'payable_days' => $payableDays],
                ]);

                $amounts = ['BASIC' => $basePay];
                foreach (($compensation?->recurring_components ?? []) as $entry) {
                    $component = $components->get($entry['component_id'] ?? null);
                    if (! $component) {
                        continue;
                    }
                    $value = (float) ($entry['value'] ?? $component->default_value);
                    $base = $component->percentageBase ? ($amounts[$component->percentageBase->code] ?? $basePay) : $basePay;
                    $amount = $component->calculation_type === 'percentage' ? $base * ($value / 100) : $value * $ratio;
                    $amount = round($amount, $settings->decimal_places);
                    $amounts[$component->code] = $amount;
                    $item->lines()->create([
                        'organization_id' => $lockedRun->organization_id,
                        'payroll_component_id' => $component->id,
                        'component_code' => $component->code,
                        'component_name' => $component->name,
                        'type' => $component->type,
                        'rate' => $value,
                        'amount' => $amount,
                        'is_taxable' => $component->is_taxable,
                        'is_statutory' => $component->is_statutory,
                        'calculation_snapshot' => ['calculation_type' => $component->calculation_type, 'base_amount' => $base],
                    ]);
                }

                app(PayrollOperationsService::class)->apply($item, $employee, $lockedRun, $settings);

                $gross = (float) $item->lines()->where('type', 'earning')->sum('amount');
                $deductions = (float) $item->lines()->where('type', 'deduction')->sum('amount');
                $employer = (float) $item->lines()->where('type', 'employer_contribution')->sum('amount');
                $net = max(0, $gross - $deductions);
                $item->update(['gross_pay' => $gross, 'total_deductions' => $deductions, 'net_pay' => $net, 'employer_contributions' => $employer]);
                $totals['gross'] += $gross; $totals['deductions'] += $deductions; $totals['net'] += $net; $totals['employer'] += $employer;
            }

            $lockedRun->update([
                'status' => 'calculated',
                'employee_count' => $employees->count(),
                'total_gross' => $totals['gross'],
                'total_deductions' => $totals['deductions'],
                'total_net' => $totals['net'],
                'total_employer_contributions' => $totals['employer'],
                'calculated_at' => now(),
                'calculation_context' => ['settings' => $settings->toArray(), 'engine_version' => 2],
            ]);

            return $lockedRun->load(['payGroup', 'items.lines']);
        });
    }

    public function submit(User $actor, PayrollRun $run): PayrollRun
    {
        $this->ensureTenant($actor, $run->organization_id);
        if ($run->status !== 'calculated') {
            throw ValidationException::withMessages(['status' => ['Calculate the payroll before submitting it for approval.']]);
        }
        if ($run->items()->where('status', 'exception')->exists()) {
            throw ValidationException::withMessages(['employees' => ['Resolve all employee payroll exceptions before submission.']]);
        }

        DB::transaction(function () use ($actor, $run): void {
            $run->update(['status' => 'pending_approval', 'submitted_at' => now()]);
            $this->approvals->submit($actor, $run, 'payroll', 'approve_run', "Approve payroll {$run->reference}", null, [
                'period_start' => $run->period_start->toDateString(),
                'period_end' => $run->period_end->toDateString(),
                'total_net' => $run->total_net,
                'employee_count' => $run->employee_count,
            ]);
        });

        return $run->refresh();
    }

    public function finalize(User $actor, PayrollRun $run): PayrollRun
    {
        $this->ensureTenant($actor, $run->organization_id);
        if ($run->status !== 'approved') {
            throw ValidationException::withMessages(['status' => ['Only an approved payroll run can be finalized.']]);
        }
        $run->update(['status' => 'finalized', 'finalized_by_id' => $actor->id, 'finalized_at' => now()]);
        app(PayrollOperationsService::class)->postFinalizedLoanRepayments($run->refresh());
        return $run->refresh();
    }

    private function effectiveCompensation(Employee $employee, PayrollRun $run): ?EmployeeCompensation
    {
        return EmployeeCompensation::query()
            ->with('payGroup')
            ->where('organization_id', $run->organization_id)
            ->where('employee_id', $employee->id)
            ->whereDate('effective_from', '<=', $run->period_end)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $run->period_start))
            ->latest('effective_from')
            ->first();
    }

    /** @return array<string, mixed> */
    public function readiness(User $actor, PayrollRun $run): array
    {
        $this->ensureTenant($actor, $run->organization_id);
        $employees = Employee::query()
            ->where('organization_id', $run->organization_id)
            ->where('status', 'active')
            ->where(fn ($query) => $query->whereNull('start_date')->orWhereDate('start_date', '<=', $run->period_end))
            ->when($run->pay_group_id, fn ($query, $groupId) => $query->whereHas('compensations', fn ($q) => $q->where('pay_group_id', $groupId)))
            ->get();
        $issues = [];
        foreach ($employees as $employee) {
            $employeeIssues = [];
            if (! $this->effectiveCompensation($employee, $run)) $employeeIssues[] = 'missing_compensation';
            if (! $employee->start_date) $employeeIssues[] = 'missing_start_date';
            $bank = $employee->bankAccounts()->where('is_primary', true)->first();
            if (! $bank) $employeeIssues[] = 'missing_bank_account';
            elseif ($bank->verification_status !== 'verified') $employeeIssues[] = 'unverified_bank_account';
            if ($employeeIssues !== []) {
                $issues[] = ['employee_id' => $employee->id, 'employee_number' => $employee->employee_number, 'employee_name' => trim("{$employee->first_name} {$employee->last_name}"), 'issues' => $employeeIssues];
            }
        }
        return ['ready' => $issues === [], 'employee_count' => $employees->count(), 'issue_count' => count($issues), 'issues' => $issues];
    }

    private function payrollDays(int $organizationId, Employee $employee, CarbonImmutable $start, CarbonImmutable $end, string $basis): int
    {
        if ($basis !== 'working_days') return $start->diffInDays($end) + 1;
        $workingDays = LeaveWorkDay::query()->where('organization_id', $organizationId)->where('is_working_day', true)->pluck('day_of_week')->map(fn ($day) => (int) $day)->all();
        if ($workingDays === []) $workingDays = [1, 2, 3, 4, 5];
        $holidays = LeaveHoliday::query()->where('organization_id', $organizationId)->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('organization_location_id')->orWhere('organization_location_id', $employee->organization_location_id))
            ->whereBetween('date', [$start, $end])->pluck('date')->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())->all();
        $count = 0;
        for ($date = $start; $date->lessThanOrEqualTo($end); $date = $date->addDay()) {
            if (in_array($date->dayOfWeek, $workingDays, true) && ! in_array($date->toDateString(), $holidays, true)) $count++;
        }
        return $count;
    }

    private function ensureTenant(User $actor, int $organizationId): void
    {
        abort_unless($actor->organization_id === $organizationId, 404);
    }

    /** @return array<string, mixed> */
    private function defaultStatutoryRules(): array
    {
        return [
            // PenCom's PRA 2014 guidance: minimum 8% employee and 10% employer.
            'pension' => ['enabled' => true, 'employee_rate' => 8, 'employer_rate' => 10, 'version' => 'PRA-2014'],
            // PAYE remains disabled until the organization enters verified,
            // effective-dated brackets for the tax regime it is operating.
            'paye' => ['enabled' => false, 'version' => null, 'effective_from' => null, 'brackets' => []],
            'nhf' => ['enabled' => false, 'employee_rate' => 2.5, 'version' => null],
            'overtime' => ['enabled' => false, 'multiplier' => 1.5, 'standard_monthly_hours' => 173.33, 'eligible_attendance_statuses' => ['present', 'late', 'corrected'], 'minimum_minutes_per_day' => 0, 'maximum_hours_per_period' => null],
            'accounting' => ['salary_expense' => 'SALARY_EXPENSE', 'employer_cost' => 'EMPLOYER_COST', 'payroll_bank' => 'PAYROLL_BANK', 'deductions_payable' => 'DEDUCTIONS_PAYABLE', 'employer_payable' => 'EMPLOYER_PAYABLE'],
        ];
    }
}
