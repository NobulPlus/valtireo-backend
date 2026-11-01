<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\User;
use App\Services\EmployeeProfileActivityService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeePhotoAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_multipart_replacement_versions_all_photo_surfaces_and_survives_a_fresh_session(): void
    {
        Storage::fake('local');
        $this->seed();
        $user = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($user);
        $first = $this->post('/api/me/employee-profile', ['_method' => 'PATCH', 'passport_photo' => UploadedFile::fake()->image('first.jpg')], ['Accept' => 'application/json'])->assertOk();
        $oldPath = $first->json('profile.passport_photo_path');
        $firstUrl = $first->json('profile.passport_photo_url');
        $second = $this->post('/api/me/employee-profile', ['_method' => 'PATCH', 'passport_photo' => UploadedFile::fake()->image('second.png')], ['Accept' => 'application/json'])->assertOk();
        $url = $second->json('profile.passport_photo_url');
        $this->assertNotSame($firstUrl, $url);
        Storage::disk('local')->assertMissing($oldPath);
        Storage::disk('local')->assertExists($second->json('profile.passport_photo_path'));
        $this->actingAsInOrganization($user->fresh());
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.photo_url', $url);
        $this->getJson('/api/employee-profile/overview')->assertOk()->assertJsonPath('profile.passport_photo_url', $url);
        $this->get($url)->assertOk()->assertHeader('x-content-type-options', 'nosniff');
        $this->patchJson('/api/me/employee-profile', ['residential_address' => 'Updated address'])->assertOk()->assertJsonPath('profile.passport_photo_url', $url);
    }

    public function test_failed_disk_write_keeps_the_existing_photo(): void
    {
        Storage::fake('local');
        $this->seed();
        $user = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($user);
        $user->employee->profile()->update(['passport_photo_path' => 'old.jpg']);
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('putFileAs')->once()->andReturn(false);
        $disk->shouldNotReceive('delete');
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);
        $this->post('/api/me/employee-profile', ['_method' => 'PATCH', 'passport_photo' => UploadedFile::fake()->image('new.jpg')], ['Accept' => 'application/json'])->assertStatus(503);
        $this->assertSame('old.jpg', $user->employee->profile()->first()->passport_photo_path);
    }

    public function test_failed_profile_transaction_preserves_old_file_and_removes_new_orphan(): void
    {
        Storage::fake('local');
        $this->seed();
        $user = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($user);
        Storage::disk('local')->put('old.jpg', 'old image');
        $user->employee->profile()->update(['passport_photo_path' => 'old.jpg']);
        $this->mock(EmployeeProfileActivityService::class)->shouldReceive('record')->once()->andThrow(new \RuntimeException('Simulated audit failure'));
        $this->post('/api/me/employee-profile', ['_method' => 'PATCH', 'passport_photo' => UploadedFile::fake()->image('new.jpg')], ['Accept' => 'application/json'])->assertStatus(500);
        $this->assertSame('old.jpg', $user->employee->profile()->first()->passport_photo_path);
        $this->assertSame(['old.jpg'], Storage::disk('local')->allFiles());
    }

    public function test_invalid_and_oversized_uploads_leave_existing_photo_unchanged(): void
    {
        Storage::fake('local');
        $this->seed();
        $user = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $this->actingAsInOrganization($user);
        $user->employee->profile()->update(['passport_photo_path' => 'old.jpg']);
        foreach ([UploadedFile::fake()->create('not-image.jpg', 5, 'text/plain'), UploadedFile::fake()->image('large.png')->size(2049)] as $file) {
            $this->post('/api/me/employee-profile', ['_method' => 'PATCH', 'passport_photo' => $file], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('passport_photo');
        }
        $this->assertSame('old.jpg', $user->employee->profile()->first()->passport_photo_path);
    }

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
