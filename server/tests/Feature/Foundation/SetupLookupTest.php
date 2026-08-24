<?php

namespace Tests\Feature\Foundation;

use App\Models\Cluster;
use App\Models\Department;
use App\Models\Designation;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SetupLookupTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A "Deactivate" action only ever sends {is_active: false} — no name/code — so
     * update validation must accept a partial payload for every lookup type, not just
     * on paper. This previously 422'd everywhere because name/code were unconditionally
     * required, even on update.
     */
    public function test_deactivate_only_payload_is_accepted_for_every_setup_lookup_type(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organizationId = $admin->organization_id;
        Sanctum::actingAs($admin);

        $department = Department::query()->where('organization_id', $organizationId)->firstOrFail();
        $unit = Unit::query()->where('organization_id', $organizationId)->firstOrFail();
        $designation = Designation::query()->where('organization_id', $organizationId)->firstOrFail();
        $gradeLevel = GradeLevel::query()->where('organization_id', $organizationId)->firstOrFail();
        $employmentType = EmploymentType::query()->where('organization_id', $organizationId)->firstOrFail();
        $location = OrganizationLocation::query()->where('organization_id', $organizationId)->where('is_primary', false)->firstOrFail();
        $cluster = Cluster::query()->create([
            'organization_id' => $organizationId,
            'department_id' => $department->id,
            'name' => 'Test Cluster',
            'code' => 'TEST-CLU',
        ]);

        $cases = [
            ['url' => "/api/setup/departments/{$department->id}", 'model' => Department::class, 'id' => $department->id],
            ['url' => "/api/setup/units/{$unit->id}", 'model' => Unit::class, 'id' => $unit->id],
            ['url' => "/api/setup/designations/{$designation->id}", 'model' => Designation::class, 'id' => $designation->id],
            ['url' => "/api/setup/grade-levels/{$gradeLevel->id}", 'model' => GradeLevel::class, 'id' => $gradeLevel->id],
            ['url' => "/api/setup/employment-types/{$employmentType->id}", 'model' => EmploymentType::class, 'id' => $employmentType->id],
            ['url' => "/api/setup/locations/{$location->id}", 'model' => OrganizationLocation::class, 'id' => $location->id],
            ['url' => "/api/setup/clusters/{$cluster->id}", 'model' => Cluster::class, 'id' => $cluster->id],
        ];

        foreach ($cases as $case) {
            $this->patchJson($case['url'], ['is_active' => false])
                ->assertOk();

            $this->assertFalse($case['model']::query()->find($case['id'])->is_active, "{$case['model']} did not deactivate.");
        }
    }

    public function test_authenticated_user_can_fetch_all_setup_lookups(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/setup/lookups')
            ->assertOk()
            ->assertJsonStructure([
                'departments',
                'units',
                'designations',
                'grade_levels',
                'employment_types',
                'locations',
                'clusters',
            ])
            ->assertJsonPath('departments.0.code', 'CMP');
    }

    public function test_admin_can_create_a_cluster_with_multiple_locations(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()->where('organization_id', $admin->organization_id)->where('code', 'FIN')->firstOrFail();
        $locations = OrganizationLocation::query()->where('organization_id', $admin->organization_id)->take(2)->get();

        Sanctum::actingAs($admin);

        $clusterId = $this->postJson('/api/setup/clusters', [
            'name' => 'Lagos Cluster',
            'code' => 'LAG-CLU',
            'department_id' => $department->id,
            'location_ids' => $locations->pluck('id')->all(),
        ])
            ->assertCreated()
            ->assertJsonPath('cluster.name', 'Lagos Cluster')
            ->assertJsonPath('cluster.department.code', 'FIN')
            ->assertJsonCount(2, 'cluster.locations')
            ->json('cluster.id');

        $this->getJson('/api/setup/clusters')
            ->assertOk()
            ->assertJsonFragment(['code' => 'LAG-CLU']);

        // Re-saving with a narrower location list replaces the pivot rather than appending to it.
        $this->patchJson("/api/setup/clusters/{$clusterId}", [
            'name' => 'Lagos Cluster',
            'code' => 'LAG-CLU',
            'department_id' => $department->id,
            'location_ids' => [$locations->first()->id],
        ])
            ->assertOk()
            ->assertJsonCount(1, 'cluster.locations');
    }

    public function test_cluster_creation_requires_workspace_settings_permission(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $department = Department::query()->where('organization_id', $employee->organization_id)->where('code', 'FIN')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->postJson('/api/setup/clusters', [
            'name' => 'Lagos Cluster',
            'code' => 'LAG-CLU',
            'department_id' => $department->id,
        ])->assertForbidden();
    }

    public function test_units_can_be_filtered_by_department(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $department = Department::query()
            ->where('organization_id', $admin->organization_id)
            ->where('code', 'HR')
            ->firstOrFail();

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/setup/units?department_id={$department->id}");

        $response->assertOk();

        $this->assertTrue(collect($response->json('data'))->pluck('code')->contains('HR-REC'));
        $this->assertFalse(collect($response->json('data'))->pluck('code')->contains('FIN-PAY'));
    }

    public function test_setup_lookups_require_authentication(): void
    {
        $this->getJson('/api/setup/lookups')
            ->assertUnauthorized();
    }
}
