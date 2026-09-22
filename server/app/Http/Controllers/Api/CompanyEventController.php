<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Calendar\StoreCompanyEventRequest;
use App\Http\Requests\Calendar\UpdateCompanyEventRequest;
use App\Http\Resources\CompanyEventResource;
use App\Models\CompanyEvent;
use App\Services\CompanyEventService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CompanyEventController extends Controller
{
    public function index(Request $request, CompanyEventService $events): AnonymousResourceCollection
    {
        $query = $events->visibleTo($request->user())
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('ends_on', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('starts_on', '<=', $date->toDateString()))
            ->when($request->string('search')->toString(), fn (Builder $query, string $search) => $query->where(function (Builder $query) use ($search): void {
                $query->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            }))
            ->orderBy('starts_on')
            ->orderBy('title');

        return CompanyEventResource::collection($query->paginate(min(max($request->integer('per_page', 50), 1), 100)));
    }

    public function store(StoreCompanyEventRequest $request, CompanyEventService $events): JsonResponse
    {
        $event = $events->create($request->user(), $request->validated());

        return response()->json([
            'company_event' => new CompanyEventResource($event),
        ], 201);
    }

    public function update(UpdateCompanyEventRequest $request, CompanyEvent $companyEvent, CompanyEventService $events): JsonResponse
    {
        $event = $events->update($request->user(), $companyEvent, $request->validated());

        return response()->json([
            'company_event' => new CompanyEventResource($event),
        ]);
    }

    public function destroy(Request $request, CompanyEvent $companyEvent, CompanyEventService $events): JsonResponse
    {
        $event = $events->deactivate($request->user(), $companyEvent);

        return response()->json([
            'company_event' => new CompanyEventResource($event),
        ]);
    }
}
