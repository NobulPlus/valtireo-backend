<?php

namespace App\Console\Commands;

use App\Models\EmployeeProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Step 2 of 2 — see docs/audits/07-pre-launch-fixes-deployment-checklist.md.
 *
 * This is the step that actually closes public access to previously-uploaded
 * passport photos. Deliberately separate from the copy step
 * (employees:migrate-passport-photos-to-private) and never auto-run, so it
 * only happens once someone has confirmed the new deployment is correctly
 * serving photos from private storage — running it too early, before a
 * private copy exists, would make that employee's photo briefly
 * unreachable, which is exactly what this command refuses to do.
 */
class PrunePublicPassportPhotos extends Command
{
    protected $signature = 'employees:prune-public-passport-photos {--dry-run : List what would be deleted without deleting anything}';

    protected $description = 'Deletes employee passport photos still on the public disk, but only once a private copy of each one already exists.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $profiles = EmployeeProfile::query()->whereNotNull('passport_photo_path')->get();

        $deleted = 0;
        $alreadyGone = 0;
        $skippedNoPrivateCopy = 0;
        $failed = 0;

        foreach ($profiles as $profile) {
            $path = $profile->passport_photo_path;

            if (! Storage::disk('public')->exists($path)) {
                $alreadyGone++;

                continue;
            }

            // The one safety invariant this command exists to enforce: never
            // delete the only copy of a photo.
            if (! Storage::disk('local')->exists($path)) {
                $skippedNoPrivateCopy++;
                $this->warn("Refusing to delete the public copy for employee profile #{$profile->id} — no private copy exists yet ({$path}). Run employees:migrate-passport-photos-to-private first.");

                continue;
            }

            if ($dryRun) {
                $this->line("Would delete public copy: {$path}");
                $deleted++;

                continue;
            }

            try {
                Storage::disk('public')->delete($path);
                $deleted++;
            } catch (Throwable $e) {
                $failed++;
                $this->error("Failed to delete public copy for employee profile #{$profile->id} ({$path}): {$e->getMessage()}");
            }
        }

        $label = $dryRun ? 'Would delete' : 'Deleted';
        $this->info("{$label} {$deleted} public copy(ies). {$alreadyGone} already gone. {$skippedNoPrivateCopy} skipped (no private copy yet). {$failed} failed.");

        if ($skippedNoPrivateCopy > 0 || $failed > 0) {
            return self::FAILURE;
        }

        if (! $dryRun && $deleted > 0) {
            $this->info('Public access to previously-uploaded passport photos is now closed.');
        }

        return self::SUCCESS;
    }
}
