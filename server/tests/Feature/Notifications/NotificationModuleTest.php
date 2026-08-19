<?php

namespace Tests\Feature\Notifications;

use App\Models\ApprovalRequest;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\LeaveType;
use App\Models\OrganizationLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_invitation_creates_notifications_and_api_can_mark_them_read(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = $admin->organization;
        $department = Department::query()->whereBelongsTo($organization)->firstOrFail();
        $designation = Designation::query()->whereBelongsTo($organization)->firstOrFail();
        $employmentType = EmploymentType::query()->whereBelongsTo($organization)->firstOrFail();
        $location = OrganizationLocation::query()->whereBelongsTo($organization)->firstOrFail();

        Sanctum::actingAs($admin);

        $this->postJson('/api/employees', [
            'employee_number' => 'EMP-NOT-001',
            'first_name' => 'Mina',
            'last_name' => 'Stone',
            'work_email' => 'mina.stone@example.test',
            'department_id' => $department->id,
            'designation_id' => $designation->id,
            'employment_type_id' => $employmentType->id,
            'organization_location_id' => $location->id,
            'send_invitation' => true,
        ])->assertCreated();

        $this->getJson('/api/notifications?category=employee_onboarding')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.event', 'employee.invitation_created')
            ->assertJsonPath('data.0.read_at', null);

        $notificationId = $admin->notifications()->firstOrFail()->id;

        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('notification.read_at', fn ($value) => filled($value));

        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 0);
    }

    public function test_leave_approval_flow_creates_approval_notifications(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $annual = LeaveType::query()
            ->where('organization_id', $employeeUser->organization_id)
            ->where('code', 'ANNUAL')
            ->firstOrFail();

        Sanctum::actingAs($employeeUser);

        $this->postJson('/api/leave/requests', [
            'leave_type_id' => $annual->id,
            'starts_on' => '2026-09-14',
            'ends_on' => '2026-09-15',
            'reason' => 'Personal time.',
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/notifications?category=approvals')
            ->assertOk()
            ->assertJsonPath('data.0.event', 'approval.submitted')
            ->assertJsonPath('data.0.entity_type', 'approval_request');

        $approval = ApprovalRequest::query()
            ->where('organization_id', $admin->organization_id)
            ->where('module', 'leave')
            ->latest()
            ->firstOrFail();

        $this->postJson("/api/approvals/{$approval->id}/actions", [
            'action' => 'approve',
        ])->assertOk()
            ->assertJsonPath('approval_request.status', 'approved');

        Sanctum::actingAs($employeeUser);

        $this->getJson('/api/notifications?category=approvals')
            ->assertOk()
            ->assertJsonPath('data.0.event', 'approval.decided')
            ->assertJsonPath('data.0.metadata.status', 'approved');
    }

    public function test_user_cannot_mark_another_users_notification_read(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $admin->notify(new \App\Notifications\ValtireoNotification([
            'organization_id' => $admin->organization_id,
            'category' => 'test',
            'event' => 'test.created',
            'severity' => 'info',
            'title' => 'Private notification',
            'message' => 'Only admin should see this.',
        ]));

        $notificationId = $admin->notifications()->firstOrFail()->id;

        Sanctum::actingAs($employeeUser);

        $this->patchJson("/api/notifications/{$notificationId}/read")
            ->assertNotFound();
    }

    public function test_default_mail_configuration_enables_notification_delivery(): void
    {
        $this->assertTrue(filter_var(env('VALTIREO_MAIL_NOTIFICATIONS', true), FILTER_VALIDATE_BOOLEAN));

        $notification = new \App\Notifications\ValtireoNotification([
            'title' => 'Welcome',
            'message' => 'Your account is ready.',
        ]);

        $this->assertContains('mail', $notification->via(new class
        {
            public string $name = 'Ada';
        }));
    }
}
