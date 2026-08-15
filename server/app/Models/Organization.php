<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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

    public function approvalWorkflows(): HasMany
    {
        return $this->hasMany(ApprovalWorkflow::class);
    }

    public function approvalRequests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class);
    }

    public function leaveTypes(): HasMany
    {
        return $this->hasMany(LeaveType::class);
    }

    public function leavePeriods(): HasMany
    {
        return $this->hasMany(LeavePeriod::class);
    }

    public function leaveHolidays(): HasMany
    {
        return $this->hasMany(LeaveHoliday::class);
    }

    public function leaveWorkDays(): HasMany
    {
        return $this->hasMany(LeaveWorkDay::class);
    }

    public function leaveEntitlements(): HasMany
    {
        return $this->hasMany(LeaveEntitlement::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function attendanceSetting(): HasOne
    {
        return $this->hasOne(AttendanceSetting::class);
    }

    public function workShifts(): HasMany
    {
        return $this->hasMany(WorkShift::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function attendanceCorrectionRequests(): HasMany
    {
        return $this->hasMany(AttendanceCorrectionRequest::class);
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

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrganizationStatusHistory::class)->latest('id');
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
