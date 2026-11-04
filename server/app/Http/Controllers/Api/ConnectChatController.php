<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{ConnectConversation, ConnectMessage, User};
use App\Services\ConnectChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Validation\Rule;

class ConnectChatController extends Controller
{
    public function __construct(private readonly ConnectChatService $chat) {}
    private function actor(Request $request): User { return $this->chat->actor($request->user()); }

    public function people(Request $request)
    {
        $actor = $this->actor($request);
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'department_id' => ['nullable', 'integer']]);
        return $this->chat->activeUsers($actor)->whereKeyNot($actor->id)->with('employee.profile', 'employee.department')
            ->when($data['search'] ?? null, fn ($q, $text) => $q->where('name', 'like', '%'.$text.'%'))
            ->when($data['department_id'] ?? null, fn ($q, $deptId) => $q->whereHas('employee', fn ($q) => $q->where('department_id', $deptId)))
            ->orderBy('name')->orderBy('id')->paginate(25)->through(fn ($u) => $this->chat->person($u));
    }

    public function index(Request $request)
    {
        $actor = $this->actor($request);
        // Opening a direct conversation creates it immediately (see ConnectMessenger's
        // openDirect — "tapping the person IS the action"), so without this filter every
        // chat a user merely opened, and never actually messaged or called through,
        // would sit in their list forever looking like an ongoing conversation. Group/
        // channel creation already requires an explicit name + Create step, so those
        // always represent a deliberate action and are never filtered.
        return $this->chat->visible($actor)
            ->where(fn ($q) => $q->where('kind', '!=', 'direct')->orWhereHas('messages')->orWhereHas('calls'))
            ->orderByDesc('updated_at')->orderBy('id')->paginate(30)->through(fn ($c) => $this->chat->summary($c, $actor));
    }

    public function channels(Request $request)
    {
        $actor = $this->actor($request);
        return ConnectConversation::where('organization_id', $actor->organization_id)->where('kind', 'channel')->where('visibility', 'organization')->where('archived', false)->orderBy('name')->orderBy('id')->paginate(30)->through(fn ($c) => $this->chat->summary($c, $actor));
    }

    public function store(Request $request)
    {
        $actor = $this->actor($request);
        $data = $request->validate(['kind' => ['required', Rule::in(['direct', 'group', 'channel'])], 'name' => ['nullable', 'string', 'max:120'], 'visibility' => ['sometimes', Rule::in(['private', 'organization'])], 'member_ids' => ['present', 'array', 'max:99'], 'member_ids.*' => ['integer', 'distinct']]);
        $ids = collect($data['member_ids'])->map(fn ($id) => (int) $id)->reject(fn ($id) => $id === $actor->id)->values();
        abort_unless($this->chat->activeUsers($actor)->whereIn('id', $ids)->count() === $ids->count(), 422, 'Choose active colleagues in your organization.');
        abort_if($data['kind'] === 'direct' && $ids->count() !== 1, 422, 'Direct messages need one other colleague.');
        abort_if($data['kind'] !== 'direct' && trim($data['name'] ?? '') === '', 422, 'Enter a conversation name.');
        if ($data['kind'] === 'channel') abort_unless($actor->can('organizations.administer') || data_get($actor->organization->settings, 'connect.allow_employee_channels', true), 403, 'Channel creation is restricted.');
        $conversation = DB::transaction(function () use ($actor, $data, $ids) {
            // All DM creators acquire the same organization lock, preventing duplicate pairs.
            $actor->organization()->lockForUpdate()->firstOrFail();
            $pair = $data['kind'] === 'direct' ? collect([$actor->id, $ids[0]])->sort()->implode(':') : null;
            if ($pair && ($existing = ConnectConversation::where('organization_id', $actor->organization_id)->where('direct_key', $pair)->first())) return $existing;
            $c = ConnectConversation::create(['organization_id' => $actor->organization_id, 'owner_id' => $actor->id, 'kind' => $data['kind'], 'name' => $data['name'] ?? null, 'direct_key' => $pair, 'visibility' => $data['kind'] === 'channel' ? ($data['visibility'] ?? 'private') : 'private']);
            $c->members()->attach($ids->push($actor->id)->all());
            $this->chat->audit($actor, 'conversation.created', $c->id);
            return $c;
        });
        return response()->json(['data' => $this->chat->summary($conversation, $actor)], 201);
    }

    public function show(Request $request, string $conversation)
    {
        $actor = $this->actor($request);
        return ['data' => $this->chat->summary($this->chat->conversation($actor, $conversation), $actor)];
    }

    public function membership(Request $request, string $conversation)
    {
        $actor = $this->actor($request);
        $data = $request->validate(['action' => ['required', Rule::in(['join', 'add', 'remove', 'leave', 'transfer', 'archive', 'rename', 'mute', 'read', 'unread'])], 'user_id' => ['nullable', 'integer'], 'name' => ['nullable', 'string', 'max:120'], 'enabled' => ['sometimes', 'boolean'], 'last_read_id' => ['nullable', 'integer', 'min:0']]);
        return DB::transaction(function () use ($actor, $conversation, $data) {
            $c = ConnectConversation::where('organization_id', $actor->organization_id)->lockForUpdate()->findOrFail($conversation);
            $action = $data['action'];
            if ($action === 'join') {
                abort_unless($c->kind === 'channel' && $c->visibility === 'organization' && !$c->archived, 404);
                $c->members()->syncWithoutDetaching([$actor->id]);
            } else {
                abort_unless($c->members()->where('users.id', $actor->id)->exists(), 404);
                // Adding someone to a direct conversation is how a 1:1 becomes a group
                // (Teams' own "add people" behavior) — either participant can do this,
                // there being no meaningful "owner" of a 2-person direct conversation.
                // Every other owner-only action is unaffected.
                $addingToDirect = $action === 'add' && $c->kind === 'direct';
                if (in_array($action, ['add', 'remove', 'transfer', 'archive', 'rename'])) abort_unless($addingToDirect || ($c->owner_id === $actor->id && $c->kind !== 'direct'), 403);
                $target = (int) ($data['user_id'] ?? 0);
                if (in_array($action, ['add', 'transfer'])) abort_unless($this->chat->activeUsers($actor)->whereKey($target)->exists(), 422, 'Choose an active colleague.');
                if ($action === 'add') {
                    abort_if($c->archived || $c->members()->count() >= 100, 409, 'Conversation is archived or full.');
                    $c->members()->syncWithoutDetaching([$target]);
                    if ($addingToDirect) {
                        $name = trim($data['name'] ?? '') !== '' ? trim($data['name']) : $c->members()->pluck('name')->implode(', ');
                        $c->update(['kind' => 'group', 'direct_key' => null, 'name' => $name]);
                    }
                }
                if ($action === 'transfer') {
                    abort_unless($c->members()->where('users.id', $target)->exists(), 422, 'The new owner must already be a member.');
                    $c->update(['owner_id' => $target]);
                }
                if (in_array($action, ['remove', 'leave'])) {
                    $target = $action === 'leave' ? $actor->id : $target;
                    abort_if($c->kind === 'direct' || $target === $c->owner_id, 409, 'Transfer ownership before leaving. Direct conversations can be muted.');
                    $c->members()->detach($target);
                }
                if ($action === 'archive') $c->update(['archived' => (bool) ($data['enabled'] ?? true)]);
                if ($action === 'rename') { abort_if(trim($data['name'] ?? '') === '', 422); $c->update(['name' => trim($data['name'])]); }
                if ($action === 'mute') $c->members()->updateExistingPivot($actor->id, ['muted' => (bool) ($data['enabled'] ?? true)]);
                if ($action === 'unread') $c->members()->updateExistingPivot($actor->id, ['last_read_id' => 0]);
                if ($action === 'read') {
                    $id = (int) ($data['last_read_id'] ?? 0);
                    abort_unless($id === 0 || $c->messages()->whereKey($id)->exists(), 422);
                    DB::table('connect_members')->where('conversation_id', $c->id)->where('user_id', $actor->id)->where('last_read_id', '<', $id)->update(['last_read_id' => $id]);
                }
            }
            if (!in_array($action, ['read', 'unread', 'mute'])) $this->chat->audit($actor, 'membership.'.$action, $c->id, ['user_id' => $data['user_id'] ?? $actor->id]);
            return ['message' => 'Conversation updated.'];
        });
    }

    public function messages(Request $request, string $conversation)
    {
        $actor = $this->actor($request);
        $c = $this->chat->conversation($actor, $conversation);
        $data = $request->validate(['before' => ['nullable', 'integer', 'min:1'], 'search' => ['nullable', 'string', 'max:100'], 'pinned' => ['sometimes', 'boolean']]);
        return $c->messages()->when($data['before'] ?? null, fn ($q, $id) => $q->where('id', '<', $id))
            ->when($data['search'] ?? null, fn ($q, $text) => $q->whereNull('deleted_at')->where(fn ($q) => $q->where('body', 'like', '%'.$text.'%')->orWhere('file_name', 'like', '%'.$text.'%')))
            ->when($data['pinned'] ?? false, fn ($q) => $q->where('pinned', true)->whereNull('deleted_at'))->orderByDesc('id')->limit(50)->get()->map(fn ($m) => $this->chat->message($m, $actor));
    }

    public function send(Request $request, string $conversation)
    {
        $actor = $this->actor($request);
        $this->chat->conversation($actor, $conversation);
        $data = $request->validate(['client_id' => ['required', 'uuid'], 'body' => ['nullable', 'string', 'max:10000'], 'reply_to_id' => ['nullable', 'integer'], 'mentions' => ['sometimes', 'array', 'max:20'], 'mentions.*' => ['integer', 'distinct'], 'voice_note' => ['sometimes', 'boolean'], 'file' => ['nullable', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf,txt,csv,doc,docx,xls,xlsx,ppt,pptx,mp3,m4a,mp4,wav,ogg,webm,weba,aac']]);
        abort_unless(trim($data['body'] ?? '') !== '' || $request->hasFile('file'), 422, 'Write a message or attach a file.');
        $path = null;
        try {
            $message = DB::transaction(function () use ($actor, $conversation, $data, $request, &$path) {
                $c = $this->chat->conversation($actor, $conversation, true);
                abort_if($c->archived, 409, 'This conversation is archived.');
                if ($existing = $c->messages()->where('sender_id', $actor->id)->where('client_id', $data['client_id'])->first()) return $existing;
                if ($data['reply_to_id'] ?? null) abort_unless($c->messages()->whereKey($data['reply_to_id'])->exists(), 422, 'Reply to a message in this conversation.');
                $mentions = $c->kind === 'direct' ? [] : ($data['mentions'] ?? []);
                abort_unless($c->members()->whereIn('users.id', $mentions)->count() === count($mentions), 422, 'Mention conversation members only.');
                $file = $request->file('file');
                $voice = (bool) ($data['voice_note'] ?? false);
                if ($voice) abort_unless($file && in_array($file->getMimeType(), ['audio/mpeg','audio/mp4','video/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','video/webm','audio/webm','audio/aac']), 422, 'Attach a supported audio recording.');
                if ($file) { $path = $file->store('organizations/'.$actor->organization_id.'/connect/'.$c->id, 'local'); abort_unless($path, 503, 'The file could not be stored.'); }
                $m = $c->messages()->create(['sender_id' => $actor->id, 'client_id' => $data['client_id'], 'body' => trim($data['body'] ?? '') ?: null, 'reply_to_id' => $data['reply_to_id'] ?? null, 'mentions' => $mentions, 'voice_note' => $voice,
                    'file_path' => $path, 'file_name' => $file ? mb_substr(basename($file->getClientOriginalName()), 0, 200) : null, 'file_mime' => $file?->getMimeType(), 'file_size' => $file?->getSize()]);
                $c->touch();
                foreach ($c->members()->where('users.id', '!=', $actor->id)->wherePivot('muted', false)->get() as $recipient) {
                    if ($this->chat->activeUsers($actor)->whereKey($recipient->id)->exists()) $this->chat->notify($actor, $recipient, in_array($recipient->id, $mentions) ? 'connect.mentioned' : 'connect.message', $c->id);
                }
                return $m;
            });
        } catch (\Throwable $e) { if ($path) Storage::disk('local')->delete($path); throw $e; }
        return response()->json(['data' => $this->chat->message($message, $actor)], 201);
    }

    public function changeMessage(Request $request, string $conversation, int $message)
    {
        $actor = $this->actor($request);
        $data = $request->validate(['action' => ['required', Rule::in(['edit', 'delete', 'pin', 'react', 'report'])], 'body' => ['nullable', 'string', 'max:10000'], 'reaction' => ['nullable', Rule::in(['like', 'heart', 'celebrate', 'thanks', 'laugh'])], 'enabled' => ['sometimes', 'boolean'], 'reason' => ['nullable', 'string', 'max:1000']]);
        return DB::transaction(function () use ($actor, $conversation, $message, $data) {
            $c = $this->chat->conversation($actor, $conversation, true);
            $m = $c->messages()->lockForUpdate()->findOrFail($message);
            abort_if($m->deleted_at || $c->archived, 409, 'This message cannot be changed.');
            $action = $data['action'];
            if (in_array($action, ['edit', 'delete'])) abort_unless($m->sender_id === $actor->id, 403);
            if ($action === 'edit') { abort_if(trim($data['body'] ?? '') === '' && !$m->file_path, 422); $m->update(['body' => trim($data['body'] ?? ''), 'edited_at' => now()]); }
            if ($action === 'delete') {
                abort_if($m->created_at->diffInMinutes(now()) > 15, 403, 'This message can only be deleted within 15 minutes of sending.');
                $m->update(['body' => null, 'mentions' => [], 'pinned' => false, 'deleted_at' => now()]);
            }
            if ($action === 'pin') { abort_unless($c->kind === 'direct' || $c->owner_id === $actor->id, 403); $m->update(['pinned' => (bool) ($data['enabled'] ?? true)]); }
            if ($action === 'react') {
                abort_unless($data['reaction'] ?? null, 422);
                $key = ['message_id' => $m->id, 'user_id' => $actor->id, 'reaction' => $data['reaction']];
                if ($data['enabled'] ?? true) DB::table('connect_reactions')->updateOrInsert($key, []); else DB::table('connect_reactions')->where($key)->delete();
            }
            if ($action === 'report') {
                abort_if(trim($data['reason'] ?? '') === '', 422, 'Explain why you are reporting this message.');
                DB::table('connect_reports')->insertOrIgnore(['organization_id' => $actor->organization_id, 'message_id' => $m->id, 'reporter_id' => $actor->id, 'reason' => $data['reason'], 'created_at' => now(), 'updated_at' => now()]);
            }
            if ($action !== 'react') $this->chat->audit($actor, 'message.'.$action, (string) $m->id);
            return ['data' => $this->chat->message($m, $actor)];
        });
    }

    public function file(Request $request, string $conversation, int $message)
    {
        $c = $this->chat->conversation($this->actor($request), $conversation);
        $m = $c->messages()->whereNull('deleted_at')->findOrFail($message);
        abort_unless($m->file_path && Storage::disk('local')->exists($m->file_path), 404);
        $inline = str_starts_with($m->file_mime, 'image/') || str_starts_with($m->file_mime, 'audio/') || $m->voice_note;
        return response()->file(Storage::disk('local')->path($m->file_path), ['Content-Type' => $m->file_mime, 'Content-Disposition' => $inline ? 'inline' : 'attachment', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }

    public function photo(Request $request, int $person)
    {
        $actor = $this->actor($request);
        $user = $this->chat->activeUsers($actor)->whereKey($person)->firstOrFail();
        abort_unless($person === $actor->id || $this->chat->visible($actor)->whereHas('members', fn ($q) => $q->where('users.id', $person))->exists(), 404);
        $path = $user->employee?->profile?->passport_photo_path;
        abort_unless($path && Storage::disk('local')->exists($path), 404);
        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function preferences(Request $request)
    {
        $actor = $this->actor($request);
        if ($request->isMethod('patch')) {
            $data = $request->validate(['availability' => ['sometimes', Rule::in(['available', 'away', 'busy', 'offline'])], 'notifications' => ['sometimes', 'boolean'], 'allow_calls' => ['sometimes', 'boolean']]);
            DB::table('connect_preferences')->updateOrInsert(['user_id' => $actor->id], [...$data, 'updated_at' => now()]);
        }
        $p = DB::table('connect_preferences')->where('user_id', $actor->id)->first();
        return ['availability' => $p?->availability ?? 'available', 'notifications' => (bool) ($p?->notifications ?? true), 'allow_calls' => (bool) ($p?->allow_calls ?? true)];
    }

    public function reports(Request $request)
    {
        $actor = $this->actor($request);
        abort_unless($actor->can('organizations.administer'), 403);
        // Only reported excerpts are exposed. Admin status does not grant conversation access.
        return DB::table('connect_reports')->where('connect_reports.organization_id', $actor->organization_id)->join('connect_messages', 'connect_messages.id', '=', 'connect_reports.message_id')->select('connect_reports.*', 'connect_messages.body', 'connect_messages.sender_id')->orderByDesc('connect_reports.id')->paginate(25);
    }

    public function moderate(Request $request, int $report)
    {
        $actor = $this->actor($request);
        abort_unless($actor->can('organizations.administer'), 403);
        $data = $request->validate(['action' => ['required', Rule::in(['dismiss', 'hide'])], 'reason' => ['required', 'string', 'max:1000']]);
        return DB::transaction(function () use ($actor, $report, $data) {
            $r = DB::table('connect_reports')->where('organization_id', $actor->organization_id)->where('id', $report)->lockForUpdate()->first();
            abort_unless($r, 404);
            if ($data['action'] === 'hide') ConnectMessage::whereKey($r->message_id)->update(['body' => null, 'mentions' => [], 'pinned' => false, 'deleted_at' => now()]);
            DB::table('connect_reports')->where('id', $r->id)->update(['status' => 'resolved', 'reviewer_id' => $actor->id, 'resolution' => $data['reason'], 'updated_at' => now()]);
            $this->chat->audit($actor, 'moderation.'.$data['action'], (string) $r->message_id, ['report_id' => $r->id, 'reason' => $data['reason']]);
            return ['message' => 'Report resolved.'];
        });
    }
}
