<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\CancelLeaveRequestRequest;
use App\Http\Requests\Leave\StoreLeaveRequestRequest;
use App\Http\Resources\LeaveRequestResource;
use App\Models\LeaveRequest;
use App\Services\LeaveRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LeaveRequestController extends Controller
{
    public function index(Request $request, LeaveRequestService $leave): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->can('leave_requests.create'), 403);

        $query = LeaveRequest::query()
            ->with($leave->relations())
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->integer('leave_type_id'), fn (Builder $query, int $id) => $query->where('leave_type_id', $id))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('starts_on', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('ends_on', '<=', $date->toDateString()));

        if (! $request->user()->can('leave_requests.view')) {
            $query->where('employee_id', $request->user()->employee?->id);
        } elseif ($request->integer('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        return LeaveRequestResource::collection($query->latest('id')->paginate(min(max($request->integer('per_page', 15), 1), 100)));
    }

    public function store(StoreLeaveRequestRequest $request, LeaveRequestService $leave): JsonResponse
    {
        $leaveRequest = $leave->submit($request->user(), $request->validated());

        return response()->json([
            'leave_request' => new LeaveRequestResource($leaveRequest),
        ], 201);
    }

    public function show(Request $request, LeaveRequest $leaveRequest, LeaveRequestService $leave): LeaveRequestResource
    {
        abort_unless($leaveRequest->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->employee?->id === $leaveRequest->employee_id, 403);

        return new LeaveRequestResource($leaveRequest->load($leave->relations()));
    }

    public function cancel(
        CancelLeaveRequestRequest $request,
        LeaveRequest $leaveRequest,
        LeaveRequestService $leave
    ): JsonResponse {
        $leaveRequest = $leave->cancel($request->user(), $leaveRequest, $request->input('note'));

        return response()->json([
            'leave_request' => new LeaveRequestResource($leaveRequest),
        ]);
    }
}
