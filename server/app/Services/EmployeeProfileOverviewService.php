<?php

namespace App\Services;

use App\Http\Resources\EmployeeCustomFieldValueResource;
use App\Http\Resources\EmployeeDependentResource;
use App\Http\Resources\EmployeeDocumentResource;
use App\Http\Resources\EmployeeEmergencyContactResource;
use App\Http\Resources\EmployeeProfileActivityResource;
use App\Http\Resources\EmployeeProfileResource;
use App\Http\Resources\EmployeeReportingHistoryResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\EmployeeStatusHistoryResource;
use App\Models\Employee;

class EmployeeProfileOverviewService
{
    /**
     * @return array<string, mixed>
     */
    public function overview(Employee $employee): array
    {
        $employee->load([
            'user',
            'department',
            'unit',
            'designation',
            'gradeLevel',
            'employmentType',
            'location',
            'reportingManager',
            'profile',
            'emergencyContacts',
            'dependents',
            'documents.documentType',
            'documents.requirement',
            'documents.uploadedBy',
            'documents.reviewedBy',
            'customFieldValues.field',
            'customFieldValues.updatedBy',
            'statusHistories.changedBy',
            'reportingHistories.previousManager',
            'reportingHistories.newManager',
            'reportingHistories.changedBy',
            'profileActivities.actor',
        ]);

        return [
            'employee' => new EmployeeResource($employee),
            'profile' => $employee->profile ? new EmployeeProfileResource($employee->profile) : null,
            'emergency_contacts' => EmployeeEmergencyContactResource::collection($employee->emergencyContacts),
            'dependents' => EmployeeDependentResource::collection($employee->dependents),
            'documents' => EmployeeDocumentResource::collection($employee->documents),
            'custom_fields' => EmployeeCustomFieldValueResource::collection($employee->customFieldValues),
            'status_history' => EmployeeStatusHistoryResource::collection($employee->statusHistories),
            'reporting_history' => EmployeeReportingHistoryResource::collection($employee->reportingHistories),
            'activities' => EmployeeProfileActivityResource::collection($employee->profileActivities),
        ];
    }
}
