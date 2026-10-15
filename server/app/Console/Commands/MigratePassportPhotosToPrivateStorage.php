<?php

namespace App\Console\Commands;

use App\Models\EmployeeProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Step 1 of 2 for closing the public exposure on already-uploaded passport
 * photos — see docs/audits/07-pre-launch-fixes-deployment-checklist.md.
 *
 * Deliberately COPIES rather than moves: the public copy is left in place so
 * existing photos stay reachable (via the old public URL, until browsers/
 * clients pick up the new authenticated one) for the entire window between
 * running this and deploying the code that serves photo() from the 'local'
 * disk. Nothing is deleted until employees:prune-public-passport-photos is
 * run separately, deliberately, after the new deployment is verified.
 *
 * Idempotent and safe to re-run: already-private photos are skipped, and a
 * failure on one file never deletes anything, so a partial run can simply be
 * re-run to pick up the rest once the cause is fixed.
 */
class MigratePassportPhotosToPrivateStorage extends Command
{
    protected $signature = 'employees:migrate-passport-photos-to-private';

    protected $description = 'Copies employee passport photos still on the public disk to private (local) storage, without deleting the originals.';

    public function handle(): int
    {
        $profiles = EmployeeProfile::query()->whereNotNull('passport_photo_path')->get();
        $total = $profiles->count();

        $this->info("Found {$total} employee profile(s) with a passport photo on record.");

        $copied = 0;
        $alreadyPrivate = 0;
        $missing = 0;
        $failed = 0;

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($profiles as $profile) {
            $path = $profile->passport_photo_path;

            try {
                if (Storage::disk('local')->exists($path)) {
                    $alreadyPrivate++;

                    continue;
                }

                if (! Storage::disk('public')->exists($path)) {
                    $missing++;
                    $this->newLine();
                    $this->warn("Missing on both disks for employee profile #{$profile->id}: {$path}");

                    continue;
                }

                Storage::disk('local')->put($path, Storage::disk('public')->get($path));

                if (! Storage::disk('local')->exists($path)) {
                    throw new \RuntimeException('Write completed but the file is not readable back from the local disk.');
                }

                $copied++;
            } catch (Throwable $e) {
                $failed++;
                $this->newLine();
                $this->error("Failed to copy employee profile #{$profile->id} ({$path}): {$e->getMessage()}");
            } finally {
                $bar->advance();
            }
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Copied {$copied} photo(s) to private storage. {$alreadyPrivate} already private. {$missing} missing on both disks. {$failed} failed.");

        if ($failed > 0) {
            $this->error("{$failed} photo(s) failed to copy. Public copies for those employees are untouched (nothing is deleted on failure) — investigate and re-run this command before proceeding to employees:prune-public-passport-photos.");

            return self::FAILURE;
        }

        $this->info('Every photo on record now has a private copy. The public copies have NOT been deleted. Once the deployment serving photo() from private storage is live and verified, run `php artisan employees:prune-public-passport-photos` to close the public exposure.');

        return self::SUCCESS;
    }
}
