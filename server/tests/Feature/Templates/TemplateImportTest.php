<?php

namespace Tests\Feature\Templates;

use App\Models\AttendanceRecord;
use App\Models\DocumentRequirement;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TemplateImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_admin_can_preview_attendance_import_file(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->postJson('/api/templates/attendance_import/preview', [
            'file' => $this->csv('attendance-preview.csv', [
                ['employee_number', 'attendance_date', 'check_in_at', 'check_out_at', 'source', 'work_shift_code', 'status', 'notes'],
                ['EMP-FIN-001', '2026-08-25', '2026-08-25 09:00:00', '2026-08-25 17:00:00', 'import', 'REGULAR', 'present', 'Preview only.'],
            ]),
        ]);

        $response->assertOk()
            ->assertJsonPath('template.key', 'attendance_import')
            ->assertJsonPath('summary.total_rows', 1)
            ->assertJsonPath('summary.valid_rows', 1)
            ->assertJsonPath('summary.invalid_rows', 0)
            ->assertJsonPath('summary.imported_rows', 0);
    }

    public function test_attendance_import_creates_valid_rows_and_reports_failed_rows(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->postJson('/api/templates/attendance_import/import', [
            'file' => $this->csv('attendance-import.csv', [
                ['employee_number', 'attendance_date', 'check_in_at', 'check_out_at', 'source', 'work_shift_code', 'status', 'notes'],
                ['EMP-FIN-001', '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 17:00:00', 'import', 'REGULAR', 'present', 'Imported from test file.'],
                ['UNKNOWN', '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 17:00:00', 'import', 'REGULAR', 'present', 'Should fail.'],
            ]),
        ]);

        $response->assertOk()
            ->assertJsonPath('summary.total_rows', 2)
            ->assertJsonPath('summary.imported_rows', 1)
            ->assertJsonPath('summary.failed_rows', 1)
            ->assertJsonPath('rows.1.errors.employee_number', 'Employee number was not found in this organization.');

        $this->assertDatabaseHas('attendance_records', [
            'employee_id' => Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail()->id,
            'source' => 'import',
        ]);

        $this->assertSame(1, AttendanceRecord::query()->whereDate('attendance_date', '2026-08-26')->count());
    }

    public function test_hr_admin_can_export_failed_import_rows(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->post('/api/templates/attendance_import/failed-rows', [
            'file' => $this->csv('attendance-failed-rows.csv', [
                ['employee_number', 'attendance_date', 'check_in_at', 'check_out_at', 'source', 'work_shift_code', 'status', 'notes'],
                ['EMP-FIN-001', '2026-08-26', '2026-08-26 09:00:00', '2026-08-26 17:00:00', 'import', 'REGULAR', 'present', 'Valid row.'],
                ['UNKNOWN', 'bad-date', 'bad-time', '2026-08-26 17:00:00', 'bad-source', 'MISSING', 'bad-status', 'Should fail.'],
            ]),
        ], ['Accept' => 'text/csv']);

        $response
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition');

        $content = $response->streamedContent();

        $this->assertStringContainsString('errors', $content);
        $this->assertStringContainsString('UNKNOWN', $content);
        $this->assertStringContainsString('employee_number: Employee number was not found in this organization.', $content);
        $this->assertStringNotContainsString('Valid row.', $content);
    }

    public function test_employee_import_creates_employee_record(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->postJson('/api/templates/employee_import/import', [
            'file' => $this->csv('employee-import.csv', [
                ['employee_number', 'first_name', 'middle_name', 'last_name', 'work_email', 'phone', 'department_code', 'unit_code', 'designation_code', 'grade_level_code', 'employment_type_code', 'location_code', 'reporting_manager_number', 'start_date', 'send_invitation'],
                ['EMP-IMP-001', 'Nora', '', 'Stone', 'nora.stone@example.test', '08011112222', 'FIN', 'FIN-PAY', 'OFF', 'GL05', 'PERM', 'HQ', 'EMP-HR-001', '2026-08-20', 'false'],
            ]),
        ]);

        $response->assertOk()
            ->assertJsonPath('summary.imported_rows', 1)
            ->assertJsonPath('summary.failed_rows', 0);

        $this->assertDatabaseHas('employees', [
            'employee_number' => 'EMP-IMP-001',
            'work_email' => 'nora.stone@example.test',
            'status' => 'draft',
        ]);
    }

    public function test_leave_entitlement_import_upserts_entitlement(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->postJson('/api/templates/leave_entitlement_import/import', [
            'file' => $this->csv('leave-entitlement-import.csv', [
                ['employee_number', 'leave_type_code', 'leave_period_name', 'days_allocated', 'notes'],
                ['EMP-FIN-001', 'ANNUAL', '2026 Leave Year', '25', 'Imported entitlement.'],
            ]),
        ]);

        $response->assertOk()
            ->assertJsonPath('summary.imported_rows', 1)
            ->assertJsonPath('summary.failed_rows', 0);

        $employee = Employee::query()->where('employee_number', 'EMP-FIN-001')->firstOrFail();

        $this->assertTrue(LeaveEntitlement::query()
            ->where('employee_id', $employee->id)
            ->where('days_allocated', 25)
            ->where('notes', 'Imported entitlement.')
            ->exists());
    }

    public function test_document_requirement_import_upserts_requirement(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $response = $this->postJson('/api/templates/document_requirement_import/import', [
            'file' => $this->csv('document-requirement-import.csv', [
                ['document_type_code', 'requirement_name', 'description', 'is_required', 'employee_upload_allowed', 'approval_required', 'reminder_days', 'department_code', 'designation_code', 'grade_level_code', 'employment_type_code', 'location_code', 'is_active'],
                ['GOV-ID', 'Imported Government ID', 'Imported requirement.', 'true', 'true', 'true', '30', 'FIN', 'OFF', 'GL05', 'PERM', 'HQ', 'true'],
            ]),
        ]);

        $response->assertOk()
            ->assertJsonPath('summary.imported_rows', 1)
            ->assertJsonPath('summary.failed_rows', 0);

        $this->assertTrue(DocumentRequirement::query()
            ->where('name', 'Imported Government ID')
            ->where('reminder_days', 30)
            ->where('is_active', true)
            ->exists());
    }

    public function test_import_rejects_wrong_template_header(): void
    {
        $this->seed();

        Sanctum::actingAs($this->admin());

        $this->postJson('/api/templates/attendance_import/preview', [
            'file' => $this->csv('bad-header.csv', [
                ['employee_number', 'wrong_column'],
                ['EMP-FIN-001', 'bad'],
            ]),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    private function admin(): User
    {
        return User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
    }

    /**
     * @param array<int, array<int, mixed>> $rows
     */
    private function csv(string $name, array $rows): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'valtireo-csv-');
        $handle = fopen($path, 'w');

        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }

        fclose($handle);

        return new UploadedFile($path, $name, 'text/csv', null, true);
    }
}
