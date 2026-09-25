<?php

namespace Database\Factories;

use App\Models\Cluster;
use App\Models\Department;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Cluster>
 */
class ClusterFactory extends Factory
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
            'name' => fake()->unique()->randomElement(['Lagos Cluster', 'Abuja Cluster', 'South-South Cluster', 'North Cluster']),
            'code' => Str::upper(fake()->unique()->lexify('CLU???')),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
