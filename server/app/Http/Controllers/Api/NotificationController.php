<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = $request->user()
            ->notifications()
            ->when($request->string('status')->toString() === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($request->string('status')->toString() === 'read', fn ($query) => $query->whereNotNull('read_at'))
            ->when($request->string('category')->toString(), fn ($query, string $category) => $query->where('data->category', $category))
            ->when($request->string('event')->toString(), fn ($query, string $event) => $query->where('data->event', $event))
            ->latest();

        $notifications = $query->paginate(min(max($request->integer('per_page', 15), 1), 100));

        return response()->json([
            'data' => $notifications->getCollection()->map(fn (DatabaseNotification $notification) => $this->payload($notification))->values(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'from' => $notifications->firstItem(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'to' => $notifications->lastItem(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        $notification->markAsRead();

        return response()->json([
            'notification' => $this->payload($notification->refresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'unread_count' => 0,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'category' => $notification->data['category'] ?? null,
            'event' => $notification->data['event'] ?? null,
            'severity' => $notification->data['severity'] ?? 'info',
            'title' => $notification->data['title'] ?? null,
            'message' => $notification->data['message'] ?? null,
            'action_label' => $notification->data['action_label'] ?? null,
            'action_url' => $notification->data['action_url'] ?? null,
            'entity_type' => $notification->data['entity_type'] ?? null,
            'entity_id' => $notification->data['entity_id'] ?? null,
            'metadata' => $notification->data['metadata'] ?? [],
            'read_at' => $notification->read_at,
            'created_at' => $notification->created_at,
        ];
    }
}
