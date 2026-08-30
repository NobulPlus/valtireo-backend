<?php

namespace App\Services;

use App\Models\Organization;

class DefaultTicketCategorySeedingService
{
    public function seedForOrganization(Organization $organization): void
    {
        foreach ($this->definitions() as $code => $definition) {
            $organization->ticketCategories()->firstOrCreate(
                ['code' => $code],
                $definition
            );
        }
    }

    /**
     * @return array<string, array{name: string, description: string}>
     */
    private function definitions(): array
    {
        return [
            'IT' => [
                'name' => 'IT',
                'description' => 'Hardware, software, accounts, and technology support requests.',
            ],
            'FACILITIES' => [
                'name' => 'Facilities',
                'description' => 'Office, equipment, and building-related requests.',
            ],
            'HR_POLICY' => [
                'name' => 'HR / Policy',
                'description' => 'Questions about HR policy, benefits, and procedures.',
            ],
            'OTHER' => [
                'name' => 'Other',
                'description' => 'Anything that does not fit another category.',
            ],
        ];
    }
}
