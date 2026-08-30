<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Assets\StoreAssetRequest;
use App\Http\Requests\Assets\UpdateAssetRequest;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Services\AssetService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AssetController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Asset::query()
            ->with('assignedTo')
            ->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->string('category')->toString(), fn (Builder $query, string $category) => $query->where('category', $category))
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

        return new AssetResource($asset->load(['assignedTo', 'tickets' => fn ($query) => $query->latest('id')->limit(20)]));
    }

    public function update(UpdateAssetRequest $request, Asset $asset, AssetService $assets): AssetResource
    {
        abort_unless($asset->organization_id === $request->user()->organization_id, 404);

        return new AssetResource($assets->update($asset, $request->validated()));
    }
}
