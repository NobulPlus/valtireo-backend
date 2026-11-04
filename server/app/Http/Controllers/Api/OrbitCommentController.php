<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrbitComment;
use App\Models\OrbitWorkItem;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\OrbitAuthorizationService;
use App\Services\OrbitWorkItemActivityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrbitCommentController extends Controller
{
    private const EDIT_WINDOW_MINUTES = 15;

    public function __construct(
        private readonly OrbitAuthorizationService $auth,
        private readonly OrbitWorkItemActivityService $activity,
        private readonly NotificationDispatchService $notifications,
    ) {
    }

    public function index(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        abort_unless($this->auth->canViewProject($request->user(), $workItem->project), 404);

        $comments = $workItem->comments()
            ->whereNull('deleted_at')
            ->with('author:id,name', 'replyTo:id,body,author_id')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $comments]);
    }

    public function store(Request $request, OrbitWorkItem $workItem): JsonResponse
    {
        $user = $request->user();
        $project = $workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($this->auth->canEditWorkItems($user, $project), 403);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'reply_to_id' => ['nullable', 'integer'],
            'mentions' => ['sometimes', 'array', 'max:20'],
            'mentions.*' => ['integer', 'distinct'],
        ]);

        $mentions = $data['mentions'] ?? [];

        if (! empty($mentions)) {
            $memberCount = $project->members()->whereIn('users.id', $mentions)->count();
            abort_unless($memberCount === count($mentions), 422, 'You can only mention people on this project.');
        }

        if (! empty($data['reply_to_id'])) {
            $workItem->comments()->whereNull('deleted_at')->findOrFail($data['reply_to_id']);
        }

        $comment = OrbitComment::create([
            'organization_id' => $user->organization_id,
            'work_item_id' => $workItem->id,
            'author_id' => $user->id,
            'body' => $data['body'],
            'reply_to_id' => $data['reply_to_id'] ?? null,
            'mentions' => $mentions,
        ]);

        $this->activity->record($workItem, $user, 'commented', "{$user->name} commented on this item.");
        $this->notifications->orbitCommentPosted($comment);

        if (! empty($mentions)) {
            $this->notifications->orbitCommentMentioned($comment, User::query()->whereIn('id', $mentions)->get());
        }

        return response()->json(['comment' => $comment->load('author:id,name')], 201);
    }

    public function update(Request $request, OrbitComment $comment): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->auth->canViewProject($user, $comment->workItem->project), 404);
        abort_unless($comment->author_id === $user->id, 403);
        abort_unless(is_null($comment->deleted_at), 404);
        abort_if(
            $comment->created_at->diffInMinutes(now()) > self::EDIT_WINDOW_MINUTES,
            403,
            'This comment can only be edited within '.self::EDIT_WINDOW_MINUTES.' minutes of posting.'
        );

        $data = $request->validate(['body' => ['required', 'string', 'max:10000']]);

        $comment->update(['body' => $data['body'], 'edited_at' => now()]);

        return response()->json(['comment' => $comment]);
    }

    public function destroy(Request $request, OrbitComment $comment): JsonResponse
    {
        $user = $request->user();
        $project = $comment->workItem->project;
        abort_unless($this->auth->canViewProject($user, $project), 404);
        abort_unless($comment->author_id === $user->id || $this->auth->canAdministerProject($user, $project), 403);

        $comment->update(['deleted_at' => now()]);

        return response()->json(['message' => 'Comment deleted.']);
    }
}
