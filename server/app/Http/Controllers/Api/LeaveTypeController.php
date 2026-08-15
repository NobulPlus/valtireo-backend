<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\StoreLeaveTypeRequest;
use App\Http\Resources\LeaveTypeResource;
use App\Models\LeaveType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class LeaveTypeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('leave_requests.view') || $request->user()->can('leave_requests.create'), 403);

        return LeaveTypeResource::collection(
            LeaveType::query()
                ->where('organization_id', $request->user()->organization_id)
                ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
                ->orderBy('name')
                ->get()
        );
    }

    public function store(StoreLeaveTypeRequest $request): JsonResponse
    {
        $type = LeaveType::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
            'code' => Str::upper($request->string('code')->toString()),
        ]);

        return response()->json([
            'leave_type' => new LeaveTypeResource($type),
        ], 201);
    }
}
