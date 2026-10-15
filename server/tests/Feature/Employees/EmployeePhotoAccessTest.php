<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeePhotoAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_view_their_own_photo(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/photo.jpg";
        Storage::disk('local')->put($path, 'fake-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        Sanctum::actingAs($employeeUser);
        $this->get("/api/employees/{$employee->id}/photo")
            ->assertOk()
            ->assertHeader('content-disposition', 'inline; filename="passport-photo"');
    }

    public function test_admin_with_employees_view_can_see_a_colleagues_photo(): void
    {
        Storage::fake('local');
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/photo.jpg";
        Storage::disk('local')->put($path, 'fake-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->actingAsInOrganization($admin);
        $this->get("/api/employees/{$employee->id}/photo")->assertOk();
    }

    public function test_an_unrelated_colleague_cannot_even_reach_another_employees_photo(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/photo.jpg";
        Storage::disk('local')->put($path, 'fake-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        // EnsureEmployeeVisibility (applied app-wide to any {employee} route
        // param) already 404s an employee who has no reporting/permission
        // relationship to the target before this controller's own check ever runs.
        $otherEmployeeUser = User::factory()->create(['organization_id' => $employee->organization_id]);
        $this->actingAsInOrganization($otherEmployeeUser);
        $this->get("/api/employees/{$employee->id}/photo")->assertNotFound();
    }

    public function test_a_manager_without_employees_view_cannot_see_a_direct_reports_photo(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/photo.jpg";
        Storage::disk('local')->put($path, 'fake-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        // A real manager, visible to EnsureEmployeeVisibility via employees.view_team
        // + the reporting relationship — but still lacking employees.view, so the
        // photo endpoint's own (stricter) check is what has to stop them, not the
        // broader visibility middleware.
        $managerUser = User::factory()->create(['organization_id' => $employee->organization_id]);
        $manager = Employee::factory()->create([
            'organization_id' => $employee->organization_id,
            'user_id' => $managerUser->id,
            'department_id' => $employee->department_id,
            'designation_id' => $employee->designation_id,
            'employment_type_id' => $employee->employment_type_id,
            'organization_location_id' => $employee->organization_location_id,
        ]);
        $employee->update(['reporting_manager_id' => $manager->id]);

        $this->actingAsInOrganization($managerUser);
        $managerUser->givePermissionTo('employees.view_team');

        $this->get("/api/employees/{$employee->id}/photo")->assertForbidden();
    }

    public function test_a_user_in_a_different_organization_gets_not_found(): void
    {
        Storage::fake('local');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/photo.jpg";
        Storage::disk('local')->put($path, 'fake-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $otherOrg = Organization::factory()->create();
        $outsider = User::factory()->create(['organization_id' => $otherOrg->id]);
        $this->actingAsInOrganization($outsider);
        $this->get("/api/employees/{$employee->id}/photo")->assertNotFound();
    }

    public function test_returns_not_found_when_no_photo_uploaded(): void
    {
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);
        $this->get("/api/employees/{$employeeUser->employee->id}/photo")->assertNotFound();
    }

    public function test_uploading_a_new_photo_stores_it_privately_not_publicly(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employeeUser);

        $this->patchJson('/api/me/employee-profile', [
            'passport_photo' => UploadedFile::fake()->image('me.jpg'),
        ])->assertOk();

        $path = $employeeUser->employee->profile->fresh()->passport_photo_path;
        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertDirectoryEmpty('.');
    }
}
