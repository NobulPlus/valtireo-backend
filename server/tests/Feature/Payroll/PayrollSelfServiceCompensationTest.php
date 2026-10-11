<?php

namespace Tests\Feature\Payroll;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollSelfServiceCompensationTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_view_their_own_compensation_bank_accounts_and_masked_statutory_profile(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $employeeUser = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $employee = $employeeUser->employee;

        Sanctum::actingAs($admin);
        $groupId = $this->postJson('/api/payroll/pay-groups', [
            'name' => 'Self-Service Test', 'code' => 'SELFSERVICE', 'frequency' => 'monthly', 'pay_day' => 25,
        ])->assertCreated()->json('pay_group.id');

        $this->postJson("/api/payroll/employees/{$employee->id}/compensations", [
            'pay_group_id' => $groupId, 'base_salary' => 420000, 'currency' => 'NGN',
            'pay_frequency' => 'monthly', 'effective_from' => '2026-01-01',
        ])->assertCreated();

        $bankAccountId = $this->postJson("/api/payroll/employees/{$employee->id}/bank-accounts", [
            'bank_name' => 'Self Service Bank', 'bank_code' => '044', 'account_number' => '0011223344',
            'account_name' => 'Aisha Bello',
        ])->assertCreated()->json('bank_account.id');
        $this->patchJson("/api/payroll/bank-accounts/{$bankAccountId}", ['verification_status' => 'verified'])->assertOk();

        $this->putJson("/api/payroll/employees/{$employee->id}/statutory-profile", [
            'pension_enabled' => true, 'pfa_name' => 'Test PFA', 'rsa_pin' => 'PEN-900000001',
            'paye_enabled' => true, 'tax_state' => 'Lagos', 'tax_id' => 'TIN-900000001',
        ])->assertOk();

        Sanctum::actingAs($employeeUser);
        $response = $this->getJson('/api/payroll/me/compensation')->assertOk();

        $response->assertJsonPath('compensations.0.base_salary', '420000.00');
        $response->assertJsonPath('compensations.0.status', 'active');
        $response->assertJsonPath('bank_accounts.0.account_number_last_four', '3344');
        $response->assertJsonPath('bank_accounts.0.verification_status', 'verified');
        $response->assertJsonPath('statutory_profile.rsa_pin_last_four', '0001');
        $response->assertJsonPath('statutory_profile.tax_id_last_four', '0001');
        $response->assertJsonPath('statutory_profile.pension_enabled', true);

        // Never leaks the full account number or statutory numbers.
        $response->assertJsonMissing(['account_number' => '0011223344']);
        $raw = $response->json();
        $this->assertStringNotContainsString('0011223344', json_encode($raw));
        $this->assertStringNotContainsString('PEN-900000001', json_encode($raw));
        $this->assertStringNotContainsString('TIN-900000001', json_encode($raw));
    }

    public function test_a_role_with_only_view_others_permission_cannot_use_the_self_service_endpoint(): void
    {
        $this->seed();

        // HR Officer holds payroll.compensation.view (view OTHER employees'
        // records) but not payroll.compensation.view_own — the self-service
        // endpoint is a deliberately separate permission, same scoping this
        // app already uses for payroll.payslips.view_own.
        $hrOfficer = User::query()->where('email', 'kelechi.nwosu@valtireo.test')->firstOrFail();
        Sanctum::actingAs($hrOfficer);

        $this->getJson('/api/payroll/me/compensation')->assertForbidden();
    }

    public function test_a_console_only_user_with_no_employee_record_cannot_use_the_self_service_endpoint(): void
    {
        $this->seed();

        // admin@valtireo.test holds every permission (including the new one)
        // but has no Employee record at all to view compensation for.
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $this->assertNull($admin->employee);
        Sanctum::actingAs($admin);

        $this->getJson('/api/payroll/me/compensation')->assertForbidden();
    }
}
