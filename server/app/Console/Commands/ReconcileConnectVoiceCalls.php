<?php
namespace App\Console\Commands;
use App\Models\ConnectVoiceCall;
use App\Services\ConnectVoiceService;
use Illuminate\Console\Command;
class ReconcileConnectVoiceCalls extends Command
{
    protected $signature = 'connect:reconcile-voice';
    protected $description = 'Expires voice invitations and closes ended or revoked audio rooms.';
    public function handle(ConnectVoiceService $voice): int {
        $failures = 0;
        ConnectVoiceCall::whereNull('room_closed_at')->each(function ($call) use ($voice, &$failures) {
            try { $voice->reconcile($call, checkPresence: true); } catch (\Throwable $e) { report($e); $failures++; }
        });
        return $failures ? self::FAILURE : self::SUCCESS;
    }
}
