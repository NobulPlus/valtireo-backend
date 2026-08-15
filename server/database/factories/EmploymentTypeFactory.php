<?php

namespace Database\Factories;

use App\Models\EmploymentType;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<EmploymentType>
 */
class EmploymentTypeFactory extends Factory
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
            'name' => fake()->unique()->randomElement(['Permanent', 'Contract', 'Temporary', 'Intern', 'Consultant']),
            'code' => Str::upper(fake()->unique()->lexify('EMP???')),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
