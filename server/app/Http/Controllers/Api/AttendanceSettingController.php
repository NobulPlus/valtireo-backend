<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\UpdateAttendanceSettingsRequest;
use App\Http\Resources\AttendanceSettingResource;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceSettingController extends Controller
{
    public function show(Request $request, AttendanceService $attendance): JsonResponse
    {
        abort_unless($request->user()->can('attendance.view') || $request->user()->can('attendance.create'), 403);

        return response()->json([
            'attendance_settings' => new AttendanceSettingResource($attendance->settingsFor($request->user())),
        ]);
    }

    public function update(UpdateAttendanceSettingsRequest $request, AttendanceService $attendance): JsonResponse
    {
        return response()->json([
            'attendance_settings' => new AttendanceSettingResource($attendance->updateSettings($request->user(), $request->validated())),
        ]);
    }
}
