<?php

namespace Tests\Feature\Leave;

use App\Models\ApprovalRequest;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveHoliday;
use App\Models\LeavePeriod;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaveModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_can_create_leave_type_period_holiday_and_entitlement(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        Sanctum::actingAs($admin);

        $typeId = $this->postJson('/api/leave/types', [
            'name' => 'Study Leave',
            'code' => 'study',
            'is_paid' => true,
            'minimum_notice_days' => 5,
            'maximum_days_per_request' => 10,
        ])
            ->assertCreated()
            ->assertJsonPath('leave_type.code', 'STUDY')
            ->json('leave_type.id');

        $this->patchJson("/api/leave/types/{$typeId}", [
            'name' => 'Study Leave (Revised)',
            'maximum_days_per_request' => 12,
        ])
            ->assertOk()
            ->assertJsonPath('leave_type.name', 'Study Leave (Revised)')
            ->assertJsonPath('leave_type.code', 'STUDY')
            ->assertJsonPath('leave_type.maximum_days_per_request', 12);

        $periodId = $this->postJson('/api/leave/periods', [
            'name' => '2027 Leave Year',
            'starts_on' => '2027-01-01',
            'ends_on' => '2027-12-31',
        ])
            ->assertCreated()
            ->json('leave_period.id');

        $this->patchJson("/api/leave/periods/{$periodId}", [
            'name' => '2027 Leave Year (Renamed)',
        ])
            ->assertOk()
            ->assertJsonPath('leave_period.name', '2027 Leave Year (Renamed)');

        $this->patchJson("/api/leave/periods/{$periodId}", [
            'ends_on' => '2026-12-31',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ends_on']);

        $holidayId = $this->postJson('/api/leave/holidays', [
            'name' => 'Founders Day',
            'date' => '2027-03-01',
        ])
            ->assertCreated()
            ->assertJsonPath('leave_holiday.name', 'Founders Day')
            ->json('leave_holiday.id');

        $this->patchJson("/api/leave/holidays/{$holidayId}", [
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('leave_holiday.is_active', false)
            ->assertJsonPath('leave_holiday.name', 'Founders Day');

        $this->postJson('/api/leave/entitlements', [
            'employee_id' => $employee->id,
            'leave_type_id' => $typeId,
            'leave_period_id' => $periodId,
            'days_allocated' => 7,
        ])
            ->assertCreated()
            ->assertJsonPath('leave_entitlement.days_allocated', 7);
    }

    public function test_employee_can_submit_leave_request_and_approval_is_created(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $leaveRequestId = $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-09-07',
            'ends_on' => '2026-09-09',
            'reason' => 'Family travel.',
        ])
            ->assertCreated()
            ->assertJsonPath('leave_request.status', 'submitted')
            ->assertJsonPath('leave_request.total_days', 3)
            ->assertJsonPath('leave_request.approval_requests.0.status', 'pending')
            ->json('leave_request.id');

        $this->assertDatabaseHas('approval_requests', [
            'approvable_type' => LeaveRequest::class,
            'approvable_id' => $leaveRequestId,
            'module' => 'leave',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('leave_entitlements', [
            'employee_id' => $employeeUser->employee->id,
            'leave_type_id' => $annual->id,
            'days_pending' => 3,
        ]);
    }

    public function test_approving_leave_request_moves_pending_days_to_used_days(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $leaveRequestId = $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-09-14',
            'ends_on' => '2026-09-16',
        ])
            ->assertCreated()
            ->json('leave_request.id');

        $approval = ApprovalRequest::query()->where('approvable_type', LeaveRequest::class)->where('approvable_id', $leaveRequestId)->firstOrFail();

        Sanctum::actingAs($admin);

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'approve',
            'note' => 'Enjoy your leave.',
        ])
            ->assertOk()
            ->assertJsonPath('approval_request.status', 'approved');

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leaveRequestId,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('leave_entitlements', [
            'employee_id' => $employeeUser->employee->id,
            'leave_type_id' => $annual->id,
            'days_pending' => 0,
            'days_used' => 3,
        ]);
    }

    public function test_leave_request_rejects_overlapping_dates(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $employeeUser->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-10-05',
            'ends_on' => '2026-10-07',
        ])->assertCreated();

        $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-10-06',
            'ends_on' => '2026-10-08',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['starts_on']);
    }

    public function test_employee_only_sees_their_own_leave_requests_and_entitlements(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/leave/entitlements')
            ->assertOk()
            ->assertJsonMissing(['employee_number' => 'EMP-HR-001']);

        $this->getJson('/api/leave/requests')
            ->assertOk()
            ->assertJsonMissing(['employee_number' => 'EMP-HR-001']);
    }

    public function test_cannot_update_leave_reference_data_from_another_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::query()->create([
            'name' => 'Other Leave Tenant',
            'code' => 'OTHERLEAVE',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherType = LeaveType::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Annual',
            'code' => 'OTHER-ANNUAL',
        ]);
        $otherPeriod = LeavePeriod::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other 2027 Leave Year',
            'starts_on' => '2027-01-01',
            'ends_on' => '2027-12-31',
        ]);
        $otherHoliday = LeaveHoliday::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Holiday',
            'date' => '2027-05-01',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/leave/types/{$otherType->id}", ['name' => 'Hijacked'])->assertNotFound();
        $this->patchJson("/api/leave/periods/{$otherPeriod->id}", ['name' => 'Hijacked'])->assertNotFound();
        $this->patchJson("/api/leave/holidays/{$otherHoliday->id}", ['name' => 'Hijacked'])->assertNotFound();

        $this->assertDatabaseMissing('leave_types', ['id' => $otherType->id, 'name' => 'Hijacked']);
        $this->assertDatabaseMissing('leave_periods', ['id' => $otherPeriod->id, 'name' => 'Hijacked']);
        $this->assertDatabaseMissing('leave_holidays', ['id' => $otherHoliday->id, 'name' => 'Hijacked']);
    }
}
