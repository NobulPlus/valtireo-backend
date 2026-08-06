<?php

namespace Tests\Feature\Foundation;

use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SetupLookupTest extends TestCase
{
    use RefreshDatabase;

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
            ])
            ->assertJsonPath('departments.0.code', 'CMP');
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
