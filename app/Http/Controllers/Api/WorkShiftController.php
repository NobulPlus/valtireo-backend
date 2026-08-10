<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\StoreWorkShiftRequest;
use App\Http\Resources\WorkShiftResource;
use App\Models\WorkShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class WorkShiftController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('attendance.view') || $request->user()->can('attendance.create'), 403);

        return WorkShiftResource::collection(
            WorkShift::query()
                ->where('organization_id', $request->user()->organization_id)
                ->when($request->has('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
                ->orderByDesc('is_default')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(StoreWorkShiftRequest $request): JsonResponse
    {
        if ($request->boolean('is_default')) {
            WorkShift::query()->where('organization_id', $request->user()->organization_id)->update(['is_default' => false]);
        }

        $shift = WorkShift::query()->create([
            'organization_id' => $request->user()->organization_id,
            ...$request->validated(),
            'code' => Str::upper($request->string('code')->toString()),
        ]);

        return response()->json([
            'work_shift' => new WorkShiftResource($shift),
        ], 201);
    }
}
