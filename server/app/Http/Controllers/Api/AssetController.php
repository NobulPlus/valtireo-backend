<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Assets\AssetIncidentNoteRequest;
use App\Http\Requests\Assets\AssignAssetRequest;
use App\Http\Requests\Assets\ReturnAssetRequest;
use App\Http\Requests\Assets\StoreAssetRequest;
use App\Http\Requests\Assets\UpdateAssetRequest;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Services\AssetReportingService;
use App\Services\AssetService;
use App\Services\OperationAutomationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class AssetController extends Controller
{
    public function reporting(Request $request, AssetReportingService $reporting): JsonResponse
    {
        abort_unless($request->user()->can('assets.view'), 403);

        return response()->json(['data' => $reporting->reporting($request->user())]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Asset::query()
            ->with(['assignedTo', 'category', 'location'])
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->integer('asset_category_id'), fn (Builder $query, int $categoryId) => $query->where('asset_category_id', $categoryId))
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->where(function (Builder $query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")->orWhere('asset_tag', 'like', "%{$search}%");
            }));

        if (! $request->user()->can('assets.view')) {
            $query->where('assigned_to_employee_id', $request->user()->employee?->id);
        }

        return AssetResource::collection($query->orderBy('name')->paginate(min(max($request->integer('per_page', 15), 1), 100)));
    }

    public function store(StoreAssetRequest $request, AssetService $assets): AssetResource
    {
        return new AssetResource($assets->create($request->user(), $request->validated()));
    }

    public function show(Request $request, Asset $asset): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);
        abort_unless(
            $request->user()->can('assets.view') || $asset->assigned_to_employee_id === $request->user()->employee?->id,
            403
        );

        return new AssetResource($asset->load([
            'assignedTo',
            'category',
            'location',
            'assignmentHistories.employee',
            'assignmentHistories.assignedBy',
            'assignmentHistories.returnedBy',
            'tickets' => fn ($query) => $query->latest('id')->limit(20),
            'incidents' => fn ($query) => $query->with('reportedBy')->limit(20),
        ]));
    }

    public function update(UpdateAssetRequest $request, Asset $asset, AssetService $assets): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        return new AssetResource($assets->update($request->user(), $asset, $request->validated()));
    }

    public function assign(AssignAssetRequest $request, Asset $asset, AssetService $assets, OperationAutomationService $automations): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        $asset = $assets->assign($request->user(), $asset, $request->validated());
        $automations->dispatch('asset.assigned', $asset, [
            'event_id' => "assigned:{$asset->assigned_at?->timestamp}",
            'actor_user_id' => $request->user()->id,
            'subject_employee_id' => $asset->assigned_to_employee_id,
        ]);

        return new AssetResource($asset);
    }

    public function returnAsset(ReturnAssetRequest $request, Asset $asset, AssetService $assets, OperationAutomationService $automations): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        $previousEmployeeId = $asset->assigned_to_employee_id;
        $asset = $assets->returnFromEmployee($request->user(), $asset, $request->validated());
        $automations->dispatch('asset.returned', $asset, [
            'event_id' => "returned:{$asset->updated_at?->timestamp}",
            'actor_user_id' => $request->user()->id,
            'subject_employee_id' => $previousEmployeeId,
        ]);

        return new AssetResource($asset);
    }

    public function reportFault(AssetIncidentNoteRequest $request, Asset $asset, AssetService $assets): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        if ($asset->status === 'maintenance') {
            throw ValidationException::withMessages(['status' => ['This asset is already in maintenance.']]);
        }

        return new AssetResource($assets->reportFault($request->user(), $asset, $request->string('note')->toString()));
    }

    public function returnToService(AssetIncidentNoteRequest $request, Asset $asset, AssetService $assets): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        if ($asset->status !== 'maintenance') {
            throw ValidationException::withMessages(['status' => ['This asset is not currently in maintenance.']]);
        }

        return new AssetResource($assets->returnToService($request->user(), $asset, $request->string('note')->toString()));
    }
}
