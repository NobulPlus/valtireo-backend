<?php

namespace Database\Factories;

use App\Models\PlatformModule;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PlatformModule>
 */
class PlatformModuleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => Str::title($name),
            'key' => Str::slug($name, '_'),
            'description' => fake()->sentence(),
            'category' => 'core',
            'required_permission' => null,
            'is_active' => true,
            'sort_order' => fake()->numberBetween(1, 100),
        ];
    }
}
