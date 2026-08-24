<?php

namespace Tests\Feature\Employees;

use App\Models\Cluster;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeClusterAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_create_an_employee_with_a_cluster(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = $admin->organization;
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'FIN')->firstOrFail();
        $cluster = Cluster::query()->create([
            'organization_id' => $organization->id,
            'department_id' => $department->id,
            'name' => 'Lagos Cluster',
            'code' => 'LAG-CLU',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/employees', $this->payload($organization, $department, [
            'cluster_id' => $cluster->id,
        ]));

        $response->assertCreated()
            ->assertJsonPath('employee.cluster.id', $cluster->id)
            ->assertJsonPath('employee.cluster.name', 'Lagos Cluster');

        $this->assertDatabaseHas('employees', [
            'employee_number' => 'EMP-CLU-001',
            'cluster_id' => $cluster->id,
        ]);
    }

    public function test_employee_creation_rejects_a_cluster_from_a_different_department(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = $admin->organization;
        $department = Department::query()->whereBelongsTo($organization)->where('code', 'FIN')->firstOrFail();
        $otherDepartment = Department::query()->whereBelongsTo($organization)->where('code', 'OPS')->firstOrFail();
        $cluster = Cluster::query()->create([
            'organization_id' => $organization->id,
            'department_id' => $otherDepartment->id,
            'name' => 'Ops Cluster',
            'code' => 'OPS-CLU',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/employees', $this->payload($organization, $department, [
            'cluster_id' => $cluster->id,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cluster_id']);
    }

    public function test_hr_admin_can_move_an_existing_employee_to_a_cluster(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();
        $cluster = Cluster::query()->create([
            'organization_id' => $admin->organization_id,
            'department_id' => $employee->department_id,
            'name' => 'Lagos Cluster',
            'code' => 'LAG-CLU',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/employees/{$employee->id}", [
            'cluster_id' => $cluster->id,
        ])->assertOk();

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'cluster_id' => $cluster->id,
        ]);
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function payload(Organization $organization, Department $department, array $overrides = []): array
    {
        $designation = Designation::query()->whereBelongsTo($organization)->where('code', 'OFF')->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->where('code', 'PERM')->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->where('code', 'HQ')->firstOrFail();

        return [
            'employee_number' => 'EMP-CLU-001',
            'first_name' => 'Chidi',
            'last_name' => 'Okonkwo',
            'work_email' => 'chidi.okonkwo@valtireo.test',
            'department_id' => $department->id,
            'designation_id' => $designation->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'send_invitation' => false,
            ...$overrides,
        ];
    }
}
