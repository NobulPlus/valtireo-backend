<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SystemErrorLogResource;
use App\Models\SystemErrorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SystemErrorLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->is_platform_admin, 403);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'level' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', 'in:open,resolved'],
            'organization_id' => ['nullable', 'integer', 'exists:organizations,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = SystemErrorLog::query()
            ->with(['organization:id,name,code', 'user:id,name,email', 'resolvedBy:id,name,email'])
            ->when($validated['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query
                        ->where('message', 'like', "%{$search}%")
                        ->orWhere('exception_class', 'like', "%{$search}%")
                        ->orWhere('url', 'like', "%{$search}%")
                        ->orWhere('route', 'like', "%{$search}%")
                        ->orWhere('fingerprint', 'like', "%{$search}%");
                });
            })
            ->when($validated['level'] ?? null, fn ($query, string $level) => $query->where('level', $level))
            ->when(($validated['status'] ?? null) === 'open', fn ($query) => $query->whereNull('resolved_at'))
            ->when(($validated['status'] ?? null) === 'resolved', fn ($query) => $query->whereNotNull('resolved_at'))
            ->when($validated['organization_id'] ?? null, fn ($query, int $organizationId) => $query->where('organization_id', $organizationId))
            ->when($validated['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($validated['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '<=', $date))
            ->latest()
            ->paginate($validated['per_page'] ?? 15);

        return SystemErrorLogResource::collection($logs);
    }

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()->is_platform_admin, 403);

        $base = SystemErrorLog::query();

        return response()->json([
            'total' => (clone $base)->count(),
            'open' => (clone $base)->whereNull('resolved_at')->count(),
            'resolved' => (clone $base)->whereNotNull('resolved_at')->count(),
            'today' => (clone $base)->whereDate('created_at', today())->count(),
            'by_level' => (clone $base)
                ->selectRaw('level, count(*) as total')
                ->groupBy('level')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($row) => ['level' => $row->level, 'total' => (int) $row->total])
                ->values(),
        ]);
    }

    public function resolve(Request $request, SystemErrorLog $systemErrorLog): JsonResponse
    {
        abort_unless($request->user()->is_platform_admin, 403);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $systemErrorLog->update([
            'resolved_at' => now(),
            'resolved_by_id' => $request->user()->id,
            'resolution_note' => $validated['note'] ?? null,
        ]);

        return response()->json([
            'message' => 'Error marked as resolved.',
            'error' => new SystemErrorLogResource($systemErrorLog->refresh()->load(['organization:id,name,code', 'user:id,name,email', 'resolvedBy:id,name,email'])),
        ]);
    }
}
