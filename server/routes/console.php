<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Services\ReminderNotificationService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('valtireo:send-reminders {--document-days=30} {--onboarding-days=2} {--approval-days=1} {--probation-days=7}', function (ReminderNotificationService $reminders): int {
    $summary = $reminders->send(
        documentDays: (int) $this->option('document-days'),
        onboardingDays: (int) $this->option('onboarding-days'),
        approvalDays: (int) $this->option('approval-days'),
        probationDays: (int) $this->option('probation-days'),
    );

    $this->info('Reminder notifications processed.');

    foreach ($summary as $key => $count) {
        $this->line("{$key}: {$count}");
    }

    return self::SUCCESS;
})->purpose('Send Valtireo reminder and expiry notifications');
