<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Services\DefaultApprovalWorkflowService;
use Illuminate\Database\Seeder;

class ApprovalWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        app(DefaultApprovalWorkflowService::class)->seedForOrganization($organization);
    }
}
