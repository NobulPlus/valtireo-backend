<?php

namespace App\Services;

use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceRecord;
use App\Models\AttendanceSetting;
use App\Models\Employee;
use App\Models\User;
use App\Models\WorkShift;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    public function __construct(private readonly ApprovalRequestService $approvals)
    {
    }

    public function settingsFor(User $user): AttendanceSetting
    {
        return AttendanceSetting::query()->firstOrCreate(
            ['organization_id' => $user->organization_id],
            $this->defaultSettings()
        );
    }

    /**
     * @param array<string, mixed> $data
     */
    public function updateSettings(User $user, array $data): AttendanceSetting
    {
        $settings = $this->settingsFor($user);
        $settings->update($data);

        return $settings->refresh();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function createRecord(User $actor, array $data): AttendanceRecord
    {
        return DB::transaction(function () use ($actor, $data): AttendanceRecord {
            $employee = $this->targetEmployee($actor, $data['employee_id'] ?? null);
            $settings = $this->settingsFor($actor);
            $source = $data['source'] ?? ($actor->employee?->id === $employee->id ? 'employee' : 'manual');

            if (! in_array($source, $settings->allowed_sources ?? ['manual', 'employee', 'import'], true)) {
                throw ValidationException::withMessages([
                    'source' => ['This attendance source is not allowed for the organization.'],
                ]);
            }

            if ($source === 'employee' && ! $settings->allow_employee_clock_in) {
                throw ValidationException::withMessages([
                    'source' => ['Employee clock-in is disabled for this organization.'],
                ]);
            }

            $shift = $this->shiftFor($actor, $data['work_shift_id'] ?? null);
            $checkIn = ! empty($data['check_in_at']) ? Carbon::parse($data['check_in_at']) : null;
            $checkOut = ! empty($data['check_out_at']) ? Carbon::parse($data['check_out_at']) : null;
            $duration = $this->durationMinutes($checkIn, $checkOut, $shift);

            $record = AttendanceRecord::query()->updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'attendance_date' => $data['attendance_date'],
                ],
                [
                    'organization_id' => $employee->organization_id,
                    'work_shift_id' => $shift?->id,
                    'recorded_by_id' => $actor->id,
                    'check_in_at' => $checkIn,
                    'check_out_at' => $checkOut,
                    'duration_minutes' => $duration,
                    'source' => $source,
                    'status' => $data['status'] ?? $this->status($checkIn, $shift, $settings),
                    'notes' => $data['notes'] ?? null,
                ]
            );

            return $record->load($this->recordRelations());
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function requestCorrection(User $actor, array $data): AttendanceCorrectionRequest
    {
        return DB::transaction(function () use ($actor, $data): AttendanceCorrectionRequest {
            $record = AttendanceRecord::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($data['attendance_record_id']);

            if (! $actor->can('attendance.update') && $actor->employee?->id !== $record->employee_id) {
                abort(403);
            }

            $settings = $this->settingsFor($actor);
            if (! $actor->can('attendance.update') && ! $settings->allow_employee_corrections) {
                throw ValidationException::withMessages([
                    'attendance_record_id' => ['Employee attendance corrections are disabled for this organization.'],
                ]);
            }

            $correction = AttendanceCorrectionRequest::query()->create([
                'organization_id' => $record->organization_id,
                'attendance_record_id' => $record->id,
                'employee_id' => $record->employee_id,
                'requested_by_id' => $actor->id,
                'original_check_in_at' => $record->check_in_at,
                'original_check_out_at' => $record->check_out_at,
                'requested_check_in_at' => $data['requested_check_in_at'] ?? null,
                'requested_check_out_at' => $data['requested_check_out_at'] ?? null,
                'status' => $settings->require_approval_for_corrections ? 'submitted' : 'approved',
                'reason' => $data['reason'],
                'submitted_at' => now(),
                'reviewed_at' => $settings->require_approval_for_corrections ? null : now(),
            ]);

            if ($settings->require_approval_for_corrections) {
                $this->approvals->submit(
                    $actor,
                    $correction,
                    'attendance',
                    'correction',
                    "Review attendance correction for {$record->attendance_date->toDateString()}",
                    $record->employee,
                    ['attendance_record_id' => $record->id]
                );
            } else {
                $record->update([
                    'check_in_at' => $correction->requested_check_in_at ?? $record->check_in_at,
                    'check_out_at' => $correction->requested_check_out_at ?? $record->check_out_at,
                    'duration_minutes' => $this->durationMinutes($correction->requested_check_in_at ?? $record->check_in_at, $correction->requested_check_out_at ?? $record->check_out_at, $record->workShift),
                    'status' => 'corrected',
                ]);
            }

            return $correction->refresh()->load($this->correctionRelations());
        });
    }

    /**
     * @return array<int, string>
     */
    public function recordRelations(): array
    {
        return ['employee', 'workShift', 'recordedBy', 'correctionRequests.approvalRequests'];
    }

    /**
     * @return array<int, string>
     */
    public function correctionRelations(): array
    {
        return ['employee', 'attendanceRecord.workShift', 'approvalRequests.workflow.steps', 'approvalRequests.decisions.actor'];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultSettings(): array
    {
        return [
            'timezone' => 'Africa/Lagos',
            'late_grace_minutes' => 15,
            'early_checkout_grace_minutes' => 10,
            'rounding_minutes' => 0,
            'allow_employee_clock_in' => true,
            'allow_employee_corrections' => true,
            'require_approval_for_corrections' => true,
            'allowed_sources' => ['manual', 'employee', 'import'],
        ];
    }

    private function targetEmployee(User $actor, ?int $employeeId): Employee
    {
        if ($actor->can('attendance.update') && $employeeId) {
            return Employee::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($employeeId);
        }

        return $actor->employee()->firstOrFail();
    }

    private function shiftFor(User $actor, ?int $shiftId): ?WorkShift
    {
        if ($shiftId) {
            return WorkShift::query()
                ->where('organization_id', $actor->organization_id)
                ->findOrFail($shiftId);
        }

        return WorkShift::query()
            ->where('organization_id', $actor->organization_id)
            ->where('is_default', true)
            ->first();
    }

    private function durationMinutes(?Carbon $checkIn, ?Carbon $checkOut, ?WorkShift $shift): int
    {
        if (! $checkIn || ! $checkOut) {
            return 0;
        }

        return max($checkIn->diffInMinutes($checkOut, false) - ($shift?->break_minutes ?? 0), 0);
    }

    private function status(?Carbon $checkIn, ?WorkShift $shift, AttendanceSetting $settings): string
    {
        if (! $checkIn) {
            return 'absent';
        }

        if (! $shift) {
            return 'present';
        }

        $expected = Carbon::parse($checkIn->toDateString().' '.$shift->starts_at);

        return $checkIn->gt($expected->copy()->addMinutes($settings->late_grace_minutes)) ? 'late' : 'present';
    }
}
