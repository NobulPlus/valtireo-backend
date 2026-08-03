<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\Organization;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employee>
 */
class EmployeeFactory extends Factory
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
            'employee_number' => fake()->unique()->numerify('EMP-####'),
            'first_name' => fake()->firstName(),
            'middle_name' => null,
            'last_name' => fake()->lastName(),
            'work_email' => fake()->unique()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'department_id' => Department::factory(),
            'unit_id' => Unit::factory(),
            'designation_id' => Designation::factory(),
            'grade_level_id' => GradeLevel::factory(),
            'employment_type_id' => EmploymentType::factory(),
            'organization_location_id' => OrganizationLocation::factory(),
            'reporting_manager_id' => null,
            'start_date' => now()->toDateString(),
            'status' => 'draft',
        ];
    }
}
