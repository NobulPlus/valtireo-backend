<?php

namespace App\Services;

use App\Models\Organization;

class DefaultTicketCategorySeedingService
{
    public function seedForOrganization(Organization $organization): void
    {
        foreach ($this->definitions() as $code => $definition) {
            $category = $organization->ticketCategories()->firstOrCreate(
                ['code' => $code],
                $definition
            );

            $slaDefaults = array_filter([
                'response_sla_hours' => $category->response_sla_hours ?? $definition['response_sla_hours'],
                'resolution_sla_hours' => $category->resolution_sla_hours ?? $definition['resolution_sla_hours'],
            ], fn ($value) => $value !== null);

            if ($slaDefaults !== [] && (
                $category->response_sla_hours === null ||
                $category->resolution_sla_hours === null
            )) {
                $category->fill($slaDefaults)->save();
            }
        }
    }

    /**
     * @return array<string, array{name: string, description: string, response_sla_hours: int|null, resolution_sla_hours: int|null}>
     */
    private function definitions(): array
    {
        return [
            'IT' => [
                'name' => 'IT',
                'description' => 'Hardware, software, accounts, and technology support requests.',
                'response_sla_hours' => 4,
                'resolution_sla_hours' => 24,
            ],
            'FACILITIES' => [
                'name' => 'Facilities',
                'description' => 'Office, equipment, and building-related requests.',
                'response_sla_hours' => 8,
                'resolution_sla_hours' => 48,
            ],
            'HR_POLICY' => [
                'name' => 'HR / Policy',
                'description' => 'Questions about HR policy, benefits, and procedures.',
                'response_sla_hours' => 8,
                'resolution_sla_hours' => 72,
            ],
            'OTHER' => [
                'name' => 'Other',
                'description' => 'Anything that does not fit another category.',
                'response_sla_hours' => 12,
                'resolution_sla_hours' => 96,
            ],
        ];
    }
}
