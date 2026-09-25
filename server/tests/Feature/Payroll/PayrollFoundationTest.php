<?php

namespace Tests\Feature\Payroll;

use App\Models\ApprovalRequest;
use App\Models\Employee;
use App\Models\Organization;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_configure_calculate_approve_and_finalize_payroll(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $groupId = $this->postJson('/api/payroll/pay-groups', [
            'name' => 'Monthly payroll', 'code' => 'MONTHLY', 'frequency' => 'monthly', 'pay_day' => 25,
        ])->assertCreated()->json('pay_group.id');

        $allowanceId = $this->postJson('/api/payroll/components', [
            'name' => 'Housing allowance', 'code' => 'HOUSING', 'type' => 'earning',
            'calculation_type' => 'fixed', 'default_value' => 50000, 'is_taxable' => true,
        ])->assertCreated()->json('component.id');

        $bankAccountId = $this->postJson("/api/payroll/employees/{$employee->id}/bank-accounts", [
            'bank_name' => 'Test Bank', 'bank_code' => '999', 'account_number' => '0123456789',
            'account_name' => trim("{$employee->first_name} {$employee->last_name}"),
        ])->assertCreated()->assertJsonPath('bank_account.account_number_last_four', '6789')->json('bank_account.id');

        $this->postJson("/api/payroll/employees/{$employee->id}/compensations", [
            'pay_group_id' => $groupId, 'base_salary' => 500000, 'currency' => 'NGN',
            'pay_frequency' => 'monthly', 'effective_from' => '2026-01-01',
            'recurring_components' => [['component_id' => $allowanceId, 'value' => 50000]],
        ])->assertCreated();

        $runId = $this->postJson('/api/payroll/runs', [
            'pay_group_id' => $groupId, 'reference' => 'PAY-2026-08', 'name' => 'August 2026 payroll',
            'period_start' => '2026-08-01', 'period_end' => '2026-08-31', 'payment_date' => '2026-08-31', 'currency' => 'NGN',
        ])->assertCreated()->json('payroll_run.id');

        $this->getJson("/api/payroll/runs/{$runId}/readiness")
            ->assertOk()
            ->assertJsonPath('readiness.ready', false)
            ->assertJsonPath('readiness.issues.0.issues.0', 'unverified_bank_account');
        $this->patchJson("/api/payroll/bank-accounts/{$bankAccountId}", ['verification_status' => 'verified'])->assertOk();
        $this->getJson("/api/payroll/runs/{$runId}/readiness")->assertOk()->assertJsonPath('readiness.ready', true);

        $this->postJson("/api/payroll/runs/{$runId}/calculate")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'calculated')
            ->assertJsonPath('payroll_run.employee_count', 1)
            ->assertJsonPath('payroll_run.total_gross', 550000)
            ->assertJsonPath('payroll_run.total_net', 550000);

        $this->postJson("/api/payroll/runs/{$runId}/submit")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'pending_approval');

        $approval = ApprovalRequest::query()->where('approvable_type', PayrollRun::class)->where('approvable_id', $runId)->firstOrFail();
        $this->postJson("/api/approvals/{$approval->id}/actions", ['action' => 'approve', 'note' => 'Payroll checked.'])
            ->assertOk();

        $this->postJson("/api/payroll/runs/{$runId}/finalize")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'finalized');

        $this->postJson("/api/payroll/runs/{$runId}/publish")
            ->assertOk()
            ->assertJsonPath('payroll_run.status', 'finalized')
            ->assertJsonPath('payroll_run.published_by_id', $admin->id);

        $this->assertDatabaseHas('payroll_runs', ['id' => $runId, 'status' => 'finalized', 'published_by_id' => $admin->id]);
        $this->assertDatabaseHas('payroll_run_item_lines', ['component_code' => 'BASIC', 'amount' => 500000]);
        $this->assertDatabaseHas('payroll_run_item_lines', ['component_code' => 'HOUSING', 'amount' => 50000]);
    }

    public function test_calculated_run_with_employee_exceptions_cannot_be_submitted(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->postJson('/api/payroll/runs', [
            'reference' => 'PAY-EXCEPTIONS', 'name' => 'Exception payroll',
            'period_start' => '2026-08-01', 'period_end' => '2026-08-31', 'payment_date' => '2026-08-31', 'currency' => 'NGN',
        ])->assertCreated()->json('payroll_run.id');

        $this->postJson("/api/payroll/runs/{$runId}/calculate")->assertOk();
        $this->postJson("/api/payroll/runs/{$runId}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('employees');
    }

    public function test_payroll_records_are_isolated_between_organizations(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::factory()->create();
        $otherRun = PayrollRun::query()->create([
            'organization_id' => $otherOrganization->id, 'reference' => 'PRIVATE-PAYROLL', 'name' => 'Private payroll',
            'period_start' => '2026-08-01', 'period_end' => '2026-08-31', 'payment_date' => '2026-08-31',
            'currency' => 'NGN', 'status' => 'draft',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/payroll/runs/{$otherRun->id}")->assertNotFound();
        $this->getJson('/api/payroll/runs')->assertOk()->assertJsonMissing(['reference' => 'PRIVATE-PAYROLL']);
    }
}
