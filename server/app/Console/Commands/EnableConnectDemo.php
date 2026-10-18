<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\PlatformModule;
use Illuminate\Console\Command;

class EnableConnectDemo extends Command
{
    protected $signature = 'connect:enable-demo';

    protected $description = 'Enable Connect for the local LASHMA-DEMO test workspace only';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('This command is restricted to local/testing environments.');

            return self::FAILURE;
        }
        $organization = Organization::where('code', 'LASHMA-DEMO')->first();
        if (! $organization) {
            $this->error('The LASHMA-DEMO test workspace has not been seeded.');

            return self::FAILURE;
        }
        $module = PlatformModule::updateOrCreate(['key' => 'connect'], [
            'name' => 'Connect', 'description' => 'Private employee audio/video meetings and screen sharing.',
            'category' => 'collaboration', 'required_permission' => null, 'is_active' => true, 'sort_order' => 245,
        ]);
        $organization->moduleSubscriptions()->updateOrCreate(['platform_module_id' => $module->id], [
            'status' => 'active', 'starts_at' => now(), 'expires_at' => null,
        ]);
        $this->info('Connect enabled for LASHMA-DEMO. Sign in again to refresh navigation. LiveKit configuration is still required for calls.');

        return self::SUCCESS;
    }
}
