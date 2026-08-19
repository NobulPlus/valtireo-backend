<?php

namespace App\Models;

use Database\Factories\EmployeeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

#[Fillable([
    'organization_id',
    'user_id',
    'employee_number',
    'first_name',
    'middle_name',
    'last_name',
    'work_email',
    'phone',
    'department_id',
    'unit_id',
    'designation_id',
    'grade_level_id',
    'employment_type_id',
    'organization_location_id',
    'reporting_manager_id',
    'start_date',
    'status',
    'pending_role_id',
    'invited_at',
    'onboarding_completed_at',
    'activated_at',
    'probation_ends_at',
])]
class Employee extends Model implements AuditableContract
{
    /** @use HasFactory<EmployeeFactory> */
    use Auditable, HasFactory;

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class);
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function employmentType(): BelongsTo
    {
        return $this->belongsTo(EmploymentType::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(OrganizationLocation::class, 'organization_location_id');
    }

    public function reportingManager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reporting_manager_id');
    }

    public function pendingRole(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'pending_role_id');
    }

    public function directReports(): HasMany
    {
        return $this->hasMany(Employee::class, 'reporting_manager_id');
    }

    public function profile(): HasOne
    {
        return $this->hasOne(EmployeeProfile::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(EmployeeInvitation::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmployeeEmergencyContact::class);
    }

    public function dependents(): HasMany
    {
        return $this->hasMany(EmployeeDependent::class);
    }

    public function customFieldValues(): HasMany
    {
        return $this->hasMany(EmployeeCustomFieldValue::class);
    }

    public function profileActivities(): HasMany
    {
        return $this->hasMany(EmployeeProfileActivity::class)->latest();
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(EmployeeStatusHistory::class);
    }

    public function reportingHistories(): HasMany
    {
        return $this->hasMany(EmployeeReportingHistory::class);
    }

    public function leaveEntitlements(): HasMany
    {
        return $this->hasMany(LeaveEntitlement::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function attendanceCorrectionRequests(): HasMany
    {
        return $this->hasMany(AttendanceCorrectionRequest::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'invited_at' => 'datetime',
            'onboarding_completed_at' => 'datetime',
            'activated_at' => 'datetime',
            'probation_ends_at' => 'date',
        ];
    }
}
