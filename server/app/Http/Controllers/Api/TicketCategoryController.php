<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceDesk\StoreTicketCategoryRequest;
use App\Http\Requests\ServiceDesk\UpdateTicketCategoryRequest;
use App\Http\Resources\TicketCategoryResource;
use App\Models\TicketCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TicketCategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('service_desk.view') || $request->user()->employee !== null, 403);

        $categories = TicketCategory::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when(
                ! $request->user()->can('service_desk.view'),
                fn ($query) => $query->where('is_active', true)
            )
            ->when($request->string('search')->toString(), function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return TicketCategoryResource::collection($categories);
    }

    public function store(StoreTicketCategoryRequest $request): TicketCategoryResource
    {
        $category = TicketCategory::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return new TicketCategoryResource($category);
    }

    public function show(Request $request, TicketCategory $ticketCategory): TicketCategoryResource
    {
        abort_unless($request->user()->can('service_desk.view') || $request->user()->employee !== null, 403);
        abort_unless($ticketCategory->organization_id === $request->user()->organization_id, 404);

        return new TicketCategoryResource($ticketCategory);
    }

    public function update(UpdateTicketCategoryRequest $request, TicketCategory $ticketCategory): TicketCategoryResource
    {
        abort_unless($ticketCategory->organization_id === $request->user()->organization_id, 404);

        $ticketCategory->update($request->validated());

        return new TicketCategoryResource($ticketCategory->refresh());
    }
}
