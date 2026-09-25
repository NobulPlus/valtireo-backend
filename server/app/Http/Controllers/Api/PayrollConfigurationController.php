<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayGroup;
use App\Models\PayrollComponent;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PayrollConfigurationController extends Controller
{
    public function settings(Request $request, PayrollService $payroll): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.view'), 403);
        return response()->json(['settings' => $payroll->settingsFor($request->user()->organization_id)]);
    }

    public function updateSettings(Request $request, PayrollService $payroll): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.update'), 403);
        $data = $request->validate([
            'currency' => ['sometimes', 'string', 'size:3'], 'decimal_places' => ['sometimes', 'integer', 'between:0,4'],
            'default_pay_frequency' => ['sometimes', Rule::in(['weekly', 'biweekly', 'monthly'])], 'pay_day' => ['sometimes', 'integer', 'between:1,31'],
            'prorate_joiners' => ['sometimes', 'boolean'], 'prorate_leavers' => ['sometimes', 'boolean'],
            'proration_basis' => ['sometimes', Rule::in(['calendar_days', 'working_days'])], 'statutory_rules' => ['sometimes', 'nullable', 'array'],
            'statutory_rules.pension.enabled' => ['sometimes', 'boolean'], 'statutory_rules.pension.employee_rate' => ['sometimes', 'numeric', 'between:0,100'],
            'statutory_rules.pension.employer_rate' => ['sometimes', 'numeric', 'between:0,100'], 'statutory_rules.pension.version' => ['sometimes', 'nullable', 'string', 'max:100'],
            'statutory_rules.paye.enabled' => ['sometimes', 'boolean'], 'statutory_rules.paye.version' => ['sometimes', 'nullable', 'string', 'max:100'],
            'statutory_rules.paye.effective_from' => ['sometimes', 'nullable', 'date'], 'statutory_rules.paye.brackets' => ['sometimes', 'array'],
            'statutory_rules.paye.brackets.*.amount' => ['nullable', 'numeric', 'gt:0'], 'statutory_rules.paye.brackets.*.rate' => ['required_with:statutory_rules.paye.brackets', 'numeric', 'between:0,100'],
            'statutory_rules.nhf.enabled' => ['sometimes', 'boolean'], 'statutory_rules.nhf.employee_rate' => ['sometimes', 'numeric', 'between:0,100'],
            'statutory_rules.overtime.enabled' => ['sometimes', 'boolean'], 'statutory_rules.overtime.multiplier' => ['sometimes', 'numeric', 'gt:0', 'max:10'],
            'statutory_rules.overtime.standard_monthly_hours' => ['sometimes', 'numeric', 'gt:0'], 'statutory_rules.overtime.minimum_minutes_per_day' => ['sometimes', 'integer', 'min:0'],
            'statutory_rules.overtime.maximum_hours_per_period' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'statutory_rules.overtime.eligible_attendance_statuses' => ['sometimes', 'array'],
            'statutory_rules.overtime.eligible_attendance_statuses.*' => ['string', Rule::in(['present', 'late', 'corrected'])],
            'statutory_rules.accounting' => ['sometimes', 'array'], 'statutory_rules.accounting.*' => ['string', 'max:100'],
        ]);
        $settings = $payroll->settingsFor($request->user()->organization_id);
        if (array_key_exists('statutory_rules', $data) && is_array($data['statutory_rules'])) {
            $data['statutory_rules'] = array_replace_recursive($settings->statutory_rules ?? [], $data['statutory_rules']);
        }
        $settings->update($data);
        return response()->json(['settings' => $settings->refresh()]);
    }

    public function payGroups(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.view'), 403);
        return response()->json(['data' => PayGroup::query()->where('organization_id', $request->user()->organization_id)->orderBy('name')->get()]);
    }

    public function storePayGroup(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.update'), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:255'], 'code' => ['required', 'string', 'max:50'], 'frequency' => ['required', Rule::in(['weekly', 'biweekly', 'monthly'])], 'pay_day' => ['required', 'integer', 'between:1,31'], 'is_active' => ['sometimes', 'boolean']]);
        $data['code'] = strtoupper($data['code']);
        abort_if(PayGroup::query()->where('organization_id', $request->user()->organization_id)->where('code', $data['code'])->exists(), 422, 'A pay group with this code already exists.');
        $group = PayGroup::query()->create([...$data, 'organization_id' => $request->user()->organization_id]);
        return response()->json(['pay_group' => $group], 201);
    }

    public function updatePayGroup(Request $request, PayGroup $payGroup): JsonResponse
    {
        abort_unless($payGroup->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.settings.update'), 403);
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:255'], 'frequency' => ['sometimes', Rule::in(['weekly', 'biweekly', 'monthly'])], 'pay_day' => ['sometimes', 'integer', 'between:1,31'], 'is_active' => ['sometimes', 'boolean']]);
        $payGroup->update($data);
        return response()->json(['pay_group' => $payGroup->refresh()]);
    }

    public function components(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.view'), 403);
        return response()->json(['data' => PayrollComponent::query()->where('organization_id', $request->user()->organization_id)->orderBy('sort_order')->orderBy('name')->get()]);
    }

    public function storeComponent(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.settings.update'), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'], 'code' => ['required', 'string', 'max:50'], 'type' => ['required', Rule::in(['earning', 'deduction', 'employer_contribution'])],
            'calculation_type' => ['required', Rule::in(['fixed', 'percentage'])], 'default_value' => ['required', 'numeric', 'min:0'],
            'percentage_of_component_id' => ['nullable', 'integer'], 'is_taxable' => ['sometimes', 'boolean'], 'is_statutory' => ['sometimes', 'boolean'],
            'is_recurring' => ['sometimes', 'boolean'], 'is_active' => ['sometimes', 'boolean'], 'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
        $data['code'] = strtoupper($data['code']);
        if (! empty($data['percentage_of_component_id'])) {
            abort_unless(PayrollComponent::query()->where('organization_id', $request->user()->organization_id)->whereKey($data['percentage_of_component_id'])->exists(), 422, 'The percentage base component is invalid.');
        }
        abort_if(PayrollComponent::query()->where('organization_id', $request->user()->organization_id)->where('code', $data['code'])->exists(), 422, 'A payroll component with this code already exists.');
        $component = PayrollComponent::query()->create([...$data, 'organization_id' => $request->user()->organization_id]);
        return response()->json(['component' => $component], 201);
    }

    public function updateComponent(Request $request, PayrollComponent $component): JsonResponse
    {
        abort_unless($component->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.settings.update'), 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'], 'type' => ['sometimes', Rule::in(['earning', 'deduction', 'employer_contribution'])],
            'calculation_type' => ['sometimes', Rule::in(['fixed', 'percentage'])], 'default_value' => ['sometimes', 'numeric', 'min:0'],
            'percentage_of_component_id' => ['nullable', 'integer'], 'is_taxable' => ['sometimes', 'boolean'], 'is_statutory' => ['sometimes', 'boolean'],
            'is_recurring' => ['sometimes', 'boolean'], 'is_active' => ['sometimes', 'boolean'], 'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
        if (! empty($data['percentage_of_component_id'])) abort_unless(PayrollComponent::query()->where('organization_id', $request->user()->organization_id)->whereKey($data['percentage_of_component_id'])->where('id', '!=', $component->id)->exists(), 422, 'The percentage base component is invalid.');
        $component->update($data);
        return response()->json(['component' => $component->refresh()]);
    }
}
