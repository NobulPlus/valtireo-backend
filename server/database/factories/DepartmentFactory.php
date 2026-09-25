<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
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
            'parent_id' => null,
            'name' => fake()->unique()->randomElement(['Human Resources', 'Finance', 'Operations', 'ICT', 'Compliance']),
            'code' => Str::upper(fake()->unique()->lexify('DEP???')),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
