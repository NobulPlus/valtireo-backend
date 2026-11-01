<?php
namespace App\Services;

use App\Models\{ConnectConversation, ConnectMessage, User};
use App\Notifications\ValtireoNotification;
use Illuminate\Support\Facades\DB;

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
        $lastMessage = $conversation->messages()->whereNull('deleted_at')->latest('id')->with('sender:id,name')->first();
        return ['id' => $conversation->id, 'kind' => $conversation->kind, 'visibility' => $conversation->visibility,
            'name' => $conversation->kind === 'direct' ? ($conversation->members->first(fn ($u) => $u->id !== $actor->id)?->name ?? 'Conversation') : $conversation->name,
            'owner_id' => $conversation->owner_id, 'archived' => $conversation->archived, 'muted' => (bool) $membership?->muted,
            'joined' => $membership !== null, 'updated_at' => $conversation->updated_at->toISOString(),
            'unread_count' => $membership ? $conversation->messages()->where('id', '>', $membership->last_read_id)->where('sender_id', '!=', $actor->id)->whereNull('deleted_at')->count() : 0,
            'last_message' => $lastMessage ? [
                'sender_name' => $lastMessage->sender_id === $actor->id ? 'You' : $lastMessage->sender?->name,
                'body' => $lastMessage->body,
                'voice_note' => (bool) $lastMessage->voice_note,
                'has_attachment' => $lastMessage->file_path !== null,
            ] : null,
            'members' => $conversation->members->map(fn ($u) => $this->person($u))->values()];
    }

    public function message(ConnectMessage $message, User $actor): array
    {
        $message->loadMissing('sender.employee.profile', 'sender.employee.department', 'replyTo.sender:id,name');
        $deleted = $message->deleted_at !== null;
        $replyTo = $message->replyTo;
        return ['id' => $message->id, 'client_id' => $message->client_id, 'conversation_id' => $message->conversation_id,
            'sender' => $this->person($message->sender), 'body' => $deleted ? null : $message->body,
            'reply_to_id' => $message->reply_to_id,
            'reply_to' => $replyTo ? [
                'sender_name' => $replyTo->sender?->name,
                'body' => $replyTo->deleted_at !== null ? null : $replyTo->body,
                'voice_note' => (bool) $replyTo->voice_note,
                'has_attachment' => $replyTo->file_path !== null,
            ] : null,
            'mentions' => $deleted ? [] : ($message->mentions ?? []),
            'created_at' => $message->created_at->toISOString(), 'edited_at' => $message->edited_at?->toISOString(), 'deleted' => $deleted, 'pinned' => !$deleted && $message->pinned,
            'attachment' => !$deleted && $message->file_path ? ['name' => $message->file_name, 'mime' => $message->file_mime, 'size' => $message->file_size, 'voice_note' => $message->voice_note, 'url' => '/connect/conversations/'.$message->conversation_id.'/messages/'.$message->id.'/file'] : null,
            'reactions' => $deleted ? [] : DB::table('connect_reactions')->where('message_id', $message->id)->get()->groupBy('reaction')->map(fn ($rows, $reaction) => ['reaction' => $reaction, 'count' => $rows->count(), 'mine' => $rows->contains('user_id', $actor->id)])->values()];
    }

    /**
     * Was a raw `notifications` table insert, which bypasses
     * ValtireoNotification's own via() channel list entirely — including
     * ExpoPushChannel. Every Connect message and incoming call looked like it
     * notified (the in-app row was there), but none of it ever pushed, silently,
     * since nothing else about the behavior looked broken. Routing through the
     * real notify() call is what actually wires this into push delivery.
     */
    public function notify(User $actor, User $recipient, string $event, string $conversationId): void
    {
        if (DB::table('connect_preferences')->where('user_id', $recipient->id)->where('notifications', false)->exists()) return;
        $recipient->notify(new ValtireoNotification([
            'organization_id' => $actor->organization_id,
            'category' => 'connect',
            'event' => $event,
            'severity' => 'info',
            'title' => str_contains($event, 'call') ? 'Connect voice call' : 'Connect message',
            'message' => 'You have new activity in Connect.',
            'action_label' => 'Open Connect',
            'action_url' => '/connect/chat/'.$conversationId,
            'entity_type' => 'connect_conversation',
            'entity_id' => $conversationId,
        ]));
    }

    public function audit(User $actor, string $action, string $subject, array $metadata = []): void
    {
        DB::table('connect_audit_events')->insert(['organization_id' => $actor->organization_id, 'actor_id' => $actor->id, 'action' => $action, 'subject_id' => $subject, 'metadata' => json_encode($metadata), 'created_at' => now()]);
    }
}
