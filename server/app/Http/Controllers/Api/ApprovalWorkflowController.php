<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Approvals\StoreApprovalWorkflowRequest;
use App\Http\Requests\Approvals\UpdateApprovalWorkflowRequest;
use App\Http\Resources\ApprovalWorkflowResource;
use App\Models\ApprovalWorkflow;
use App\Services\ApprovalWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApprovalWorkflowController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('approval_workflows.view'), 403);

        $workflows = ApprovalWorkflow::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with('steps.approverRole')
            ->when($request->string('module')->toString(), fn (Builder $query, string $module) => $query->where('module', $module))
            ->when($request->string('action')->toString(), fn (Builder $query, string $action) => $query->where('action', $action))
            ->when($request->has('is_active'), fn (Builder $query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('module')
            ->orderBy('action')
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return ApprovalWorkflowResource::collection($workflows);
    }

    public function store(StoreApprovalWorkflowRequest $request, ApprovalWorkflowService $workflows): JsonResponse
    {
        $workflow = $workflows->create($request->user(), $request->validated());

        return response()->json([
            'approval_workflow' => new ApprovalWorkflowResource($workflow),
        ], 201);
    }

    public function show(Request $request, ApprovalWorkflow $approvalWorkflow): ApprovalWorkflowResource
    {
        abort_unless($request->user()->can('approval_workflows.view'), 403);
        abort_unless($approvalWorkflow->organization_id === $request->user()->organization_id, 404);

        return new ApprovalWorkflowResource($approvalWorkflow->load('steps.approverRole'));
    }

    public function update(
        UpdateApprovalWorkflowRequest $request,
        ApprovalWorkflow $approvalWorkflow,
        ApprovalWorkflowService $workflows
    ): JsonResponse {
        abort_unless($approvalWorkflow->organization_id === $request->user()->organization_id, 404);

        $workflow = $workflows->update($approvalWorkflow, $request->validated());

        return response()->json([
            'approval_workflow' => new ApprovalWorkflowResource($workflow),
        ]);
    }
}
