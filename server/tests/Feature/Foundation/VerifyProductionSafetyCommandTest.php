<?php

namespace Tests\Feature\Foundation;

use Tests\TestCase;

class VerifyProductionSafetyCommandTest extends TestCase
{
    public function test_passes_outside_production_regardless_of_debug_setting(): void
    {
        $this->app['env'] = 'local';
        config(['app.debug' => true]);

        $this->artisan('app:verify-production-safety')->assertExitCode(0);
    }

    public function test_fails_in_production_with_debug_enabled(): void
    {
        $this->app['env'] = 'production';
        config(['app.debug' => true]);

        $this->artisan('app:verify-production-safety')->assertExitCode(1);
    }

    public function test_passes_in_production_with_debug_disabled(): void
    {
        $this->app['env'] = 'production';
        config(['app.debug' => false]);

        $this->artisan('app:verify-production-safety')->assertExitCode(0);
    }
}
