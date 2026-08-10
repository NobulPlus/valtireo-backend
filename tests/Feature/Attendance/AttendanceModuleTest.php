<?php

namespace Tests\Feature\Attendance;

use App\Models\ApprovalRequest;
use App\Models\AttendanceCorrectionRequest;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use App\Models\WorkShift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_can_update_attendance_settings_and_create_shift(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->patchJson('/api/attendance/settings', [
            'late_grace_minutes' => 20,
            'allowed_sources' => ['manual', 'employee', 'import'],
        ])
            ->assertOk()
            ->assertJsonPath('attendance_settings.late_grace_minutes', 20);

        $this->postJson('/api/attendance/shifts', [
            'name' => 'Morning Shift',
            'code' => 'morning',
            'starts_at' => '08:00',
            'ends_at' => '16:00',
            'break_minutes' => 45,
            'is_default' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('work_shift.code', 'MORNING')
            ->assertJsonPath('work_shift.is_default', true);
    }

    public function test_employee_can_create_own_attendance_record(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $shift = WorkShift::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'REGULAR')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/attendance/records', [
            'work_shift_id' => $shift->id,
            'attendance_date' => '2026-08-20',
            'check_in_at' => '2026-08-20 09:00:00',
            'check_out_at' => '2026-08-20 17:00:00',
        ])
            ->assertCreated()
            ->assertJsonPath('attendance_record.employee.employee_number', 'EMP-FIN-001')
            ->assertJsonPath('attendance_record.source', 'employee')
            ->assertJsonPath('attendance_record.duration_minutes', 420);
    }

    public function test_hr_can_create_attendance_record_for_employee(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson('/api/attendance/records', [
            'employee_id' => $employee->id,
            'attendance_date' => '2026-08-21',
            'check_in_at' => '2026-08-21 09:30:00',
            'check_out_at' => '2026-08-21 17:00:00',
            'source' => 'manual',
        ])
            ->assertCreated()
            ->assertJsonPath('attendance_record.status', 'late');
    }

    public function test_employee_can_request_attendance_correction_and_approval_updates_record(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $recordId = $this->postJson('/api/attendance/records', [
            'attendance_date' => '2026-08-24',
            'check_in_at' => '2026-08-24 09:45:00',
            'check_out_at' => '2026-08-24 17:00:00',
        ])
            ->assertCreated()
            ->json('attendance_record.id');

        $correctionId = $this->postJson('/api/attendance/corrections', [
            'attendance_record_id' => $recordId,
            'requested_check_in_at' => '2026-08-24 09:00:00',
            'requested_check_out_at' => '2026-08-24 17:00:00',
            'reason' => 'Forgot to clock in after arriving on time.',
        ])
            ->assertCreated()
            ->assertJsonPath('attendance_correction.status', 'submitted')
            ->assertJsonPath('attendance_correction.approval_requests.0.status', 'pending')
            ->json('attendance_correction.id');

        $approval = ApprovalRequest::query()
            ->where('approvable_type', AttendanceCorrectionRequest::class)
            ->where('approvable_id', $correctionId)
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'approve',
            'note' => 'Correction confirmed.',
        ])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'approved');

        $this->assertDatabaseHas('attendance_correction_requests', [
            'id' => $correctionId,
            'status' => 'approved',
        ]);
        $this->assertSame(
            '2026-08-24 09:00:00',
            AttendanceRecord::query()->findOrFail($recordId)->check_in_at->format('Y-m-d H:i:s')
        );
    }

    public function test_employee_only_sees_own_attendance_records(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/attendance/records')
            ->assertOk()
            ->assertJsonMissing(['employee_number' => 'EMP-HR-001']);
    }
}
