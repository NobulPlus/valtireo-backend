<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\StoreAttendanceCorrectionRequest;
use App\Http\Resources\AttendanceCorrectionRequestResource;
use App\Models\AttendanceCorrectionRequest;
use App\Services\AttendanceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AttendanceCorrectionRequestController extends Controller
{
    public function index(Request $request, AttendanceService $attendance): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('attendance.view') || $request->user()->can('attendance.create'), 403);

        $query = AttendanceCorrectionRequest::query()
            ->with($attendance->correctionRelations())
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status));

        if (! $request->user()->can('attendance.view')) {
            $query->where('employee_id', $request->user()->employee?->id);
        } elseif ($request->integer('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        return AttendanceCorrectionRequestResource::collection($query->latest('id')->paginate(min(max($request->integer('per_page', 15), 1), 100)));
    }

    public function store(StoreAttendanceCorrectionRequest $request, AttendanceService $attendance): JsonResponse
    {
        $correction = $attendance->requestCorrection($request->user(), $request->validated());

        return response()->json([
            'attendance_correction' => new AttendanceCorrectionRequestResource($correction),
        ], 201);
    }

    public function show(
        Request $request,
        AttendanceCorrectionRequest $attendanceCorrection,
        AttendanceService $attendance
    ): AttendanceCorrectionRequestResource {
        abort_unless($attendanceCorrection->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('attendance.view') || $request->user()->employee?->id === $attendanceCorrection->employee_id, 403);

        return new AttendanceCorrectionRequestResource($attendanceCorrection->load($attendance->correctionRelations()));
    }
}
