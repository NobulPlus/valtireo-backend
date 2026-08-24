<?php

namespace Tests\Feature\Leave;

use App\Models\ApprovalRequest;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveEntitlement;
use App\Models\LeaveHoliday;
use App\Models\LeavePeriod;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
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

    public function test_hr_can_delete_a_leave_entitlement_with_no_usage(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Delete No Usage Test Period',
            'starts_on' => '2028-01-01',
            'ends_on' => '2028-12-31',
        ]);

        $entitlement = LeaveEntitlement::query()->create([
            'organization_id' => $admin->organization_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 10,
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/leave/entitlements/{$entitlement->id}")->assertOk();

        $this->assertDatabaseMissing('leave_entitlements', ['id' => $entitlement->id]);
    }

    public function test_cannot_delete_a_leave_entitlement_with_used_or_pending_days(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Delete With Usage Test Period',
            'starts_on' => '2028-01-01',
            'ends_on' => '2028-12-31',
        ]);

        $entitlement = LeaveEntitlement::query()->create([
            'organization_id' => $admin->organization_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 20,
            'days_used' => 2,
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/leave/entitlements/{$entitlement->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['leave_entitlement']);

        $this->assertDatabaseHas('leave_entitlements', ['id' => $entitlement->id]);
    }

    public function test_cannot_delete_another_organizations_leave_entitlement(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        $otherOrganization = Organization::query()->create([
            'name' => 'Other Entitlement Tenant',
            'code' => 'OTHERENTITLE',
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);
        $otherType = LeaveType::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Annual',
            'code' => 'OTHER-ANNUAL2',
        ]);
        $otherPeriod = LeavePeriod::query()->create([
            'organization_id' => $otherOrganization->id,
            'name' => 'Other Leave Year',
            'starts_on' => '2027-01-01',
            'ends_on' => '2027-12-31',
        ]);
        $otherEmployee = Employee::factory()->create(['organization_id' => $otherOrganization->id]);
        $otherEntitlement = LeaveEntitlement::query()->create([
            'organization_id' => $otherOrganization->id,
            'employee_id' => $otherEmployee->id,
            'leave_type_id' => $otherType->id,
            'leave_period_id' => $otherPeriod->id,
            'days_allocated' => 10,
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/leave/entitlements/{$otherEntitlement->id}")->assertNotFound();

        $this->assertDatabaseHas('leave_entitlements', [
            'id' => $otherEntitlement->id,
            'days_allocated' => 10,
        ]);
    }

    public function test_bulk_grant_creates_entitlements_for_active_employees_and_skips_existing(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $activeEmployeeCount = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->count();

        $period = LeavePeriod::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Bulk Grant Test Period',
            'starts_on' => '2028-01-01',
            'ends_on' => '2028-12-31',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/leave/entitlements/bulk', [
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 22,
        ])
            ->assertCreated()
            ->assertJsonPath('granted', $activeEmployeeCount)
            ->assertJsonPath('skipped', 0)
            ->assertJsonPath('days_allocated', 22);

        $this->assertSame(
            $activeEmployeeCount,
            LeaveEntitlement::query()->where('leave_period_id', $period->id)->where('leave_type_id', $annual->id)->count()
        );

        // Re-running for the same type and period should skip everyone already granted, not overwrite them.
        $this->postJson('/api/leave/entitlements/bulk', [
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 25,
        ])
            ->assertCreated()
            ->assertJsonPath('granted', 0)
            ->assertJsonPath('skipped', $activeEmployeeCount);

        $this->assertDatabaseMissing('leave_entitlements', [
            'leave_period_id' => $period->id,
            'leave_type_id' => $annual->id,
            'days_allocated' => 25,
        ]);
    }

    public function test_bulk_grant_falls_back_to_leave_type_default_when_days_allocated_omitted(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Default Fallback Period',
            'starts_on' => '2028-01-01',
            'ends_on' => '2028-12-31',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/leave/types/{$annual->id}", ['default_days_per_year' => 18])->assertOk();

        $this->postJson('/api/leave/entitlements/bulk', [
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
        ])
            ->assertCreated()
            ->assertJsonPath('days_allocated', 18);
    }

    public function test_bulk_grant_requires_days_when_leave_type_has_no_default(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $type = LeaveType::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'No Default Leave',
            'code' => 'NODEFAULT',
        ]);
        $period = LeavePeriod::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'No Default Period',
            'starts_on' => '2028-01-01',
            'ends_on' => '2028-12-31',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/leave/entitlements/bulk', [
            'leave_type_id' => $type->id,
            'leave_period_id' => $period->id,
        ])->assertStatus(422);
    }

    public function test_bulk_grant_requires_leave_approval_permission(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->where('organization_id', $admin->organization_id)->firstOrFail();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/leave/entitlements/bulk', [
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 20,
        ])->assertForbidden();
    }

    public function test_approving_onboarding_auto_grants_leave_types_flagged_for_activation(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $sick = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'SICK')->firstOrFail();
        $period = LeavePeriod::query()->where('organization_id', $admin->organization_id)->where('is_active', true)->firstOrFail();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/leave/types/{$annual->id}", [
            'default_days_per_year' => 20,
            'auto_grant_on_activation' => true,
        ])->assertOk();

        // Sick Leave keeps a default but is NOT flagged for auto-grant, and should be left alone.
        $this->patchJson("/api/leave/types/{$sick->id}", [
            'default_days_per_year' => 10,
        ])->assertOk();

        $employee = $this->createOnboardingEmployee();
        $employee->profile()->update(['completion_status' => 'submitted']);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'not_applicable'])
            ->assertOk()
            ->assertJsonPath('employee.status', 'active');

        $this->assertDatabaseHas('leave_entitlements', [
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 20,
        ]);
        $this->assertDatabaseMissing('leave_entitlements', [
            'employee_id' => $employee->id,
            'leave_type_id' => $sick->id,
        ]);
    }

    public function test_auto_grant_on_activation_does_not_duplicate_or_overwrite_an_existing_entitlement(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->where('organization_id', $admin->organization_id)->where('is_active', true)->firstOrFail();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/leave/types/{$annual->id}", [
            'default_days_per_year' => 20,
            'auto_grant_on_activation' => true,
        ])->assertOk();

        $employee = $this->createOnboardingEmployee();
        $employee->profile()->update(['completion_status' => 'submitted']);

        // HR already manually granted a custom amount before onboarding was approved.
        LeaveEntitlement::query()->create([
            'organization_id' => $admin->organization_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 30,
        ]);

        $this->patchJson("/api/employees/{$employee->id}/approve-onboarding", ['confirmation_status' => 'not_applicable'])->assertOk();

        $this->assertSame(
            1,
            LeaveEntitlement::query()->where('employee_id', $employee->id)->where('leave_type_id', $annual->id)->count()
        );
        $this->assertDatabaseHas('leave_entitlements', [
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'days_allocated' => 30,
        ]);
    }

    public function test_moving_to_active_with_a_probation_confirmation_triggers_auto_grant(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()->where('organization_id', $admin->organization_id)->where('code', 'ANNUAL')->firstOrFail();
        $period = LeavePeriod::query()->where('organization_id', $admin->organization_id)->where('is_active', true)->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-OPS-002')->firstOrFail();
        $employee->profile()->update([
            'date_of_birth' => '1994-05-12',
            'gender' => 'male',
            'residential_address' => '24 Operations Street',
            'next_of_kin_name' => 'Grace Adeyemi',
            'next_of_kin_phone' => '08030000002',
            'emergency_contact_name' => 'Grace Adeyemi',
            'emergency_contact_phone' => '08030000002',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/leave/types/{$annual->id}", [
            'default_days_per_year' => 20,
            'auto_grant_on_activation' => true,
        ])->assertOk();

        $this->postJson("/api/employees/{$employee->id}/status-history", [
            'new_status' => 'active',
            'new_confirmation_status' => 'probation',
            'effective_date' => '2026-08-07',
            'probation_ends_at' => '2026-11-07',
        ])->assertCreated();

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
            'confirmation_status' => 'probation',
        ]);

        $this->assertDatabaseHas('leave_entitlements', [
            'employee_id' => $employee->id,
            'leave_type_id' => $annual->id,
            'leave_period_id' => $period->id,
            'days_allocated' => 20,
        ]);
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createOnboardingEmployee(array $overrides = []): Employee
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'HR')->firstOrFail();
        $unit = Unit::query()->whereBelongsTo($organization)->where('code', 'HR-REC')->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'HRO')->firstOrFail();
        $gradeLevel = GradeLevel::query()->whereBelongsTo($organization)->where('code', 'GL03')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        $response = $this->postJson('/api/employees', [
            'employee_number' => 'EMP-AUTOGRANT-001',
            'first_name' => 'Chidinma',
            'last_name' => 'Eze',
            'work_email' => 'autogrant-onboarding@valtireo.test',
            'phone' => '08012340000',
            'department_id' => $department->id,
            'unit_id' => $unit->id,
            'designation_id' => $designation->id,
            'grade_level_id' => $gradeLevel->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'start_date' => '2026-08-02',
            'send_invitation' => false,
            ...$overrides,
        ]);

        $response->assertCreated();

        $employee = Employee::query()->findOrFail($response->json('employee.id'));
        $employee->update(['status' => 'onboarding']);

        return $employee->refresh();
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
