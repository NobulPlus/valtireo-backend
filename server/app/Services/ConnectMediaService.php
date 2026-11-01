<?php

namespace App\Services;

use App\Models\ConnectMeeting;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class ConnectMediaService
{
    public function voiceToken(\App\Models\ConnectVoiceCall $call, User $user): string
    {
        return $this->token(['sub' => 'user-'.$user->id, 'name' => $user->name,
            'video' => ['room' => $call->roomName(), 'roomJoin' => true, 'canPublish' => true, 'canPublishSources' => ['microphone'], 'canSubscribe' => true, 'canPublishData' => false, 'canUpdateOwnMetadata' => false]]);
    }

    public function createVoiceRoom(\App\Models\ConnectVoiceCall $call): void
    {
        $this->request('CreateRoom', ['name' => $call->roomName(), 'max_participants' => 2, 'empty_timeout' => 60, 'departure_timeout' => 30], ['roomCreate' => true]);
    }

    public function closeVoiceRoom(\App\Models\ConnectVoiceCall $call): void
    {
        $this->request('DeleteRoom', ['room' => $call->roomName()], ['roomCreate' => true], true);
    }

    /**
     * Empty array means "nobody is actually in the room" — either it reports
     * zero participants, or the room is already gone (LiveKit auto-deletes it
     * after createVoiceRoom's own empty_timeout/departure_timeout), which
     * $allowMissing folds into the same empty result rather than a 503.
     */
    public function voiceParticipants(\App\Models\ConnectVoiceCall $call): array
    {
        return $this->request('ListParticipants', ['room' => $call->roomName()], ['roomAdmin' => true, 'room' => $call->roomName()], true)['participants'] ?? [];
    }

    public function ready(): bool
    {
        $url = (string) config('connect.url');

        return (bool) preg_match('#^wss?://[^/]+/?$#', $url)
            && filled(config('connect.api_key')) && filled(config('connect.api_secret'));
    }

    public function token(array $claims): string
    {
        abort_unless($this->ready(), 503, 'Live calls are not configured yet. Contact your workspace administrator.');
        $encode = fn (string $value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $header = $encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $body = $encode(json_encode([
            'iss' => config('connect.api_key'), 'nbf' => now()->timestamp - 5,
            'iat' => now()->timestamp, 'exp' => now()->timestamp + 60, ...$claims,
        ], JSON_THROW_ON_ERROR));

        return $header.'.'.$body.'.'.$encode(hash_hmac('sha256', $header.'.'.$body, config('connect.api_secret'), true));
    }

    public function joinToken(ConnectMeeting $meeting, User $user): string
    {
        return $this->token([
            'sub' => 'user-'.$user->id, 'name' => $user->name,
            'video' => ['room' => $meeting->roomName(), 'roomJoin' => true, 'canPublish' => true,
                'canSubscribe' => true, 'canPublishData' => true, 'canUpdateOwnMetadata' => false],
        ]);
    }

    public function createRoom(ConnectMeeting $meeting): void
    {
        $this->request('CreateRoom', ['name' => $meeting->roomName(), 'max_participants' => 25, 'empty_timeout' => 300], ['roomCreate' => true]);
    }

    public function closeRoom(ConnectMeeting $meeting): void
    {
        $this->request('DeleteRoom', ['room' => $meeting->roomName()], ['roomCreate' => true], true);
    }

    public function participants(ConnectMeeting $meeting): array
    {
        return $this->request('ListParticipants', ['room' => $meeting->roomName()], ['roomAdmin' => true, 'room' => $meeting->roomName()], true)['participants'] ?? [];
    }

    public function removeParticipant(ConnectMeeting $meeting, string $identity): void
    {
        $this->request('RemoveParticipant', ['room' => $meeting->roomName(), 'identity' => $identity], ['roomAdmin' => true, 'room' => $meeting->roomName()], true);
    }

    private function request(string $method, array $body, array $grant, bool $allowMissing = false): array
    {
        $token = $this->token(['video' => $grant]);
        $url = preg_replace('#^ws#', 'http', rtrim(config('connect.url'), '/'));
        try {
            $response = Http::withToken($token)->acceptJson()->timeout(10)->connectTimeout(5)
                ->post($url.'/twirp/livekit.RoomService/'.$method, $body);
        } catch (ConnectionException) {
            abort(503, 'The meeting service is unreachable. Please retry.');
        }
        abort_unless($response->successful() || ($allowMissing && $response->status() === 404 && $response->json('code') === 'not_found'), 503, 'The meeting service could not complete this action. Please retry.');

        return $response->successful() ? ($response->json() ?? []) : [];
    }
}
