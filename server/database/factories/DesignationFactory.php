<?php

namespace Database\Factories;

use App\Models\Designation;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Designation>
 */
class DesignationFactory extends Factory
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
            'name' => fake()->jobTitle(),
            'code' => Str::upper(fake()->unique()->lexify('DSG???')),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
