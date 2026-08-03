<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\Organization;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Unit>
 */
class UnitFactory extends Factory
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
            'department_id' => Department::factory(),
            'name' => fake()->unique()->randomElement(['Records', 'Recruitment', 'Payroll', 'Support', 'Field Operations']),
            'code' => Str::upper(fake()->unique()->lexify('UNT???')),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
