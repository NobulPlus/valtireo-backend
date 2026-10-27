<?php
namespace App\Services;

use App\Models\{ConnectVoiceCall, User};
use Illuminate\Support\Facades\DB;

class ConnectVoiceService
{
    public function __construct(private readonly ConnectMediaService $media, private readonly ConnectChatService $chat, private readonly ModuleEntitlementService $modules) {}

    public function reconcile(ConnectVoiceCall $call): ConnectVoiceCall
    {
        $call = DB::transaction(function () use ($call) {
            $call = ConnectVoiceCall::lockForUpdate()->findOrFail($call->id);
            if (!in_array($call->status, ['ringing', 'active'])) return $call;
            $caller = User::find($call->caller_id);
            $org = $caller?->organization;
            $valid = $caller && $org && $org->id === $call->organization_id && !in_array($org->status, ['suspended', 'rejected'])
                && $this->modules->organizationHasActiveSubscription($org, 'connect')
                && $this->chat->activeUsers($caller)->whereIn('id', [$call->caller_id, $call->callee_id])->count() === 2
                && $call->conversation?->members()->whereIn('users.id', [$call->caller_id, $call->callee_id])->count() === 2;
            if (!$valid || now()->gte($call->expires_at)) {
                $call->update(['status' => $call->status === 'ringing' && $valid ? 'missed' : 'ended', 'ended_at' => now()]);
                if ($valid && $call->status === 'missed') $this->chat->notify($caller, $call->callee_id, 'connect.call.missed', $call->conversation_id);
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
