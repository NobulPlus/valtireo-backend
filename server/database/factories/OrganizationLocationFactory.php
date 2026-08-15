<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\OrganizationLocation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrganizationLocation>
 */
class OrganizationLocationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name' => fake()->city().' Office',
            'code' => Str::upper(fake()->unique()->lexify('LOC???')),
            'type' => fake()->randomElement(['head_office', 'branch', 'field_office', 'facility']),
            'email' => fake()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'state' => fake()->state(),
            'country' => fake()->country(),
            'is_primary' => false,
            'is_active' => true,
        ];
    }
}
