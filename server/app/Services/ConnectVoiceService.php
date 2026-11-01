<?php
namespace App\Services;

use App\Models\{ConnectVoiceCall, User};
use Illuminate\Support\Facades\DB;

class ConnectVoiceService
{
    public function __construct(private readonly ConnectMediaService $media, private readonly ConnectChatService $chat, private readonly ModuleEntitlementService $modules) {}

    /**
     * How long an accepted call is allowed to show zero room participants
     * before we treat that as an ungraceful disconnect rather than a brief
     * reconnect blip — LiveKit's own WebRTC reconnection logic generally
     * keeps a participant's room membership intact through a short network
     * interruption, so by the time ListParticipants genuinely comes back
     * empty, both sides being gone is already a fairly solid signal; this
     * just avoids reacting to the very first empty read right as a callee's
     * client is still mid-connect after accepting.
     */
    private const DISCONNECT_GRACE_SECONDS = 20;

    /**
     * $checkPresence is deliberately opt-in, not the default: it costs a real
     * LiveKit API call, and this method also runs on every client poll of
     * /connect/calls (every ~4s per active call) via the controller below.
     * Doing a presence check on every one of those would multiply load on
     * both us and LiveKit for no benefit beyond what the once-a-minute
     * scheduled sweep (connect:reconcile-voice) already provides — that's the
     * one call site that opts in, precisely because it runs independently of
     * anyone having the app open and polling at all.
     */
    public function reconcile(ConnectVoiceCall $call, bool $checkPresence = false): ConnectVoiceCall
    {
        // Read-only and possibly a real network call to LiveKit — resolved
        // before opening the transaction below, never while holding the row
        // lock, so a slow/unreachable media service can't stall other
        // reconciliation attempts touching the same call.
        $worthChecking = $checkPresence && $call->status === 'active' && $call->accepted_at
            && $call->accepted_at->diffInSeconds(now()) >= self::DISCONNECT_GRACE_SECONDS;
        $roomIsEmpty = $worthChecking && $this->media->voiceParticipants($call) === [];

        $call = DB::transaction(function () use ($call, $roomIsEmpty) {
            $call = ConnectVoiceCall::lockForUpdate()->findOrFail($call->id);
            if (!in_array($call->status, ['ringing', 'active'])) return $call;
            $caller = User::find($call->caller_id);
            $org = $caller?->organization;
            $valid = $caller && $org && $org->id === $call->organization_id && !in_array($org->status, ['suspended', 'rejected'])
                && $this->modules->organizationHasActiveSubscription($org, 'connect')
                && $this->chat->activeUsers($caller)->whereIn('id', [$call->caller_id, $call->callee_id])->count() === 2
                && $call->conversation?->members()->whereIn('users.id', [$call->caller_id, $call->callee_id])->count() === 2;
            $abandoned = $valid && $call->status === 'active' && $roomIsEmpty;
            if (!$valid || $abandoned || now()->gte($call->expires_at)) {
                $call->update(['status' => $call->status === 'ringing' && $valid ? 'missed' : 'ended', 'ended_at' => now()]);
                if ($valid && $call->status === 'missed') $this->chat->notify($caller, $call->callee, 'connect.call.missed', $call->conversation_id);
            }
            return $call;
        });
        if ($call->ended_at && !$call->room_closed_at) {
            if ($call->accepted_at) $this->media->closeVoiceRoom($call);
            $call->update(['room_closed_at' => now()]);
        }
        return $call;
    }
}
