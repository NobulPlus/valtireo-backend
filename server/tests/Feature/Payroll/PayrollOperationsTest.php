<?php

namespace Tests\Feature\Payroll;

use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\LoanRepayment;
use App\Models\PayrollRun;
use App\Models\PayrollRunItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayrollOperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_operational_inputs_statutory_loans_and_outputs_flow_end_to_end(): void
    {
        Storage::fake('local');
        $this->seed();
        $admin=User::query()->where('email','admin@valtireo.test')->firstOrFail();
        $employee=Employee::query()->where('organization_id',$admin->organization_id)->where('status','active')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->patchJson('/api/payroll/settings',['statutory_rules'=>[
            'pension'=>['enabled'=>true,'employee_rate'=>8,'employer_rate'=>10],
            'paye'=>['enabled'=>false,'version'=>'organization-configured','brackets'=>[]],
            'nhf'=>['enabled'=>false,'employee_rate'=>2.5],
            'overtime'=>['enabled'=>false,'multiplier'=>1.5,'standard_monthly_hours'=>173.33],
        ]])->assertOk();

        $groupId=$this->postJson('/api/payroll/pay-groups',['name'=>'Monthly','code'=>'OPS-MONTHLY','frequency'=>'monthly','pay_day'=>25])->assertCreated()->json('pay_group.id');
        $this->postJson("/api/payroll/employees/{$employee->id}/bank-accounts",['bank_name'=>'Test Bank','bank_code'=>'999','account_number'=>'0123456789','account_name'=>trim("{$employee->first_name} {$employee->last_name}")])->assertCreated();
        $this->postJson("/api/payroll/employees/{$employee->id}/compensations",['pay_group_id'=>$groupId,'base_salary'=>500000,'currency'=>'NGN','pay_frequency'=>'monthly','effective_from'=>'2026-01-01','recurring_components'=>[]])->assertCreated();
        $this->putJson("/api/payroll/employees/{$employee->id}/statutory-profile",['paye_enabled'=>false,'pension_enabled'=>true,'pfa_name'=>'Test PFA','rsa_pin'=>'PEN-123456789'])->assertOk();

        $inputId=$this->postJson('/api/payroll/inputs',['employee_id'=>$employee->id,'type'=>'bonus','description'=>'Performance bonus','effective_date'=>'2026-08-15','amount'=>25000])->assertCreated()->json('payroll_input.id');
        $loanId=$this->postJson('/api/payroll/loans',['employee_id'=>$employee->id,'reference'=>'LOAN-001','name'=>'Staff loan','principal'=>100000,'interest_amount'=>0,'installment_amount'=>20000,'starts_on'=>'2026-08-01'])->assertCreated()->json('loan.id');

        $runId=$this->postJson('/api/payroll/runs',['pay_group_id'=>$groupId,'reference'=>'OPS-2026-08','name'=>'Operations August payroll','period_start'=>'2026-08-01','period_end'=>'2026-08-31','payment_date'=>'2026-08-31','currency'=>'NGN'])->assertCreated()->json('payroll_run.id');
        $this->postJson("/api/payroll/runs/{$runId}/calculate")->assertOk()->assertJsonPath('payroll_run.total_gross',525000)->assertJsonPath('payroll_run.total_deductions',60000)->assertJsonPath('payroll_run.total_net',465000)->assertJsonPath('payroll_run.total_employer_contributions',50000);

        $item=PayrollRunItem::query()->where('payroll_run_id',$runId)->where('employee_id',$employee->id)->firstOrFail();
        $this->assertDatabaseHas('payroll_run_item_lines',['payroll_run_item_id'=>$item->id,'component_code'=>'BONUS:'.$inputId,'amount'=>25000]);
        $this->assertDatabaseHas('payroll_run_item_lines',['payroll_run_item_id'=>$item->id,'component_code'=>'PENSION_EMPLOYEE','amount'=>40000]);
        $this->assertDatabaseHas('payroll_run_item_lines',['payroll_run_item_id'=>$item->id,'component_code'=>'LOAN:'.$loanId,'amount'=>20000]);

        PayrollRun::query()->findOrFail($runId)->update(['status'=>'approved','approved_at'=>now()]);
        $this->postJson("/api/payroll/runs/{$runId}/finalize")->assertOk()->assertJsonPath('payroll_run.status','finalized');
        $this->assertSame(80000.0,(float)EmployeeLoan::query()->findOrFail($loanId)->outstanding_balance);
        $this->assertDatabaseHas('loan_repayments',['employee_loan_id'=>$loanId,'payroll_run_item_id'=>$item->id,'status'=>'posted','amount'=>20000]);

        $batchPath=$this->postJson("/api/payroll/runs/{$runId}/payment-export")->assertCreated()->json('payment_batch.file_path');
        Storage::disk('local')->assertExists($batchPath);
        $this->postJson("/api/payroll/runs/{$runId}/journal")->assertOk()->assertJsonPath('journal.total_debit',575000)->assertJsonPath('journal.total_credit',575000);
        $documentPath=$this->postJson("/api/payroll/run-items/{$item->id}/payslip")->assertOk()->json('document.file_path');
        Storage::disk('local')->assertExists($documentPath);
        $this->getJson('/api/payroll/reports/summary')->assertOk()->assertJsonPath('summary.net',465000);
        $this->getJson('/api/payroll/reports/statutory')->assertOk()->assertJsonFragment(['component_code'=>'PENSION_EMPLOYEE']);

        $this->postJson("/api/payroll/runs/{$runId}/void",['reason'=>'Payment batch was created with an incorrect settlement date.'])->assertOk();
        $this->assertSame(100000.0,(float)EmployeeLoan::query()->findOrFail($loanId)->outstanding_balance);
        $this->assertSame('reversed',LoanRepayment::query()->where('employee_loan_id',$loanId)->firstOrFail()->status);
    }
}
