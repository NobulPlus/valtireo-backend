<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitWorkItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrbitMyWorkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $filter = $request->string('filter')->toString() ?: 'assigned';

        $base = fn () => OrbitWorkItem::query()
            ->with(['project:id,name,workspace_id', 'project.workspace:id,name', 'status']);

        $items = match ($filter) {
            'mentioned' => $base()->whereNull('archived_at')->whereHas(
                'comments',
                fn ($q) => $q->whereNull('deleted_at')->whereJsonContains('mentions', $user->id)
            )->get(),
            'watched' => $base()->whereNull('archived_at')->whereHas('watchers', fn ($q) => $q->where('users.id', $user->id))->get(),
            'overdue' => $base()->whereNull('archived_at')->where('assignee_id', $user->id)
                ->whereNotNull('due_at')->where('due_at', '<', now()->toDateString())
                ->whereHas('status', fn ($q) => $q->where('category', '!=', 'done'))->get(),
            'due_soon' => $base()->whereNull('archived_at')->where('assignee_id', $user->id)
                ->whereNotNull('due_at')
                ->whereBetween('due_at', [now()->toDateString(), now()->addDays(2)->toDateString()])
                ->whereHas('status', fn ($q) => $q->where('category', '!=', 'done'))->get(),
            default => $base()->whereNull('archived_at')->where('assignee_id', $user->id)->get(),
        };

        $data = $items->map(fn (OrbitWorkItem $item) => [
            'id' => $item->id,
            'key' => $item->key,
            'title' => $item->title,
            'type' => $item->type,
            'priority' => $item->priority,
            'status' => $item->status,
            'due_at' => $item->due_at,
            'project' => $item->project,
            'reason' => $filter,
        ]);

        return response()->json(['data' => $data->values()]);
    }
}
