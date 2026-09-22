<?php

namespace App\Services;

use App\Models\Organization;

class DefaultAssetCategorySeedingService
{
    public function seedForOrganization(Organization $organization): void
    {
        foreach ($this->definitions() as $code => $definition) {
            $organization->assetCategories()->firstOrCreate(
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
            'LAPTOP' => [
                'name' => 'Laptop',
                'description' => 'Laptops and notebook computers.',
            ],
            'PHONE' => [
                'name' => 'Phone',
                'description' => 'Mobile phones and SIM-enabled devices.',
            ],
            'ID_CARD' => [
                'name' => 'ID card',
                'description' => 'Staff identification and access cards.',
            ],
            'FURNITURE' => [
                'name' => 'Furniture',
                'description' => 'Desks, chairs, and other office furniture.',
            ],
            'OTHER' => [
                'name' => 'Other',
                'description' => 'Anything that does not fit another category.',
            ],
        ];
    }
}
