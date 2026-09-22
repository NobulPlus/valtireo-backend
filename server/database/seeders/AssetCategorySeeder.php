<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Services\DefaultAssetCategorySeedingService;
use Illuminate\Database\Seeder;

class AssetCategorySeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        app(DefaultAssetCategorySeedingService::class)->seedForOrganization($organization);
    }
}
