<?php

namespace Tests\Feature\Employees;

use App\Console\Commands\MigratePassportPhotosToPrivateStorage;
use App\Console\Commands\PrunePublicPassportPhotos;
use App\Models\Employee;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The two-step passport-photo migration — see
 * docs/audits/07-pre-launch-fixes-deployment-checklist.md for the full
 * rollout sequence these two commands are designed around.
 */
class PassportPhotoMigrationTest extends TestCase
{
    use RefreshDatabase;

    // --- employees:migrate-passport-photos-to-private ---

    public function test_copies_a_legacy_photo_without_deleting_the_public_original(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(0);

        Storage::disk('local')->assertExists($path);
        // The whole point of copy-not-move: the original must survive.
        Storage::disk('public')->assertExists($path);
    }

    public function test_skips_a_photo_that_is_already_private(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/already-private.jpg";
        Storage::disk('local')->put($path, 'already-there');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)
            ->expectsOutputToContain('0 photo(s) to private storage')
            ->assertExitCode(0);
    }

    public function test_warns_but_succeeds_when_a_photo_is_missing_on_both_disks(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee->profile()->update(['passport_photo_path' => 'organizations/missing/employees/missing/passport/gone.jpg']);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(0);
    }

    public function test_a_single_write_failure_does_not_delete_the_public_original_and_exits_nonzero(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $realPublicDisk = Storage::disk('public');

        // A disk-full/permission-denied write failure, simulated deterministically
        // (a directory/file name collision doesn't reliably throw on every OS).
        $brokenLocalDisk = \Mockery::mock(Filesystem::class);
        $brokenLocalDisk->shouldReceive('exists')->andReturn(false);
        $brokenLocalDisk->shouldReceive('put')->andThrow(new \RuntimeException('Simulated disk failure'));
        Storage::shouldReceive('disk')->andReturnUsing(fn ($name) => $name === 'local' ? $brokenLocalDisk : $realPublicDisk);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(1);

        // Nothing was deleted on failure.
        $this->assertTrue($realPublicDisk->exists($path));
    }

    public function test_one_failing_profile_does_not_block_others_from_being_copied(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $realLocalDisk = Storage::disk('local');
        $realPublicDisk = Storage::disk('public');

        $failing = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $failingPath = "organizations/{$failing->organization_id}/employees/{$failing->id}/passport/legacy.jpg";
        $realPublicDisk->put($failingPath, 'legacy-image-bytes');
        $failing->profile()->update(['passport_photo_path' => $failingPath]);

        $working = Employee::query()->where('work_email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        $workingPath = "organizations/{$working->organization_id}/employees/{$working->id}/passport/legacy.jpg";
        $realPublicDisk->put($workingPath, 'legacy-image-bytes');
        $working->profile()->update(['passport_photo_path' => $workingPath]);

        // Fails only the one specific path, delegates every other call to a
        // real fake local disk so the "working" profile actually lands somewhere.
        $brokenLocalDisk = \Mockery::mock(Filesystem::class);
        $brokenLocalDisk->shouldReceive('exists')->andReturnUsing(fn ($p) => $realLocalDisk->exists($p));
        $brokenLocalDisk->shouldReceive('put')->andReturnUsing(function ($p, $contents) use ($failingPath, $realLocalDisk) {
            if ($p === $failingPath) {
                throw new \RuntimeException('Simulated disk failure');
            }

            return $realLocalDisk->put($p, $contents);
        });
        Storage::shouldReceive('disk')->andReturnUsing(fn ($name) => $name === 'local' ? $brokenLocalDisk : $realPublicDisk);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(1);

        $this->assertTrue($realLocalDisk->exists($workingPath));
        $this->assertTrue($realPublicDisk->exists($failingPath));
    }

    public function test_re_running_after_a_successful_copy_is_a_safe_no_op(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(0);
        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(0);

        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertExists($path);
    }

    // --- employees:prune-public-passport-photos ---

    public function test_refuses_to_delete_when_no_private_copy_exists_yet(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        // No employees:migrate-passport-photos-to-private run yet.
        $this->artisan(PrunePublicPassportPhotos::class)->assertExitCode(1);

        Storage::disk('public')->assertExists($path);
    }

    public function test_deletes_the_public_copy_once_a_private_copy_is_confirmed(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        Storage::disk('local')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(PrunePublicPassportPhotos::class)->assertExitCode(0);

        Storage::disk('public')->assertMissing($path);
        Storage::disk('local')->assertExists($path);
    }

    public function test_dry_run_reports_without_deleting_anything(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        Storage::disk('local')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(PrunePublicPassportPhotos::class, ['--dry-run' => true])->assertExitCode(0);

        Storage::disk('public')->assertExists($path);
    }

    public function test_pruning_twice_is_a_safe_no_op(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        Storage::disk('local')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        $this->artisan(PrunePublicPassportPhotos::class)->assertExitCode(0);
        $this->artisan(PrunePublicPassportPhotos::class)->assertExitCode(0);
    }

    public function test_full_two_step_sequence_leaves_photo_reachable_throughout(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $this->seed();

        $employee = Employee::query()->where('work_email', 'aisha.bello@valtireo.test')->firstOrFail();
        $path = "organizations/{$employee->organization_id}/employees/{$employee->id}/passport/legacy.jpg";
        Storage::disk('public')->put($path, 'legacy-image-bytes');
        $employee->profile()->update(['passport_photo_path' => $path]);

        // Step 1: copy. Public original still serves old clients/URLs.
        $this->artisan(MigratePassportPhotosToPrivateStorage::class)->assertExitCode(0);
        Storage::disk('public')->assertExists($path);
        // New code would already find it here too — no access gap.
        Storage::disk('local')->assertExists($path);

        // Step 2 (run only after the new deployment is verified): prune.
        $this->artisan(PrunePublicPassportPhotos::class)->assertExitCode(0);
        Storage::disk('public')->assertMissing($path);
        Storage::disk('local')->assertExists($path);
    }
}
