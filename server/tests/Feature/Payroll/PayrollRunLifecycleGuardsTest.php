<?php

namespace Tests\Feature\Payroll;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\PayrollRun;
use App\Models\PayrollRunItem;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * PayrollFoundationTest and PayrollOperationsTest already cover the happy
 * path for every lifecycle action end-to-end. This file covers what those
 * don't: the negative/guard paths on finalize, void, payment-export,
 * journal, and payslip generation/download — the highest-stakes actions in
 * the module, since they move real money and compliance data.
 */
class PayrollRunLifecycleGuardsTest extends TestCase
{
    use RefreshDatabase;

    private function setUpCalculatedRun(Employee $employee, string $reference, bool $verifyBank = true): int
    {
        // Scoped to a fresh pay group so calculate() only ever touches this
        // one employee, not every other seeded demo employee in the org
        // (who have no bank account/compensation and would otherwise trip
        // payment-export's "every employee needs a bank snapshot" guard).
        $groupId = $this->postJson('/api/payroll/pay-groups', [
            'name' => $reference, 'code' => $reference, 'frequency' => 'monthly', 'pay_day' => 25,
        ])->assertCreated()->json('pay_group.id');

        $bankAccountId = $this->postJson("/api/payroll/employees/{$employee->id}/bank-accounts", [
            'bank_name' => 'Test Bank', 'bank_code' => '999', 'account_number' => '0123456789',
            'account_name' => trim("{$employee->first_name} {$employee->last_name}"),
        ])->assertCreated()->json('bank_account.id');

        if ($verifyBank) {
            $this->patchJson("/api/payroll/bank-accounts/{$bankAccountId}", ['verification_status' => 'verified'])->assertOk();
        }

        $this->postJson("/api/payroll/employees/{$employee->id}/compensations", [
            'pay_group_id' => $groupId, 'base_salary' => 500000, 'currency' => 'NGN', 'pay_frequency' => 'monthly', 'effective_from' => '2026-01-01',
        ])->assertCreated();

        $runId = $this->postJson('/api/payroll/runs', [
            'pay_group_id' => $groupId, 'reference' => $reference, 'name' => "{$reference} payroll",
            'period_start' => '2026-08-01', 'period_end' => '2026-08-31', 'payment_date' => '2026-08-31', 'currency' => 'NGN',
        ])->assertCreated()->json('payroll_run.id');

        $this->postJson("/api/payroll/runs/{$runId}/calculate")->assertOk();

        return $runId;
    }

