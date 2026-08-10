<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ApprovalRequestController;
use App\Http\Controllers\Api\ApprovalWorkflowController;
use App\Http\Controllers\Api\AttendanceCorrectionRequestController;
use App\Http\Controllers\Api\AttendanceRecordController;
use App\Http\Controllers\Api\AttendanceSettingController;
use App\Http\Controllers\Api\AuditVisibilityController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentRequirementController;
use App\Http\Controllers\Api\DocumentTypeController;
use App\Http\Controllers\Api\EmployeeDocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\EmployeeCustomFieldController;
use App\Http\Controllers\Api\EmployeeCustomFieldValueController;
use App\Http\Controllers\Api\EmployeeDependentController;
use App\Http\Controllers\Api\EmployeeEmergencyContactController;
use App\Http\Controllers\Api\EmployeeLifecycleController;
use App\Http\Controllers\Api\EmployeeProfileActivityController;
use App\Http\Controllers\Api\EmployeeProfileOverviewController;
use App\Http\Controllers\Api\LeaveEntitlementController;
use App\Http\Controllers\Api\LeaveHolidayController;
use App\Http\Controllers\Api\LeavePeriodController;
use App\Http\Controllers\Api\LeaveRequestController;
use App\Http\Controllers\Api\LeaveTypeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PlatformOrganizationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SetupChecklistController;
use App\Http\Controllers\Api\SetupLookupController;
use App\Http\Controllers\Api\TemplateController;
use App\Http\Controllers\Api\WorkspaceController;
use App\Http\Controllers\Api\WorkShiftController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'valtireo-backend',
    ]);
});

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('platform')->group(function () {
        Route::post('/organizations', [PlatformOrganizationController::class, 'store']);
    });

    Route::get('/workspace', [WorkspaceController::class, 'show']);
    Route::patch('/workspace/settings', [WorkspaceController::class, 'update']);

    Route::prefix('dashboard')->group(function () {
        Route::get('/organization', [DashboardController::class, 'organization']);
        Route::get('/manager', [DashboardController::class, 'manager']);
        Route::get('/me', [DashboardController::class, 'me']);
    });

    Route::get('/templates', [TemplateController::class, 'index']);
    Route::get('/templates/{key}/download', [TemplateController::class, 'download']);
    Route::post('/templates/{key}/preview', [TemplateController::class, 'preview']);
    Route::post('/templates/{key}/import', [TemplateController::class, 'import']);

    Route::get('/reports', [ReportController::class, 'index']);
    Route::get('/reports/{key}', [ReportController::class, 'show']);
    Route::get('/reports/{key}/export', [ReportController::class, 'export']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::get('/audit-logs', [AuditVisibilityController::class, 'auditLogs']);
    Route::get('/activity-feed', [AuditVisibilityController::class, 'activityFeed']);

    Route::prefix('approval-workflows')->group(function () {
        Route::get('/', [ApprovalWorkflowController::class, 'index']);
        Route::post('/', [ApprovalWorkflowController::class, 'store']);
        Route::get('/{approvalWorkflow}', [ApprovalWorkflowController::class, 'show']);
        Route::patch('/{approvalWorkflow}', [ApprovalWorkflowController::class, 'update']);
    });

    Route::prefix('approvals')->group(function () {
        Route::get('/', [ApprovalRequestController::class, 'index']);
        Route::get('/{approvalRequest}', [ApprovalRequestController::class, 'show']);
        Route::post('/{approvalRequest}/actions', [ApprovalRequestController::class, 'act']);
    });

    Route::prefix('setup')->group(function () {
        Route::get('/checklist', [SetupChecklistController::class, 'show']);
        Route::get('/lookups', [SetupLookupController::class, 'index']);
        Route::get('/departments', [SetupLookupController::class, 'departments']);
        Route::get('/units', [SetupLookupController::class, 'units']);
        Route::get('/designations', [SetupLookupController::class, 'designations']);
        Route::get('/grade-levels', [SetupLookupController::class, 'gradeLevels']);
        Route::get('/employment-types', [SetupLookupController::class, 'employmentTypes']);
        Route::get('/locations', [SetupLookupController::class, 'locations']);
    });

    Route::prefix('documents')->group(function () {
        Route::get('/types', [DocumentTypeController::class, 'index']);
        Route::post('/types', [DocumentTypeController::class, 'store']);
        Route::get('/types/{documentType}', [DocumentTypeController::class, 'show']);
        Route::patch('/types/{documentType}', [DocumentTypeController::class, 'update']);

        Route::get('/requirements', [DocumentRequirementController::class, 'index']);
        Route::post('/requirements', [DocumentRequirementController::class, 'store']);
        Route::get('/requirements/{documentRequirement}', [DocumentRequirementController::class, 'show']);

        Route::get('/compliance', [EmployeeDocumentController::class, 'compliance']);
        Route::get('/', [EmployeeDocumentController::class, 'index']);
        Route::post('/', [EmployeeDocumentController::class, 'store']);
        Route::get('/{employeeDocument}', [EmployeeDocumentController::class, 'show']);
        Route::patch('/{employeeDocument}/review', [EmployeeDocumentController::class, 'review']);
    });

    Route::prefix('leave')->group(function () {
        Route::get('/types', [LeaveTypeController::class, 'index']);
        Route::post('/types', [LeaveTypeController::class, 'store']);
        Route::get('/periods', [LeavePeriodController::class, 'index']);
        Route::post('/periods', [LeavePeriodController::class, 'store']);
        Route::get('/holidays', [LeaveHolidayController::class, 'index']);
        Route::post('/holidays', [LeaveHolidayController::class, 'store']);
        Route::get('/entitlements', [LeaveEntitlementController::class, 'index']);
        Route::post('/entitlements', [LeaveEntitlementController::class, 'store']);
        Route::get('/requests', [LeaveRequestController::class, 'index']);
        Route::post('/requests', [LeaveRequestController::class, 'store']);
        Route::get('/requests/{leaveRequest}', [LeaveRequestController::class, 'show']);
        Route::patch('/requests/{leaveRequest}/cancel', [LeaveRequestController::class, 'cancel']);
    });

    Route::prefix('attendance')->group(function () {
        Route::get('/settings', [AttendanceSettingController::class, 'show']);
        Route::patch('/settings', [AttendanceSettingController::class, 'update']);
        Route::get('/shifts', [WorkShiftController::class, 'index']);
        Route::post('/shifts', [WorkShiftController::class, 'store']);
        Route::get('/records', [AttendanceRecordController::class, 'index']);
        Route::post('/records', [AttendanceRecordController::class, 'store']);
        Route::get('/records/{attendanceRecord}', [AttendanceRecordController::class, 'show']);
        Route::get('/corrections', [AttendanceCorrectionRequestController::class, 'index']);
        Route::post('/corrections', [AttendanceCorrectionRequestController::class, 'store']);
        Route::get('/corrections/{attendanceCorrection}', [AttendanceCorrectionRequestController::class, 'show']);
    });

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/export', [EmployeeController::class, 'export']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
    Route::get('/employees/{employee}/profile-overview', [EmployeeProfileOverviewController::class, 'show']);
    Route::get('/employees/{employee}/profile-activities', [EmployeeProfileActivityController::class, 'index']);
    Route::get('/employees/{employee}/custom-field-values', [EmployeeCustomFieldValueController::class, 'index']);
    Route::put('/employees/{employee}/custom-field-values', [EmployeeCustomFieldValueController::class, 'upsert']);
    Route::get('/employees/{employee}/status-history', [EmployeeLifecycleController::class, 'statusHistory']);
    Route::post('/employees/{employee}/status-history', [EmployeeLifecycleController::class, 'storeStatusHistory']);
    Route::get('/employees/{employee}/reporting-history', [EmployeeLifecycleController::class, 'reportingHistory']);
    Route::post('/employees/{employee}/reporting-history', [EmployeeLifecycleController::class, 'storeReportingHistory']);
    Route::patch('/employees/{employee}/approve-onboarding', [EmployeeController::class, 'approveOnboarding']);
    Route::patch('/me/employee-profile', [EmployeeController::class, 'updateMyProfile']);

    Route::prefix('employee-profile')->group(function () {
        Route::get('/overview', [EmployeeProfileOverviewController::class, 'me']);
        Route::get('/activities', [EmployeeProfileActivityController::class, 'myIndex']);

        Route::get('/custom-fields', [EmployeeCustomFieldController::class, 'index']);
        Route::post('/custom-fields', [EmployeeCustomFieldController::class, 'store']);
        Route::get('/custom-fields/{customField}', [EmployeeCustomFieldController::class, 'show']);
        Route::patch('/custom-fields/{customField}', [EmployeeCustomFieldController::class, 'update']);

        Route::get('/custom-field-values', [EmployeeCustomFieldValueController::class, 'myIndex']);
        Route::put('/custom-field-values', [EmployeeCustomFieldValueController::class, 'myUpsert']);

        Route::get('/emergency-contacts', [EmployeeEmergencyContactController::class, 'index']);
        Route::post('/emergency-contacts', [EmployeeEmergencyContactController::class, 'store']);
        Route::patch('/emergency-contacts/{emergencyContact}', [EmployeeEmergencyContactController::class, 'update']);
        Route::delete('/emergency-contacts/{emergencyContact}', [EmployeeEmergencyContactController::class, 'destroy']);

        Route::get('/dependents', [EmployeeDependentController::class, 'index']);
        Route::post('/dependents', [EmployeeDependentController::class, 'store']);
        Route::patch('/dependents/{dependent}', [EmployeeDependentController::class, 'update']);
        Route::delete('/dependents/{dependent}', [EmployeeDependentController::class, 'destroy']);
    });
});

Route::post('/employee-invitations/{token}/accept', [EmployeeController::class, 'acceptInvitation']);
