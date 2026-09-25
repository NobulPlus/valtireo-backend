<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\StoreAttendanceRecordRequest;
use App\Http\Resources\AttendanceRecordResource;
use App\Models\AttendanceRecord;
use App\Services\AttendanceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AttendanceRecordController extends Controller
{
    public function index(Request $request, AttendanceService $attendance): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('attendance.view') || $request->user()->can('attendance.create'), 403);

        $query = AttendanceRecord::query()
            ->with($attendance->recordRelations())
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('source')->toString(), fn (Builder $query, string $source) => $query->where('source', $source))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('attendance_date', '<=', $date->toDateString()));

        if (! $request->user()->can('attendance.view')) {
            $query->where('employee_id', $request->user()->employee?->id);
        } elseif ($request->integer('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        return AttendanceRecordResource::collection($query->latest('attendance_date')->paginate(min(max($request->integer('per_page', 15), 1), 100)));
    }

    public function store(StoreAttendanceRecordRequest $request, AttendanceService $attendance): JsonResponse
    {
        $record = $attendance->createRecord($request->user(), $request->validated());

        return response()->json([
            'attendance_record' => new AttendanceRecordResource($record),
        ], 201);
    }

    public function show(Request $request, AttendanceRecord $attendanceRecord, AttendanceService $attendance): AttendanceRecordResource
    {
        abort_unless($attendanceRecord->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('attendance.view') || $request->user()->employee?->id === $attendanceRecord->employee_id, 403);

        return new AttendanceRecordResource($attendanceRecord->load($attendance->recordRelations()));
    }
}
