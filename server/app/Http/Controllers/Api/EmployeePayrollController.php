<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeBankAccount;
use App\Models\PayGroup;
use App\Models\PayrollComponent;
use App\Models\PayrollRunItem;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeePayrollController extends Controller
{
    public function myPayslips(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.payslips.view_own'), 403);
        $employee = $request->user()->employee;
        abort_unless($employee, 403);
        $items = PayrollRunItem::query()->with(['payrollRun:id,name,reference,period_start,period_end,payment_date,currency,published_at'])
            ->where('organization_id', $request->user()->organization_id)->where('employee_id', $employee->id)
            ->whereHas('payrollRun', fn ($query) => $query->where('status', 'finalized')->whereNotNull('published_at'))
            ->latest('id')->paginate(min(max($request->integer('per_page', 12), 1), 50));
        return response()->json($items);
    }

    public function myPayslip(Request $request, PayrollRunItem $payrollRunItem): JsonResponse
    {
        abort_unless($request->user()->can('payroll.payslips.view_own'), 403);
        abort_unless($payrollRunItem->organization_id === $request->user()->organization_id && $payrollRunItem->employee_id === $request->user()->employee?->id, 404);
        abort_unless($payrollRunItem->payrollRun()->where('status', 'finalized')->whereNotNull('published_at')->exists(), 404);
        return response()->json(['payslip' => $payrollRunItem->load(['payrollRun', 'lines'])]);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.compensation.view'), 403);
        return response()->json([
            'employee' => ['id' => $employee->id, 'employee_number' => $employee->employee_number, 'full_name' => trim(implode(' ', array_filter([$employee->first_name, $employee->middle_name, $employee->last_name])))],
            'compensations' => $employee->compensations()->with(['payGroup', 'createdBy'])->latest('effective_from')->get(),
            'bank_accounts' => $employee->bankAccounts()->get()->map(fn ($account) => [
                'id' => $account->id, 'bank_name' => $account->bank_name, 'bank_code' => $account->bank_code,
                'account_name' => $account->account_name, 'account_number_last_four' => substr($account->account_number, -4),
                'is_primary' => $account->is_primary, 'verification_status' => $account->verification_status,
            ]),
        ]);
    }

    public function storeCompensation(Request $request, Employee $employee, PayrollService $payroll): JsonResponse
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.compensation.manage'), 403);
        $data = $request->validate([
            'pay_group_id' => ['nullable', 'integer'], 'base_salary' => ['required', 'numeric', 'min:0'], 'currency' => ['required', 'string', 'size:3'],
            'pay_frequency' => ['required', Rule::in(['weekly', 'biweekly', 'monthly'])], 'effective_from' => ['required', 'date'],
            'recurring_components' => ['sometimes', 'array'], 'recurring_components.*.component_id' => ['required', 'integer', 'distinct'], 'recurring_components.*.value' => ['nullable', 'numeric', 'min:0'],
        ]);
        if (! empty($data['pay_group_id'])) abort_unless(PayGroup::query()->where('organization_id', $request->user()->organization_id)->whereKey($data['pay_group_id'])->exists(), 422, 'The selected pay group is invalid.');
        foreach (($data['recurring_components'] ?? []) as $entry) abort_unless(PayrollComponent::query()->where('organization_id', $request->user()->organization_id)->whereKey($entry['component_id'])->exists(), 422, 'A payroll component is invalid.');
        return response()->json(['compensation' => $payroll->setCompensation($request->user(), $employee, $data)], 201);
    }

    public function storeBankAccount(Request $request, Employee $employee): JsonResponse
    {
        abort_unless($employee->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.bank_accounts.manage'), 403);
        $data = $request->validate(['bank_name' => ['required', 'string', 'max:255'], 'bank_code' => ['nullable', 'string', 'max:20'], 'account_number' => ['required', 'string', 'min:6', 'max:34'], 'account_name' => ['required', 'string', 'max:255'], 'is_primary' => ['sometimes', 'boolean']]);
        if ($data['is_primary'] ?? true) $employee->bankAccounts()->update(['is_primary' => false]);
        $account = EmployeeBankAccount::query()->create([...$data, 'organization_id' => $request->user()->organization_id, 'employee_id' => $employee->id, 'is_primary' => $data['is_primary'] ?? true]);
        return response()->json(['bank_account' => ['id' => $account->id, 'bank_name' => $account->bank_name, 'account_name' => $account->account_name, 'account_number_last_four' => substr($account->account_number, -4), 'is_primary' => $account->is_primary, 'verification_status' => $account->verification_status]], 201);
    }
}
