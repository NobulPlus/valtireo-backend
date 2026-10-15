<?php

namespace App\Console\Commands;

use Database\Seeders\PlatformModuleSeeder;
use Illuminate\Console\Command;

/**
 * Updates (or creates) platform_modules catalog rows from
 * PlatformModuleSeeder's definitions — e.g. the required_permission fix for
 * the documents module — without touching demo data. `PlatformModuleSeeder`
 * uses updateOrCreate keyed by `key`, so this is safe to run any number of
 * times against a real environment.
 *
 * Deliberately narrower than `php artisan db:seed`: that command runs the
 * *entire* DatabaseSeeder chain (organization bootstrap, demo employees,
 * leave/attendance demo data, etc.), which must never run against a real
 * environment. This command calls only PlatformModuleSeeder, nothing else.
 */
class SyncPlatformModuleCatalog extends Command
{
    protected $signature = 'modules:sync-catalog';

    protected $description = 'Updates the platform_modules catalog from PlatformModuleSeeder only — does not run the full demo seeder chain.';

    public function handle(): int
    {
        $this->call(PlatformModuleSeeder::class);
        $this->info('Platform module catalog synced.');

        return self::SUCCESS;
    }
}
