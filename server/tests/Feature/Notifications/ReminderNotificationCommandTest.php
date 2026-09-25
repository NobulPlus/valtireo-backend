<?php

namespace Tests\Feature\Notifications;

use App\Models\ApprovalRequest;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmployeeInvitation;
use App\Models\EmploymentType;
use App\Models\LeaveType;
use App\Models\OrganizationLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReminderNotificationCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_reminder_command_sends_document_onboarding_and_pending_approval_reminders_without_duplicates(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('user_id', $employeeUser->id)->firstOrFail();

        EmployeeDocument::query()
            ->where('organization_id', $admin->organization_id)
            ->whereNotNull('expires_at')
            ->firstOrFail()
            ->update([
                'employee_id' => $employee->id,
                'expires_at' => now()->addDays(5),
                'status' => 'approved',
            ]);

        Sanctum::actingAs($admin);
        $this->postJson('/api/employees', [
            'employee_number' => 'EMP-REM-001',
            'first_name' => 'Reminder',
            'last_name' => 'Candidate',
            'work_email' => 'reminder.candidate@example.test',
            'department_id' => Department::query()->where('organization_id', $admin->organization_id)->firstOrFail()->id,
            'designation_id' => Designation::query()->where('organization_id', $admin->organization_id)->firstOrFail()->id,
            'employment_type_id' => EmploymentType::query()->where('organization_id', $admin->organization_id)->firstOrFail()->id,
            'organization_location_id' => OrganizationLocation::query()->where('organization_id', $admin->organization_id)->firstOrFail()->id,
            'send_invitation' => true,
        ])->assertCreated();

        $invitation = EmployeeInvitation::query()
            ->where('email', 'reminder.candidate@example.test')
            ->firstOrFail();
        $invitation->update([
            'created_at' => now()->subDays(4),
        ]);

        $annual = LeaveType::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'ANNUAL')
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);
        $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-10-05',
            'ends_on' => '2026-10-06',
            'reason' => 'Personal time.',
        ])->assertCreated();

        ApprovalRequest::query()
            ->where('organization_id', $admin->organization_id)
            ->where('module', 'leave')
            ->latest()
            ->firstOrFail()
            ->update(['submitted_at' => now()->subDays(3)]);

        $this->artisan('valtireo:send-reminders --document-days=30 --onboarding-days=2 --approval-days=1')
            ->expectsOutput('Reminder notifications processed.')
            ->assertSuccessful();

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $employeeUser->id,
        ]);

        $this->assertSame(1, $employeeUser->notifications()->where('data->event', 'document.expiry_reminder')->count());
        $this->assertGreaterThanOrEqual(1, $admin->notifications()->where('data->event', 'approval.pending_reminder')->count());

        $countAfterFirstRun = $this->notificationCount();

        $this->artisan('valtireo:send-reminders --document-days=30 --onboarding-days=2 --approval-days=1')
            ->assertSuccessful();

        $this->assertSame($countAfterFirstRun, $this->notificationCount());
    }

    private function notificationCount(): int
    {
        return (int) \DB::table('notifications')->count();
    }
}
