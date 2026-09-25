<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Approvals\ActOnApprovalRequestRequest;
use App\Http\Resources\ApprovalRequestResource;
use App\Models\ApprovalRequest;
use App\Services\ApprovalRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApprovalRequestController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('approvals.view'), 403);

        $approvals = ApprovalRequest::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with(['workflow.steps', 'requester', 'subjectEmployee', 'decisions.actor', 'approvable'])
            ->when($request->string('module')->toString(), fn (Builder $query, string $module) => $query->where('module', $module))
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->integer('subject_employee_id'), fn (Builder $query, int $employeeId) => $query->where('subject_employee_id', $employeeId))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return ApprovalRequestResource::collection($approvals);
    }

    public function show(Request $request, ApprovalRequest $approvalRequest): ApprovalRequestResource
    {
        abort_unless($request->user()->can('approvals.view'), 403);
        abort_unless($approvalRequest->organization_id === $request->user()->organization_id, 404);

        return new ApprovalRequestResource($approvalRequest->load(['workflow.steps', 'requester', 'subjectEmployee', 'decisions.actor', 'approvable']));
    }

    public function act(
        ActOnApprovalRequestRequest $request,
        ApprovalRequest $approvalRequest,
        ApprovalRequestService $approvals
    ): JsonResponse {
        $approval = $approvals->act(
            $request->user(),
            $approvalRequest,
            $request->string('action')->toString(),
            $request->input('note')
        );

        return response()->json([
            'approval_request' => new ApprovalRequestResource($approval),
        ]);
    }
}
