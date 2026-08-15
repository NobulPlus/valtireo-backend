<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Organization;
use Illuminate\Database\Seeder;

class LeaveSeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        foreach ([
            ['name' => 'Annual Leave', 'code' => 'ANNUAL', 'description' => 'Paid annual vacation leave.', 'is_paid' => true, 'minimum_notice_days' => 3, 'maximum_days_per_request' => 15],
            ['name' => 'Sick Leave', 'code' => 'SICK', 'description' => 'Health-related leave.', 'is_paid' => true, 'requires_attachment' => true, 'minimum_notice_days' => 0, 'maximum_days_per_request' => 10],
            ['name' => 'Compassionate Leave', 'code' => 'COMPASSIONATE', 'description' => 'Leave for urgent family or personal events.', 'is_paid' => true, 'minimum_notice_days' => 0, 'maximum_days_per_request' => 5],
        ] as $type) {
            $organization->leaveTypes()->firstOrCreate(
                ['code' => $type['code']],
                [...$type, 'is_active' => true]
            );
        }

        $period = $organization->leavePeriods()->firstOrCreate(
            ['name' => '2026 Leave Year'],
            [
                'starts_on' => '2026-01-01',
                'ends_on' => '2026-12-31',
                'is_active' => true,
            ]
        );

        foreach ([0, 1, 2, 3, 4, 5, 6] as $day) {
            $organization->leaveWorkDays()->updateOrCreate(
                ['day_of_week' => $day],
                ['is_working_day' => in_array($day, [1, 2, 3, 4, 5], true)]
            );
        }

        foreach ([
            ['name' => 'New Year Holiday', 'date' => '2026-01-01'],
            ['name' => 'Democracy Day', 'date' => '2026-06-12'],
            ['name' => 'Christmas Day', 'date' => '2026-12-25'],
        ] as $holiday) {
            $organization->leaveHolidays()->firstOrCreate(
                ['date' => $holiday['date'], 'name' => $holiday['name']],
                ['is_recurring' => true, 'is_active' => true]
            );
        }

        $annual = $organization->leaveTypes()->where('code', 'ANNUAL')->firstOrFail();
        $sick = $organization->leaveTypes()->where('code', 'SICK')->firstOrFail();

        foreach (Employee::query()->whereBelongsTo($organization)->where('status', 'active')->get() as $employee) {
            foreach ([[$annual, 20], [$sick, 10]] as [$type, $days]) {
                $organization->leaveEntitlements()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'leave_type_id' => $type->id,
                        'leave_period_id' => $period->id,
                    ],
                    [
                        'days_allocated' => $days,
                        'notes' => 'Seeded demo leave entitlement.',
                    ]
                );
            }
        }
    }
}
