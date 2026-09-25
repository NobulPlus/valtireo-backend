<?php

namespace Tests\Feature\Foundation;

use App\Models\Department;
use App\Models\Designation;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class OrganizationStructureSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_organization_structure(): void
    {
        $this->seed();

        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $hr = Department::query()
            ->where('organization_id', $organization->id)
            ->where('code', 'HR')
            ->firstOrFail();

        $this->assertDatabaseHas('departments', [
            'organization_id' => $organization->id,
            'code' => 'OPS',
            'name' => 'Operations',
        ]);

        $this->assertDatabaseHas('units', [
            'organization_id' => $organization->id,
            'department_id' => $hr->id,
            'code' => 'HR-REC',
            'name' => 'Employee Records',
        ]);

        $this->assertDatabaseHas('designations', [
            'organization_id' => $organization->id,
            'code' => 'HRO',
            'name' => 'HR Officer',
        ]);

        $this->assertDatabaseHas('grade_levels', [
            'organization_id' => $organization->id,
            'code' => 'GL01',
            'rank' => 1,
        ]);

        $this->assertDatabaseHas('employment_types', [
            'organization_id' => $organization->id,
            'code' => 'PERM',
            'name' => 'Permanent',
        ]);

        $this->assertGreaterThanOrEqual(5, Department::query()->whereBelongsTo($organization)->count());
        $this->assertGreaterThanOrEqual(3, Unit::query()->whereBelongsTo($organization)->count());
        $this->assertGreaterThanOrEqual(6, Designation::query()->whereBelongsTo($organization)->count());
        $this->assertGreaterThanOrEqual(7, GradeLevel::query()->whereBelongsTo($organization)->count());
        $this->assertGreaterThanOrEqual(5, EmploymentType::query()->whereBelongsTo($organization)->count());

        $this->assertTrue(Permission::query()->where('name', 'employment_types.update')->exists());
    }
}
