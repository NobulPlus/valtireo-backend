<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\BulkGrantLeaveEntitlementRequest;
use App\Http\Requests\Leave\StoreLeaveEntitlementRequest;
use App\Http\Resources\LeaveEntitlementResource;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class LeaveEntitlementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->can('leave_requests.create'), 403);

        $employeeId = $request->integer('employee_id') ?: $request->user()->employee?->id;

        $query = LeaveEntitlement::query()
            ->with(['employee', 'leaveType', 'leavePeriod'])
            ->where('organization_id', $request->user()->organization_id);

        if (! $request->user()->can('leave_requests.view')) {
            $query->where('employee_id', $request->user()->employee?->id);
        } elseif ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        return LeaveEntitlementResource::collection($query->orderByDesc('id')->get());
    }

    public function store(StoreLeaveEntitlementRequest $request): JsonResponse
    {
        $entitlement = LeaveEntitlement::query()->updateOrCreate(
            [
                'employee_id' => $request->integer('employee_id'),
                'leave_type_id' => $request->integer('leave_type_id'),
                'leave_period_id' => $request->integer('leave_period_id'),
            ],
            [
                'organization_id' => $request->user()->organization_id,
                'days_allocated' => $request->input('days_allocated'),
                'notes' => $request->input('notes'),
            ]
        );

        return response()->json([
            'leave_entitlement' => new LeaveEntitlementResource($entitlement->load(['employee', 'leaveType', 'leavePeriod'])),
        ], 201);
    }

    public function destroy(Request $request, LeaveEntitlement $leaveEntitlement): JsonResponse
    {
        abort_unless($request->user()->can('leave_requests.approve'), 403);
        abort_unless($leaveEntitlement->organization_id === $request->user()->organization_id, 404);

        if ((float) $leaveEntitlement->days_used > 0 || (float) $leaveEntitlement->days_pending > 0) {
            throw ValidationException::withMessages([
                'leave_entitlement' => ['This entitlement has approved or pending leave against it and cannot be deleted. Adjust the employee\'s leave requests first.'],
            ]);
        }

        $leaveEntitlement->delete();

        return response()->json(['message' => 'Leave entitlement deleted.']);
    }

    public function bulkStore(BulkGrantLeaveEntitlementRequest $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        $leaveType = LeaveType::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($request->integer('leave_type_id'));

        $days = $request->input('days_allocated') ?? $leaveType->default_days_per_year;

        abort_if($days === null, 422, 'Enter a number of days, or set a default for this leave type first.');

        $leavePeriodId = $request->integer('leave_period_id');

        $employeeIds = Employee::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'active')
            ->pluck('id');

        $alreadyGranted = LeaveEntitlement::query()
            ->where('leave_type_id', $leaveType->id)
            ->where('leave_period_id', $leavePeriodId)
            ->whereIn('employee_id', $employeeIds)
            ->pluck('employee_id');

        $toGrant = $employeeIds->diff($alreadyGranted);

        foreach ($toGrant as $employeeId) {
            LeaveEntitlement::query()->create([
                'organization_id' => $organizationId,
                'employee_id' => $employeeId,
                'leave_type_id' => $leaveType->id,
                'leave_period_id' => $leavePeriodId,
                'days_allocated' => $days,
                'notes' => $request->input('notes'),
            ]);
        }

        return response()->json([
            'granted' => $toGrant->count(),
            'skipped' => $alreadyGranted->count(),
            'days_allocated' => $days,
            'total_active_employees' => $employeeIds->count(),
        ], 201);
    }
}