    public function test_finalize_requires_an_approved_run(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-FINALIZE');

        $this->postJson("/api/payroll/runs/{$runId}/finalize")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_void_requires_an_approved_or_finalized_run(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-VOID-STATUS');

        $this->postJson("/api/payroll/runs/{$runId}/void", ['reason' => 'Testing an invalid void transition.'])
            ->assertUnprocessable();
    }

    public function test_payment_export_journal_and_payslip_require_a_finalized_run(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-OUTPUTS-STATUS');
        $item = PayrollRunItem::query()->where('payroll_run_id', $runId)->firstOrFail();

        $this->postJson("/api/payroll/runs/{$runId}/payment-export")->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->postJson("/api/payroll/runs/{$runId}/journal")->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->postJson("/api/payroll/run-items/{$item->id}/payslip")->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_payment_export_blocks_when_a_bank_account_is_unverified(): void
    {
        Storage::fake('local');
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-UNVERIFIED', verifyBank: false);
        PayrollRun::query()->findOrFail($runId)->update(['status' => 'approved', 'approved_at' => now()]);
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertOk();

        $this->postJson("/api/payroll/runs/{$runId}/payment-export")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('bank_accounts');
    }

    public function test_voiding_a_finalized_run_with_a_paid_payment_batch_is_blocked(): void
    {
        Storage::fake('local');
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-PAID-VOID');
        PayrollRun::query()->findOrFail($runId)->update(['status' => 'approved', 'approved_at' => now()]);
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertOk();
        $batchId = $this->postJson("/api/payroll/runs/{$runId}/payment-export")->assertCreated()->json('payment_batch.id');
        $this->postJson("/api/payroll/payment-batches/{$batchId}/mark-paid")->assertOk()->assertJsonPath('payment_batch.status', 'paid');

        // A second mark-paid on an already-paid batch must not silently succeed.
        $this->postJson("/api/payroll/payment-batches/{$batchId}/mark-paid")->assertUnprocessable();

        $this->postJson("/api/payroll/runs/{$runId}/void", ['reason' => 'Attempting to void a run that has already been paid.'])
            ->assertUnprocessable();

        $this->assertDatabaseHas('payroll_runs', ['id' => $runId, 'status' => 'finalized']);
        $this->assertDatabaseHas('payroll_payment_batches', ['id' => $batchId, 'status' => 'paid']);
    }

    public function test_payroll_actions_require_their_specific_permissions(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employee = Employee::query()->where('organization_id', $admin->organization_id)->where('status', 'active')->firstOrFail();
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($employee, 'GUARD-PERMS');
        PayrollRun::query()->findOrFail($runId)->update(['status' => 'approved', 'approved_at' => now()]);
        $item = PayrollRunItem::query()->where('payroll_run_id', $runId)->firstOrFail();

        // HR Officer holds payroll.runs.view only — every write action below is out of reach.
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrOfficer);

        $this->postJson("/api/payroll/runs/{$runId}/calculate")->assertForbidden();
        $this->postJson("/api/payroll/runs/{$runId}/submit")->assertForbidden();
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertForbidden();
        $this->postJson("/api/payroll/runs/{$runId}/void", ['reason' => 'Should not be allowed.'])->assertForbidden();
        $this->postJson("/api/payroll/runs/{$runId}/payment-export")->assertForbidden();
        $this->postJson("/api/payroll/runs/{$runId}/journal")->assertForbidden();
        $this->postJson("/api/payroll/run-items/{$item->id}/payslip")->assertForbidden();
    }

    public function test_employee_sees_their_payslip_only_after_the_run_is_published_and_never_someone_elses(): void
    {
        Storage::fake('local');
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $aisha = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $aishaEmployee = $aisha->employee;
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($aishaEmployee, 'GUARD-SELF-SERVICE');
        PayrollRun::query()->findOrFail($runId)->update(['status' => 'approved', 'approved_at' => now()]);
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertOk();
        $item = PayrollRunItem::query()->where('payroll_run_id', $runId)->where('employee_id', $aishaEmployee->id)->firstOrFail();

        Sanctum::actingAs($aisha);
        $this->getJson('/api/payroll/me/payslips')->assertOk()->assertJsonMissing(['id' => $item->id]);
        $this->getJson("/api/payroll/me/payslips/{$item->id}")->assertNotFound();

        Sanctum::actingAs($admin);
        $this->postJson("/api/payroll/runs/{$runId}/publish")->assertOk();

        Sanctum::actingAs($aisha);
        $this->getJson('/api/payroll/me/payslips')->assertOk()->assertJsonFragment(['id' => $item->id]);
        $this->getJson("/api/payroll/me/payslips/{$item->id}")->assertOk()->assertJsonPath('payslip.id', $item->id);

        // Another plain employee (also holds payroll.payslips.view_own) must never see Aisha's payslip.
        $otherUser = User::factory()->create(['organization_id' => $admin->organization_id]);
        $otherEmployee = Employee::factory()->create([
            'organization_id' => $admin->organization_id, 'user_id' => $otherUser->id, 'status' => 'active',
        ]);
        app(PermissionRegistrar::class)->setPermissionsTeamId($admin->organization_id);
        $employeeRole = Role::query()->where('organization_id', $admin->organization_id)->where('key', 'employee')->firstOrFail();
        $otherUser->syncRoles([$employeeRole]);

        Sanctum::actingAs($otherUser);
        $this->getJson("/api/payroll/me/payslips/{$item->id}")->assertNotFound();
    }

    public function test_downloading_payment_batch_and_payslip_files(): void
    {
        Storage::fake('local');
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $aisha = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $aishaEmployee = $aisha->employee;
        Sanctum::actingAs($admin);

        $runId = $this->setUpCalculatedRun($aishaEmployee, 'GUARD-DOWNLOAD');
        PayrollRun::query()->findOrFail($runId)->update(['status' => 'approved', 'approved_at' => now()]);
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertOk();
        $item = PayrollRunItem::query()->where('payroll_run_id', $runId)->firstOrFail();
        $batchId = $this->postJson("/api/payroll/runs/{$runId}/payment-export")->assertCreated()->json('payment_batch.id');

        $this->get("/api/payroll/payment-batches/{$batchId}/download")->assertOk();

        // Not yet published — Aisha's own employee-visibility guard must still 404 the file.
        Sanctum::actingAs($aisha);
        $this->get("/api/payroll/run-items/{$item->id}/payslip/download")->assertNotFound();

        Sanctum::actingAs($admin);
        $this->postJson("/api/payroll/runs/{$runId}/publish")->assertOk();

        Sanctum::actingAs($aisha);
        $this->get("/api/payroll/run-items/{$item->id}/payslip/download")->assertOk();
    }

    public function test_payroll_write_actions_are_isolated_between_organizations(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $otherOrganization = Organization::factory()->create();
        $otherRun = PayrollRun::query()->create([
            'organization_id' => $otherOrganization->id, 'reference' => 'PRIVATE-GUARD', 'name' => 'Private payroll',
            'period_start' => '2026-08-01', 'period_end' => '2026-08-31', 'payment_date' => '2026-08-31',
            'currency' => 'NGN', 'status' => 'approved', 'approved_at' => now(),
        ]);
        $otherEmployee = Employee::factory()->create(['organization_id' => $otherOrganization->id, 'status' => 'active']);
        $otherItem = $otherRun->items()->create([
            'organization_id' => $otherOrganization->id, 'employee_id' => $otherEmployee->id,
            'employee_number' => 'OTHER-001', 'employee_name' => 'Other Org Employee', 'employment_snapshot' => [],
            'period_days' => 30, 'payable_days' => 30, 'base_pay' => 100000, 'gross_pay' => 100000,
            'total_deductions' => 0, 'net_pay' => 100000, 'employer_contributions' => 0, 'status' => 'calculated',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/payroll/runs/{$otherRun->id}/finalize")->assertNotFound();
        $this->postJson("/api/payroll/runs/{$otherRun->id}/void", ['reason' => 'Cross-tenant void attempt.'])->assertNotFound();
        $this->postJson("/api/payroll/runs/{$otherRun->id}/payment-export")->assertNotFound();
        $this->postJson("/api/payroll/runs/{$otherRun->id}/journal")->assertNotFound();
        $this->postJson("/api/payroll/run-items/{$otherItem->id}/payslip")->assertNotFound();
    }
}
