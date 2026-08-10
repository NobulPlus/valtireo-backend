<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveHoliday;
use App\Models\LeavePeriod;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\LeaveWorkDay;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveRequestService
{
    public function __construct(private readonly ApprovalRequestService $approvals)
    {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function submit(User $actor, array $data): LeaveRequest
    {
        return DB::transaction(function () use ($actor, $data): LeaveRequest {
            $employee = $this->targetEmployee($actor, $data['employee_id'] ?? null);
            $leaveType = LeaveType::query()
                ->where('organization_id', $actor->organization_id)
                ->where('is_active', true)
                ->findOrFail($data['leave_type_id']);
            $startsOn = CarbonImmutable::parse($data['starts_on'])->startOfDay();
            $endsOn = CarbonImmutable::parse($data['ends_on'])->startOfDay();
            $period = $this->periodFor($actor, $startsOn, $endsOn);
            $totalDays = $this->workingDays($employee, $startsOn, $endsOn);

            if ($totalDays <= 0) {
                throw ValidationException::withMessages([
                    'starts_on' => ['The selected leave period does not contain any working day.'],
                ]);
            }

            if ($leaveType->maximum_days_per_request && $totalDays > $leaveType->maximum_days_per_request) {
                throw ValidationException::withMessages([
                    'ends_on' => ["This leave type allows a maximum of {$leaveType->maximum_days_per_request} days per request."],
                ]);
            }

            if ($leaveType->minimum_notice_days > 0 && now()->startOfDay()->diffInDays($startsOn, false) < $leaveType->minimum_notice_days) {
                throw ValidationException::withMessages([
                    'starts_on' => ["This leave type requires {$leaveType->minimum_notice_days} days notice."],
                ]);
            }

            $this->ensureNoOverlap($employee, $startsOn, $endsOn);
            $entitlement = $this->entitlementFor($employee, $leaveType, $period);
            $available = (float) $entitlement->days_allocated - (float) $entitlement->days_used - (float) $entitlement->days_pending;

            if ($totalDays > $available) {
                throw ValidationException::withMessages([
                    'leave_type_id' => ["Insufficient leave balance. Available days: {$available}."],
                ]);
            }

            $leaveRequest = LeaveRequest::query()->create([
                'organization_id' => $employee->organization_id,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'leave_period_id' => $period->id,
                'requested_by_id' => $actor->id,
                'starts_on' => $startsOn->toDateString(),
                'ends_on' => $endsOn->toDateString(),
                'total_days' => $totalDays,
                'status' => 'submitted',
                'reason' => $data['reason'] ?? null,
                'submitted_at' => now(),
            ]);

            $entitlement->increment('days_pending', $totalDays);

            if (! blank($data['reason'] ?? null)) {
                $leaveRequest->comments()->create([
                    'user_id' => $actor->id,
                    'comment' => $data['reason'],
                ]);
            }

            $this->approvals->submit(
                $actor,
                $leaveRequest,
                'leave',
                'submit',
                "Review {$employee->first_name} {$employee->last_name}'s leave request",
                $employee,
                ['leave_type_id' => $leaveType->id, 'total_days' => $totalDays]
            );

            return $leaveRequest->refresh()->load($this->relations());
        });
    }

    public function cancel(User $actor, LeaveRequest $leaveRequest, ?string $note = null): LeaveRequest
    {
        if ($leaveRequest->organization_id !== $actor->organization_id) {
            abort(404);
        }

        if (! $actor->can('leave_requests.approve') && $actor->employee?->id !== $leaveRequest->employee_id) {
            abort(403);
        }

        if (! in_array($leaveRequest->status, ['submitted', 'changes_requested'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only submitted or change-requested leave can be cancelled.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $leaveRequest, $note): LeaveRequest {
            $entitlement = LeaveEntitlement::query()
                ->where('employee_id', $leaveRequest->employee_id)
                ->where('leave_type_id', $leaveRequest->leave_type_id)
                ->where('leave_period_id', $leaveRequest->leave_period_id)
                ->lockForUpdate()
                ->first();

            if ($entitlement && $leaveRequest->status === 'submitted') {
                $entitlement->decrement('days_pending', $leaveRequest->total_days);
            }

            $leaveRequest->update([
                'status' => 'cancelled',
                'reviewed_at' => now(),
            ]);

            if (! blank($note)) {
                $leaveRequest->comments()->create([
                    'user_id' => $actor->id,
                    'comment' => $note,
                ]);
            }

            return $leaveRequest->refresh()->load($this->relations());
        });
    }

    /**
     * @return array<int, string>
     */
    public function relations(): array
    {
        return [
            'employee',
            'leaveType',
            'leavePeriod',
            'requestedBy',
            'comments.user',
            'approvalRequests.workflow.steps',
            'approvalRequests.decisions.actor',
        ];
    }

    private function targetEmployee(User $actor, ?int $employeeId): Employee
    {
        if ($actor->can('leave_requests.approve') && $employeeId) {
            return Employee::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($employeeId);
        }

        return $actor->employee()->firstOrFail();
    }

    private function periodFor(User $actor, CarbonImmutable $startsOn, CarbonImmutable $endsOn): LeavePeriod
    {
        $period = LeavePeriod::query()
            ->where('organization_id', $actor->organization_id)
            ->where('is_active', true)
            ->whereDate('starts_on', '<=', $startsOn->toDateString())
            ->whereDate('ends_on', '>=', $endsOn->toDateString())
            ->first();

        if (! $period) {
            throw ValidationException::withMessages([
                'starts_on' => ['No active leave period covers the selected dates.'],
            ]);
        }

        return $period;
    }

    private function entitlementFor(Employee $employee, LeaveType $leaveType, LeavePeriod $period): LeaveEntitlement
    {
        $entitlement = LeaveEntitlement::query()
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $leaveType->id)
            ->where('leave_period_id', $period->id)
            ->lockForUpdate()
            ->first();

        if (! $entitlement) {
            throw ValidationException::withMessages([
                'leave_type_id' => ['No leave entitlement exists for this employee, leave type, and period.'],
            ]);
        }

        return $entitlement;
    }

    private function ensureNoOverlap(Employee $employee, CarbonImmutable $startsOn, CarbonImmutable $endsOn): void
    {
        $overlap = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['submitted', 'approved'])
            ->whereDate('starts_on', '<=', $endsOn->toDateString())
            ->whereDate('ends_on', '>=', $startsOn->toDateString())
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'starts_on' => ['This employee already has an overlapping leave request.'],
            ]);
        }
    }

    private function workingDays(Employee $employee, CarbonImmutable $startsOn, CarbonImmutable $endsOn): float
    {
        $workingDays = LeaveWorkDay::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_working_day', true)
            ->pluck('day_of_week')
            ->map(fn ($day) => (int) $day)
            ->all();

        if ($workingDays === []) {
            $workingDays = [1, 2, 3, 4, 5];
        }

        $holidays = LeaveHoliday::query()
            ->where('organization_id', $employee->organization_id)
            ->where('is_active', true)
            ->where(fn ($query) => $query
                ->whereNull('organization_location_id')
                ->orWhere('organization_location_id', $employee->organization_location_id))
            ->whereBetween('date', [$startsOn->toDateString(), $endsOn->toDateString()])
            ->pluck('date')
            ->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())
            ->all();

        $days = 0;
        for ($date = $startsOn; $date->lte($endsOn); $date = $date->addDay()) {
            if (in_array($date->dayOfWeek, $workingDays, true) && ! in_array($date->toDateString(), $holidays, true)) {
                $days++;
            }
        }

        return (float) $days;
    }
}
