<?php

namespace Tests\Feature\Templates;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TemplateDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_list_available_import_templates(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/templates')
            ->assertOk()
            ->assertJsonFragment(['key' => 'attendance_import'])
            ->assertJsonFragment(['key' => 'employee_import'])
            ->assertJsonFragment(['key' => 'leave_entitlement_import'])
            ->assertJsonFragment(['key' => 'document_requirement_import']);
    }

    public function test_employee_only_sees_templates_allowed_by_permissions(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->getJson('/api/templates')
            ->assertOk()
            ->assertJsonFragment(['key' => 'attendance_import'])
            ->assertJsonMissing(['key' => 'employee_import'])
            ->assertJsonMissing(['key' => 'leave_entitlement_import'])
            ->assertJsonMissing(['key' => 'document_requirement_import']);
    }

    public function test_template_download_returns_csv_headers_and_sample_row(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->get('/api/templates/attendance_import/download');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();

        $this->assertStringContainsString('employee_number,attendance_date,check_in_at,check_out_at,source,work_shift_code,status,notes', $content);
        $this->assertStringContainsString('EMP-FIN-001,2026-08-20', $content);
    }

    public function test_user_cannot_download_template_without_permission(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->get('/api/templates/employee_import/download')
            ->assertForbidden();
    }
}
