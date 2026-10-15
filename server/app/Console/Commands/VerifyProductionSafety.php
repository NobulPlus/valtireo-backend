<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * A deploy-time gate, not a dev convenience — run from docker-entrypoint.sh
 * before the app starts serving traffic. Fails loudly (non-zero exit) rather
 * than silently proceeding, since APP_DEBUG=true in production leaks stack
 * traces, raw SQL, and internal file paths to end users on any unhandled
 * error. No-ops outside the production environment so local/staging work is
 * never blocked by this check.
 */
class VerifyProductionSafety extends Command
{
    protected $signature = 'app:verify-production-safety';

    protected $description = 'Fails if the app is misconfigured for safe production operation (e.g. APP_DEBUG enabled).';

    public function handle(): int
    {
        if (! app()->environment('production')) {
            $this->info('Not running in the production environment — skipping.');

            return self::SUCCESS;
        }

        if (config('app.debug') === true) {
            $this->error('APP_DEBUG is enabled in production. This leaks stack traces, SQL queries, and internal file paths to end users on any unhandled error. Set APP_DEBUG=false and clear any cached config (php artisan config:clear) before redeploying.');

            return self::FAILURE;
        }

        $this->info('Production safety check passed: APP_DEBUG is disabled.');

        return self::SUCCESS;
    }
}
