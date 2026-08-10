<?php

namespace Tests\Feature\Reports;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_available_reports(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/reports')
            ->assertOk()
            ->assertJsonFragment(['key' => 'employee_directory'])
            ->assertJsonFragment(['key' => 'document_compliance'])
            ->assertJsonFragment(['key' => 'leave_balances'])
            ->assertJsonFragment(['key' => 'leave_requests'])
            ->assertJsonFragment(['key' => 'attendance_summary'])
            ->assertJsonFragment(['key' => 'attendance_exceptions']);
    }

    public function test_employee_without_reports_permission_cannot_access_reports(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());

        $this->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/reports/employee_directory')
            ->assertForbidden();
    }

    public function test_employee_directory_report_supports_filters_and_pagination(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/reports/employee_directory?search=EMP-FIN-001&per_page=5')
            ->assertOk()
            ->assertJsonPath('report.key', 'employee_directory')
            ->assertJsonPath('meta.per_page', 5)
            ->assertJsonFragment(['employee_number' => 'EMP-FIN-001']);
    }

    public function test_employee_directory_report_exports_csv_using_filters(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->get('/api/reports/employee_directory/export?search=EMP-FIN-001');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();

        $this->assertStringContainsString('"Employee Number","Full Name","Work Email",Status', $content);
        $this->assertStringContainsString('EMP-FIN-001', $content);
        $this->assertStringNotContainsString('EMP-HR-001', $content);
    }

    public function test_leave_balance_report_returns_available_days(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/reports/leave_balances?search=EMP-FIN-001')
            ->assertOk()
            ->assertJsonPath('report.key', 'leave_balances')
            ->assertJsonFragment(['employee_number' => 'EMP-FIN-001'])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['days_allocated', 'days_used', 'days_pending', 'days_available'],
                ],
            ]);
    }

    public function test_attendance_summary_report_returns_rollups(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/reports/attendance_summary?search=EMP-FIN-001')
            ->assertOk()
            ->assertJsonPath('report.key', 'attendance_summary')
            ->assertJsonFragment(['employee_number' => 'EMP-FIN-001'])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['total_records', 'present_count', 'late_count', 'absent_count', 'worked_minutes'],
                ],
            ]);
    }

    private function admin(): User
    {
        return User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
    }
}
