<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Organization;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AttendanceSeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        $organization->attendanceSetting()->firstOrCreate(
            ['organization_id' => $organization->id],
            [
                'timezone' => 'Africa/Lagos',
                'late_grace_minutes' => 15,
                'early_checkout_grace_minutes' => 10,
                'rounding_minutes' => 0,
                'allow_employee_clock_in' => true,
                'allow_employee_corrections' => true,
                'require_approval_for_corrections' => true,
                'allowed_sources' => ['manual', 'employee', 'import'],
            ]
        );

        $shift = $organization->workShifts()->firstOrCreate(
            ['code' => 'REGULAR'],
            [
                'name' => 'Regular Shift',
                'starts_at' => '09:00',
                'ends_at' => '17:00',
                'break_minutes' => 60,
                'is_overnight' => false,
                'is_default' => true,
                'is_active' => true,
            ]
        );

        $admin = $organization->users()->where('email', 'admin@valtireo.test')->first();
        foreach (Employee::query()->whereBelongsTo($organization)->where('status', 'active')->limit(4)->get() as $index => $employee) {
            $date = Carbon::parse('2026-08-10')->subDays($index);
            $checkIn = $date->copy()->setTime(9, $index === 1 ? 25 : 0);
            $checkOut = $date->copy()->setTime(17, 0);

            $organization->attendanceRecords()->updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'attendance_date' => $date->toDateString(),
                ],
                [
                    'work_shift_id' => $shift->id,
                    'recorded_by_id' => $admin?->id,
                    'check_in_at' => $checkIn,
                    'check_out_at' => $checkOut,
                    'duration_minutes' => max($checkIn->diffInMinutes($checkOut) - 60, 0),
                    'source' => 'manual',
                    'status' => $index === 1 ? 'late' : 'present',
                    'notes' => 'Seeded demo attendance record.',
                ]
            );
        }
    }
}
