<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\PlatformOrganizationController;
use App\Http\Controllers\Api\SetupLookupController;
use App\Http\Controllers\Api\WorkspaceController;
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

    Route::prefix('setup')->group(function () {
        Route::get('/lookups', [SetupLookupController::class, 'index']);
        Route::get('/departments', [SetupLookupController::class, 'departments']);
        Route::get('/units', [SetupLookupController::class, 'units']);
        Route::get('/designations', [SetupLookupController::class, 'designations']);
        Route::get('/grade-levels', [SetupLookupController::class, 'gradeLevels']);
        Route::get('/employment-types', [SetupLookupController::class, 'employmentTypes']);
        Route::get('/locations', [SetupLookupController::class, 'locations']);
    });

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/export', [EmployeeController::class, 'export']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
    Route::patch('/employees/{employee}/approve-onboarding', [EmployeeController::class, 'approveOnboarding']);
    Route::patch('/me/employee-profile', [EmployeeController::class, 'updateMyProfile']);
});

Route::post('/employee-invitations/{token}/accept', [EmployeeController::class, 'acceptInvitation']);
