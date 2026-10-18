<?php

namespace App\Console\Commands;

use App\Models\ConnectMeeting;
use App\Services\ConnectLifecycleService;
use Illuminate\Console\Command;

class ReconcileConnectMeetings extends Command
{
    protected $signature = 'connect:reconcile';

    protected $description = 'Close expired/revoked meetings, retry room cleanup and remove unauthorized participants';

    public function handle(ConnectLifecycleService $lifecycle): int
    {
        $failures = 0;
        ConnectMeeting::where(fn ($query) => $query->whereIn('status', ['scheduled', 'live'])
            ->orWhere(fn ($pending) => $pending->whereNotNull('ended_at')->whereNotNull('started_at')->whereNull('room_closed_at')))
            ->chunkById(100, function ($meetings) use ($lifecycle, &$failures) {
                foreach ($meetings as $meeting) {
                    try {
                        $lifecycle->reconcile($meeting->id);
                    } catch (\Throwable $error) {
                        $failures++;
                        // Opaque meeting ID only; never emit media credentials or participant names.
                        $this->error('Connect cleanup failed for '.$meeting->id.' ('.class_basename($error).'). It will retry on the next run.');
                    }
                }
            });

        return $failures ? self::FAILURE : self::SUCCESS;
    }
}
