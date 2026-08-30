<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Services\DefaultTicketCategorySeedingService;
use Illuminate\Database\Seeder;

class TicketCategorySeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        app(DefaultTicketCategorySeedingService::class)->seedForOrganization($organization);
    }
}
