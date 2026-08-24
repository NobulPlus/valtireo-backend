<?php

use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use App\Services\ReminderNotificationService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

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

Artisan::command('valtireo:grant-login {employee} {--role=}', function (int $employee, ?string $role = null): int {
    $employeeModel = Employee::query()->find($employee);

    if (! $employeeModel) {
        $this->error("No employee with id {$employee}.");

        return self::FAILURE;
    }

    if ($employeeModel->user_id) {
        $this->error("Employee #{$employeeModel->id} already has a user account.");

        return self::FAILURE;
    }

    $roleModel = null;

    if ($role) {
        $roleModel = Role::query()
            ->where('organization_id', $employeeModel->organization_id)
            ->where(fn ($query) => $query->where('key', $role)->orWhere('name', $role))
            ->first();

        if (! $roleModel) {
            $this->error("No role matching \"{$role}\" in this organization.");

            return self::FAILURE;
        }
    }

    $temporaryPassword = 'Temp@'.Str::random(16).'1';

    $user = DB::transaction(function () use ($employeeModel, $roleModel, $temporaryPassword): User {
        $user = User::query()->create([
            'organization_id' => $employeeModel->organization_id,
            'name' => trim("{$employeeModel->first_name} {$employeeModel->last_name}"),
            'email' => $employeeModel->work_email,
            'password' => $temporaryPassword,
        ]);

        if ($roleModel) {
            app(PermissionRegistrar::class)->setPermissionsTeamId($employeeModel->organization_id);
            $user->syncRoles([$roleModel]);
        }

        $employeeModel->update(['user_id' => $user->id]);

        return $user;
    });

    $this->info("Created login for {$user->email}.");
    $this->line("Temporary password: {$temporaryPassword}");

    return self::SUCCESS;
})->purpose('Grant a login to an already-active employee who has none yet');
