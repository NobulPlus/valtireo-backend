<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'name',
    'code',
    'email',
    'phone',
    'website',
    'sector',
    'status',
    'address',
    'city',
    'state',
    'country',
    'settings',
])]
class Organization extends Model implements AuditableContract
{
    /** @use HasFactory<OrganizationFactory> */
    use Auditable, HasFactory;

    public function locations(): HasMany
    {
        return $this->hasMany(OrganizationLocation::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    public function designations(): HasMany
    {
        return $this->hasMany(Designation::class);
    }

    public function gradeLevels(): HasMany
    {
        return $this->hasMany(GradeLevel::class);
    }

    public function employmentTypes(): HasMany
    {
        return $this->hasMany(EmploymentType::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function documentTypes(): HasMany
    {
        return $this->hasMany(DocumentType::class);
    }

    public function documentRequirements(): HasMany
    {
        return $this->hasMany(DocumentRequirement::class);
    }

    public function employeeDocuments(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function employeeCustomFields(): HasMany
    {
        return $this->hasMany(EmployeeCustomField::class);
    }

    public function employeeCustomFieldValues(): HasMany
    {
        return $this->hasMany(EmployeeCustomFieldValue::class);
    }

    public function employeeProfileActivities(): HasMany
    {
        return $this->hasMany(EmployeeProfileActivity::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(PlatformModule::class, 'organization_modules', 'organization_id', 'platform_module_id')
            ->withPivot(['status', 'starts_at', 'expires_at', 'settings'])
            ->withTimestamps();
    }

    public function moduleSubscriptions(): HasMany
    {
        return $this->hasMany(OrganizationModule::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }
}
