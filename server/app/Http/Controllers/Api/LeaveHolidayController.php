<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\StoreLeaveHolidayRequest;
use App\Http\Requests\Leave\UpdateLeaveHolidayRequest;
use App\Http\Resources\LeaveHolidayResource;
use App\Models\LeaveHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LeaveHolidayController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->can('leave_requests.create'), 403);

        return LeaveHolidayResource::collection(
            LeaveHoliday::query()
                ->with('location')
                ->where('organization_id', $request->user()->organization_id)
                ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
                ->orderBy('date')
                ->get()
        );
    }

    public function store(StoreLeaveHolidayRequest $request): JsonResponse
    {
        $holiday = LeaveHoliday::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
        ]);

        return response()->json([
            'leave_holiday' => new LeaveHolidayResource($holiday->load('location')),
        ], 201);
    }

    public function update(UpdateLeaveHolidayRequest $request, LeaveHoliday $leaveHoliday): JsonResponse
    {
        abort_unless($leaveHoliday->organization_id === $request->user()->organization_id, 404);

        $leaveHoliday->update($request->validated());

        return response()->json([
            'leave_holiday' => new LeaveHolidayResource($leaveHoliday->refresh()->load('location')),
        ]);
    }
}
