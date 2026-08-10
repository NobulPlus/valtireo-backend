<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\StoreLeaveEntitlementRequest;
use App\Http\Resources\LeaveEntitlementResource;
use App\Models\LeaveEntitlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
}
