<?php

namespace Tests\Feature\Calendar;

use App\Models\CompanyEvent;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CompanyEventTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_director_can_create_organization_wide_event_and_notify_active_employees(): void
    {
        $this->seed();

        $hrDirector = User::query()->where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrDirector);

        $eventId = $this->postJson('/api/company-events', [
            'title' => 'All Hands Review',
            'description' => 'Quarterly operating review.',
            'starts_on' => '2026-10-05',
            'ends_on' => '2026-10-05',
        ])
            ->assertCreated()
            ->assertJsonPath('company_event.scope', 'organization')
            ->assertJsonPath('company_event.department', null)
            ->assertJsonPath('company_event.can_manage', true)
            ->json('company_event.id');

        $this->assertDatabaseHas('company_events', [
            'id' => $eventId,
            'organization_id' => $hrDirector->organization_id,
            'department_id' => null,
            'title' => 'All Hands Review',
            'is_active' => true,
        ]);
        $this->assertSame(
            Employee::query()
                ->where('organization_id', $hrDirector->organization_id)
                ->where('status', 'active')
                ->whereNotNull('user_id')
                ->count() - 1,
            DB::table('notifications')
                ->where('data->event', 'company_event.published')
                ->where('data->entity_id', $eventId)
                ->count()
        );
    }

    public function test_department_head_can_create_event_for_own_department_only(): void
    {
        $this->seed();

        $departmentHead = User::query()->where('email', 'samuel.eze@valtireo.test')->firstOrFail();
        $ownDepartment = $departmentHead->employee->department;
        $otherDepartment = Department::query()
            ->where('organization_id', $departmentHead->organization_id)
            ->whereKeyNot($ownDepartment->id)
            ->firstOrFail();

        $ownDepartment->update(['head_employee_id' => $departmentHead->employee->id]);

        Sanctum::actingAs($departmentHead);

        $this->postJson('/api/company-events', [
            'department_id' => $ownDepartment->id,
            'title' => 'ICT Maintenance Window',
            'starts_on' => '2026-10-06',
            'ends_on' => '2026-10-06',
        ])
            ->assertCreated()
            ->assertJsonPath('company_event.scope', 'department')
            ->assertJsonPath('company_event.department.id', $ownDepartment->id)
            ->assertJsonPath('company_event.can_manage', true);

        $this->postJson('/api/company-events', [
            'department_id' => $otherDepartment->id,
            'title' => 'Wrong Department Event',
            'starts_on' => '2026-10-07',
            'ends_on' => '2026-10-07',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['department_id']);

        $this->postJson('/api/company-events', [
            'title' => 'Org Wide Attempt',
            'starts_on' => '2026-10-08',
            'ends_on' => '2026-10-08',
        ])->assertForbidden();
    }

    public function test_non_head_employee_cannot_create_company_event(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee->employee->department()->update(['head_employee_id' => null]);
        Sanctum::actingAs($employee);

        $this->postJson('/api/company-events', [
            'department_id' => $employee->employee->department_id,
            'title' => 'Finance Desk Sync',
            'starts_on' => '2026-10-09',
            'ends_on' => '2026-10-09',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['department_id']);
    }

    public function test_employee_sees_organization_events_and_own_department_events_only(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $ownDepartment = $employee->employee->department;
        $otherDepartment = Department::query()
            ->where('organization_id', $employee->organization_id)
            ->whereKeyNot($ownDepartment->id)
            ->firstOrFail();

        $organizationEvent = $this->event($admin, null, 'Organization Townhall', '2026-10-10');
        $departmentEvent = $this->event($admin, $ownDepartment, 'Finance Close Day', '2026-10-11');
        $otherDepartmentEvent = $this->event($admin, $otherDepartment, 'ICT Release Review', '2026-10-12');

        Sanctum::actingAs($employee);

        $this->getJson('/api/company-events?date_from=2026-10-01&date_to=2026-10-31')
            ->assertOk()
            ->assertJsonFragment(['id' => $organizationEvent->id, 'title' => 'Organization Townhall'])
            ->assertJsonFragment(['id' => $departmentEvent->id, 'title' => 'Finance Close Day'])
            ->assertJsonMissing(['id' => $otherDepartmentEvent->id, 'title' => 'ICT Release Review']);
    }

    public function test_calendar_filters_by_overlapping_date_range_and_hides_inactive_events_from_employees(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        $visible = CompanyEvent::query()->create([
            'organization_id' => $admin->organization_id,
            'department_id' => null,
            'created_by_user_id' => $admin->id,
            'title' => 'Multi Day Planning',
            'starts_on' => '2026-10-15',
            'ends_on' => '2026-10-17',
            'is_active' => true,
        ]);
        $outsideRange = $this->event($admin, null, 'November Planning', '2026-11-01');
        $inactive = CompanyEvent::query()->create([
            'organization_id' => $admin->organization_id,
            'department_id' => null,
            'created_by_user_id' => $admin->id,
            'title' => 'Cancelled Event',
            'starts_on' => '2026-10-16',
            'ends_on' => '2026-10-16',
            'is_active' => false,
        ]);

        Sanctum::actingAs($employee);

        $this->getJson('/api/company-events?date_from=2026-10-16&date_to=2026-10-16')
            ->assertOk()
            ->assertJsonFragment(['id' => $visible->id, 'title' => 'Multi Day Planning'])
            ->assertJsonMissing(['id' => $outsideRange->id, 'title' => 'November Planning'])
            ->assertJsonMissing(['id' => $inactive->id, 'title' => 'Cancelled Event']);
    }

    public function test_company_events_are_isolated_by_organization(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::factory()->create(['code' => 'CAL-OTHER']);
        $otherAdmin = User::factory()->create(['organization_id' => $otherOrganization->id]);
        $otherEvent = CompanyEvent::query()->create([
            'organization_id' => $otherOrganization->id,
            'department_id' => null,
            'created_by_user_id' => $otherAdmin->id,
            'title' => 'Other Company Event',
            'starts_on' => '2026-10-18',
            'ends_on' => '2026-10-18',
            'is_active' => true,
        ]);

        Sanctum::actingAs($employee);

        $this->getJson('/api/company-events?date_from=2026-10-01&date_to=2026-10-31')
            ->assertOk()
            ->assertJsonMissing(['id' => $otherEvent->id, 'title' => 'Other Company Event']);

        $this->patchJson("/api/company-events/{$otherEvent->id}", [
            'title' => 'Hijacked Event',
        ])->assertNotFound();

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/company-events/{$otherEvent->id}")
            ->assertNotFound();
    }

    public function test_manage_permission_holder_can_update_and_deactivate_event(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $event = $this->event($admin, null, 'Original Event', '2026-10-13');

        Sanctum::actingAs($admin);

        $this->patchJson("/api/company-events/{$event->id}", [
            'title' => 'Updated Event',
            'ends_on' => '2026-10-14',
        ])
            ->assertOk()
            ->assertJsonPath('company_event.title', 'Updated Event')
            ->assertJsonPath('company_event.ends_on', '2026-10-14T00:00:00.000000Z');

        $this->deleteJson("/api/company-events/{$event->id}")
            ->assertOk()
            ->assertJsonPath('company_event.is_active', false);

        $this->assertDatabaseHas('company_events', [
            'id' => $event->id,
            'is_active' => false,
        ]);
    }

    private function event(User $creator, ?Department $department, string $title, string $date): CompanyEvent
    {
        return CompanyEvent::query()->create([
            'organization_id' => $creator->organization_id,
            'department_id' => $department?->id,
            'created_by_user_id' => $creator->id,
            'title' => $title,
            'starts_on' => $date,
            'ends_on' => $date,
            'is_active' => true,
        ]);
    }
}
