<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\StoreWorkShiftRequest;
use App\Http\Requests\Attendance\UpdateWorkShiftRequest;
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

    public function update(UpdateWorkShiftRequest $request, WorkShift $workShift): JsonResponse
    {
        abort_unless($workShift->organization_id === $request->user()->organization_id, 404);

        $data = $request->validated();

        if ($request->boolean('is_default')) {
            WorkShift::query()
                ->where('organization_id', $request->user()->organization_id)
                ->where('id', '!=', $workShift->id)
                ->update(['is_default' => false]);
        }

        if (array_key_exists('code', $data)) {
            $data['code'] = Str::upper($data['code']);
        }

        $workShift->update($data);

        return response()->json([
            'work_shift' => new WorkShiftResource($workShift->refresh()),
        ]);
    }
}
