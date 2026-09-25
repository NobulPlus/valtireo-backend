<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\StoreLeavePeriodRequest;
use App\Http\Requests\Leave\UpdateLeavePeriodRequest;
use App\Http\Resources\LeavePeriodResource;
use App\Models\LeavePeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class LeavePeriodController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->can('leave_requests.create'), 403);

        return LeavePeriodResource::collection(
            LeavePeriod::query()
                ->where('organization_id', $request->user()->organization_id)
                ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
                ->orderByDesc('starts_on')
                ->get()
        );
    }

    public function store(StoreLeavePeriodRequest $request): JsonResponse
    {
        $period = LeavePeriod::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return response()->json([
            'leave_period' => new LeavePeriodResource($period),
        ], 201);
    }

    public function update(UpdateLeavePeriodRequest $request, LeavePeriod $leavePeriod): JsonResponse
    {
        abort_unless($leavePeriod->organization_id === $request->user()->organization_id, 404);

        $data = $request->validated();
        $startsOn = $data['starts_on'] ?? $leavePeriod->starts_on->toDateString();
        $endsOn = $data['ends_on'] ?? $leavePeriod->ends_on->toDateString();

        if ($endsOn < $startsOn) {
            throw ValidationException::withMessages([
                'ends_on' => ['The end date must be on or after the start date.'],
            ]);
        }

        $leavePeriod->update($data);

        return response()->json([
            'leave_period' => new LeavePeriodResource($leavePeriod->refresh()),
        ]);
    }
}
