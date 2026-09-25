<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Assets\StoreAssetCategoryRequest;
use App\Http\Requests\Assets\UpdateAssetCategoryRequest;
use App\Http\Resources\AssetCategoryResource;
use App\Models\AssetCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AssetCategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('assets.view') || $request->user()->employee !== null, 403);

        $categories = AssetCategory::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when(
                ! $request->user()->can('assets.view'),
                fn ($query) => $query->where('is_active', true)
            )
            ->orderBy('name')
            ->get();

        return AssetCategoryResource::collection($categories);
    }

    public function store(StoreAssetCategoryRequest $request): AssetCategoryResource
    {
        $category = AssetCategory::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return new AssetCategoryResource($category);
    }

    public function update(UpdateAssetCategoryRequest $request, AssetCategory $assetCategory): AssetCategoryResource
    {
        abort_unless($assetCategory->organization_id === $request->user()->organization_id, 404);

        $assetCategory->update($request->validated());

        return new AssetCategoryResource($assetCategory->refresh());
    }
}
