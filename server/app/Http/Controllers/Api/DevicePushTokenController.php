<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DevicePushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One row per installed app instance — not per user, since the same person can
 * be signed in on more than one device/phone. A token is only ever meaningful
 * for the account that registered it, so re-registering it (e.g. a different
 * person signing into the same physical device) reassigns ownership rather
 * than erroring, and signing out removes it so a shared/reset device stops
 * receiving a previous occupant's pushes.
 */
class DevicePushTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'platform' => ['required', 'string', 'in:ios,android'],
        ]);

        // The token column is globally unique, not unique-per-user — a plain
        // updateOrCreate scoped through the relation would only look among this
        // user's own rows, then collide with the unique constraint if the token
        // is currently owned by someone else (e.g. a different account signed
        // into the same physical device previously). Reassigning explicitly
        // avoids that.
        DevicePushToken::updateOrCreate(
            ['token' => $data['token']],
            ['user_id' => $request->user()->id, 'platform' => $data['platform']],
        );

        return response()->json(['status' => 'ok']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:255']]);

        $request->user()->devicePushTokens()->where('token', $data['token'])->delete();

        return response()->json(['status' => 'ok']);
    }
}
