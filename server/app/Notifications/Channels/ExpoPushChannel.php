<?php

namespace App\Notifications\Channels;

use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Pushes every notification dispatched through NotificationDispatchService (see
 * ValtireoNotification::via()) to each of the recipient's registered mobile
 * devices — the same payload already going to the in-app notifications list,
 * now also surfaced even while the app is backgrounded or closed. Best-effort
 * and silent on failure, matching notify()'s own philosophy: a broken push
 * provider must never be allowed to break the action that triggered it.
 */
class ExpoPushChannel
{
    private const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User) return;

        $tokens = $notifiable->devicePushTokens()->pluck('token');
        if ($tokens->isEmpty()) return;

        $data = $notification->toArray($notifiable);
        $title = $data['title'] ?? 'Valtireo';
        $body = $data['message'] ?? '';
        // Connect's incoming-call push gets the loudest treatment the managed-Expo
        // push API allows: the dedicated MAX-importance, bypassDnd 'calls' Android
        // channel (see pushTokenRegistration.ts) and iOS's "time-sensitive"
        // interruption level, which breaks through Focus/Do Not Disturb. This is
        // still a standard remote push, not VoIP/CallKit — it improves delivery
        // while the app is backgrounded, but a fully killed app (especially on
        // iOS) still won't get a native ringing screen from this alone.
        $isIncomingCall = ($data['event'] ?? null) === 'connect.call.incoming';

        $messages = $tokens->map(fn (string $token) => [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'priority' => 'high',
            'channelId' => $isIncomingCall ? 'calls' : 'default',
            ...($isIncomingCall ? ['interruptionLevel' => 'time-sensitive'] : []),
            'data' => [
                'entity_type' => $data['entity_type'] ?? null,
                'entity_id' => $data['entity_id'] ?? null,
                'action_url' => $data['action_url'] ?? null,
            ],
        ])->values()->all();

        try {
            $response = Http::acceptJson()->asJson()->timeout(10)->connectTimeout(5)->post(self::ENDPOINT, $messages);
            // Expo returns 200 even when a message itself failed (bad credentials,
            // unregistered device, ...) — the failure is inside the body, per
            // ticket, not the HTTP status, so a non-throwing response still needs
            // checking or a problem like the recent missing-FCM-credentials one
            // would fail completely silently.
            $errors = collect($response->json('data', []))->where('status', 'error');
            if ($errors->isNotEmpty()) {
                Log::error('Expo push delivery reported errors', [
                    'user_id' => $notifiable->id,
                    'errors' => $errors->values()->all(),
                ]);
            }
        } catch (Throwable $exception) {
            Log::error('Expo push delivery failed', [
                'user_id' => $notifiable->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
