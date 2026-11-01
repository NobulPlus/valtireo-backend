<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{ConnectVoiceCall, User};
use App\Services\{ConnectChatService, ConnectMediaService, ConnectVoiceService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ConnectVoiceController extends Controller
{
    public function __construct(private readonly ConnectChatService $chat, private readonly ConnectMediaService $media, private readonly ConnectVoiceService $voice) {}
    private function visible(User $actor) { return ConnectVoiceCall::where('organization_id', $actor->organization_id)->where(fn ($q) => $q->where('caller_id', $actor->id)->orWhere('callee_id', $actor->id)); }
    private function summary(ConnectVoiceCall $call, User $actor): array {
        return ['id' => $call->id, 'conversation_id' => $call->conversation_id, 'status' => $call->status, 'incoming' => $call->callee_id === $actor->id, 'caller' => $this->chat->person($call->caller), 'callee' => $this->chat->person($call->callee), 'created_at' => $call->created_at->toISOString(), 'accepted_at' => $call->accepted_at?->toISOString(), 'ended_at' => $call->ended_at?->toISOString()];
    }
    public function index(Request $request) {
        $actor = $this->chat->actor($request->user());
        foreach ($this->visible($actor)->whereIn('status', ['ringing', 'active'])->get() as $call) $this->voice->reconcile($call);
        return ['media_ready' => $this->media->ready(), 'calls' => $this->visible($actor)->latest()->paginate(25)->through(fn ($c) => $this->summary($c, $actor))];
    }
    public function store(Request $request) {
        $actor = $this->chat->actor($request->user());
        abort_unless($this->media->ready(), 503, 'Voice calling needs a configured media service. Messaging and voice notes remain available.');
        $data = $request->validate(['conversation_id' => ['required', 'uuid']]);
        $conversation = $this->chat->conversation($actor, $data['conversation_id']);
        abort_unless($conversation->kind === 'direct' && !$conversation->archived, 422, 'Voice calls currently support direct conversations.');
        $callee = $conversation->members()->where('users.id', '!=', $actor->id)->firstOrFail();
        abort_unless($this->chat->activeUsers($actor)->whereKey($callee->id)->exists(), 409, 'This colleague is unavailable.');
        $prefs = DB::table('connect_preferences')->where('user_id', $callee->id)->first();
        abort_if(($prefs && !$prefs->allow_calls) || in_array($prefs?->availability, ['busy', 'offline']), 409, 'This colleague is not accepting calls.');
        foreach (ConnectVoiceCall::where('organization_id', $actor->organization_id)->whereIn('status', ['ringing', 'active'])->where(fn ($q) => $q->whereIn('caller_id', [$actor->id, $callee->id])->orWhereIn('callee_id', [$actor->id, $callee->id]))->get() as $old) $this->voice->reconcile($old);
        $call = DB::transaction(function () use ($actor, $callee, $conversation) {
            User::whereIn('id', [$actor->id, $callee->id])->orderBy('id')->lockForUpdate()->get();
            abort_if(ConnectVoiceCall::where('organization_id', $actor->organization_id)->whereIn('status', ['ringing', 'active'])->where(fn ($q) => $q->whereIn('caller_id', [$actor->id, $callee->id])->orWhereIn('callee_id', [$actor->id, $callee->id]))->exists(), 409, 'One participant is already on a call.');
            $call = ConnectVoiceCall::create(['organization_id' => $actor->organization_id, 'conversation_id' => $conversation->id, 'caller_id' => $actor->id, 'callee_id' => $callee->id, 'status' => 'ringing', 'expires_at' => now()->addSeconds(60)]);
            $this->chat->notify($actor, $callee, 'connect.call.incoming', $conversation->id);
            $this->chat->audit($actor, 'call.started', $call->id);
            return $call;
        });
        return response()->json(['data' => $this->summary($call, $actor)], 201);
    }
    public function action(Request $request, string $call) {
        $actor = $this->chat->actor($request->user());
        $data = $request->validate(['action' => ['required', Rule::in(['accept', 'decline', 'end', 'join'])]]);
        $record = $this->visible($actor)->findOrFail($call);
        $this->voice->reconcile($record);
        $result = DB::transaction(function () use ($actor, $call, $data) {
            $record = $this->visible($actor)->lockForUpdate()->findOrFail($call);
            $this->chat->conversation($actor, $record->conversation_id);
            $action = $data['action'];
            if (in_array($action, ['accept', 'decline'])) abort_unless($record->callee_id === $actor->id, 403);
            if ($action === 'accept') {
                abort_unless($record->status === 'ringing' && now()->lt($record->expires_at), 409, 'The call is no longer ringing.');
                $this->media->createVoiceRoom($record);
                $record->update(['status' => 'active', 'accepted_at' => now(), 'expires_at' => now()->addHours(2)]);
            }
            if ($action === 'decline') {
                abort_unless($record->status === 'ringing', 409);
                $record->update(['status' => 'declined', 'ended_at' => now()]);
            }
            if ($action === 'end' && in_array($record->status, ['ringing', 'active'])) $record->update(['status' => $record->status === 'ringing' ? 'cancelled' : 'ended', 'ended_at' => now()]);
            $payload = ['data' => $this->summary($record, $actor)];
            if (in_array($action, ['accept', 'join'])) {
                abort_unless($record->status === 'active', 409, 'The call is not active.');
                $payload['credentials'] = ['token' => $this->media->voiceToken($record, $actor), 'server_url' => config('connect.url')];
            }
            if ($action !== 'join') $this->chat->audit($actor, 'call.'.$action, $record->id);
            return $payload;
        });
        if (in_array($data['action'], ['end', 'decline'])) $this->voice->reconcile($record->fresh());
        return response()->json($result)->header('Cache-Control', 'private, no-store');
    }
}
