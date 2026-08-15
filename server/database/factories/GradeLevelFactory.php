<?php

namespace Database\Factories;

use App\Models\GradeLevel;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GradeLevel>
 */
class GradeLevelFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $rank = fake()->unique()->numberBetween(1, 17);

        return [
            'organization_id' => Organization::factory(),
            'name' => 'Grade Level '.$rank,
            'code' => 'GL'.$rank,
            'rank' => $rank,
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
