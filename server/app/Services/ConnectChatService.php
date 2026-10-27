<?php
namespace App\Services;

use App\Models\{ConnectConversation, ConnectMessage, User};
use App\Notifications\ValtireoNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ConnectChatService
{
    public function actor(User $user): User
    {
        abort_unless($user->organization_id && $this->activeUsers($user)->whereKey($user->id)->exists(), 403, 'Connect requires an active employee account.');
        return $user;
    }

    public function activeUsers(User $actor)
    {
        return User::where('organization_id', $actor->organization_id)->whereHas('employee', fn ($q) => $q->where('organization_id', $actor->organization_id)->where('status', 'active'));
    }

    public function visible(User $actor)
    {
        return ConnectConversation::where('organization_id', $actor->organization_id)->whereHas('members', fn ($q) => $q->where('users.id', $actor->id));
    }

    public function conversation(User $actor, string $id, bool $lock = false): ConnectConversation
    {
        $this->actor($actor);
        $query = $this->visible($actor);
        if ($lock) $query->lockForUpdate();
        return $query->findOrFail($id);
    }

    public function person(User $user): array
    {
        $profile = $user->employee?->profile;
        $preferences = DB::table('connect_preferences')->where('user_id', $user->id)->first();
        return ['id' => $user->id, 'name' => $user->name, 'active' => $user->employee?->status === 'active',
            'department' => $user->employee?->department?->name,
            'photo_url' => $profile?->passport_photo_path ? '/connect/people/'.$user->id.'/photo?v='.hash('sha256', $profile->passport_photo_path) : null,
            'availability' => $preferences?->availability ?? 'available'];
    }

    public function summary(ConnectConversation $conversation, User $actor): array
    {
        $conversation->loadMissing('members.employee.profile', 'members.employee.department');
        $membership = $conversation->members->firstWhere('id', $actor->id)?->pivot;
        return ['id' => $conversation->id, 'kind' => $conversation->kind, 'visibility' => $conversation->visibility,
            'name' => $conversation->kind === 'direct' ? ($conversation->members->first(fn ($u) => $u->id !== $actor->id)?->name ?? 'Conversation') : $conversation->name,
            'owner_id' => $conversation->owner_id, 'archived' => $conversation->archived, 'muted' => (bool) $membership?->muted,
            'joined' => $membership !== null, 'updated_at' => $conversation->updated_at->toISOString(),
            'unread_count' => $membership ? $conversation->messages()->where('id', '>', $membership->last_read_id)->where('sender_id', '!=', $actor->id)->whereNull('deleted_at')->count() : 0,
            'members' => $conversation->members->map(fn ($u) => $this->person($u))->values()];
    }

    public function message(ConnectMessage $message, User $actor): array
    {
        $message->loadMissing('sender.employee.profile', 'sender.employee.department');
        $deleted = $message->deleted_at !== null;
        return ['id' => $message->id, 'client_id' => $message->client_id, 'conversation_id' => $message->conversation_id,
            'sender' => $this->person($message->sender), 'body' => $deleted ? null : $message->body,
            'reply_to_id' => $message->reply_to_id, 'mentions' => $deleted ? [] : ($message->mentions ?? []),
            'created_at' => $message->created_at->toISOString(), 'edited_at' => $message->edited_at?->toISOString(), 'deleted' => $deleted, 'pinned' => !$deleted && $message->pinned,
            'attachment' => !$deleted && $message->file_path ? ['name' => $message->file_name, 'mime' => $message->file_mime, 'size' => $message->file_size, 'voice_note' => $message->voice_note, 'url' => '/connect/conversations/'.$message->conversation_id.'/messages/'.$message->id.'/file'] : null,
            'reactions' => $deleted ? [] : DB::table('connect_reactions')->where('message_id', $message->id)->get()->groupBy('reaction')->map(fn ($rows, $reaction) => ['reaction' => $reaction, 'count' => $rows->count(), 'mine' => $rows->contains('user_id', $actor->id)])->values()];
    }

    public function notify(User $actor, int $recipient, string $event, string $conversationId): void
    {
        if (DB::table('connect_preferences')->where('user_id', $recipient)->where('notifications', false)->exists()) return;
        DB::table('notifications')->insert(['id' => (string) Str::uuid(), 'type' => ValtireoNotification::class, 'notifiable_type' => User::class, 'notifiable_id' => $recipient,
            'data' => json_encode(['organization_id' => $actor->organization_id, 'category' => 'connect', 'event' => $event, 'severity' => 'info', 'title' => str_contains($event, 'call') ? 'Connect voice call' : 'Connect message', 'message' => 'You have new activity in Connect.', 'action_label' => 'Open Connect', 'action_url' => '/connect/chat/'.$conversationId, 'entity_type' => 'connect_conversation', 'entity_id' => $conversationId]), 'created_at' => now(), 'updated_at' => now()]);
    }

    public function audit(User $actor, string $action, string $subject, array $metadata = []): void
    {
        DB::table('connect_audit_events')->insert(['organization_id' => $actor->organization_id, 'actor_id' => $actor->id, 'action' => $action, 'subject_id' => $subject, 'metadata' => json_encode($metadata), 'created_at' => now()]);
    }
}
