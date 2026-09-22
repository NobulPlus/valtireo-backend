<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayGroup;
use App\Models\PayrollRun;
use App\Services\PayrollService;
use App\Services\PayrollOperationsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollRunController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.view'), 403);
        $runs = PayrollRun::query()->with('payGroup')->where('organization_id', $request->user()->organization_id)
            ->when($request->string('status')->toString(), fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->date('date_from'), fn (Builder $q, $date) => $q->whereDate('period_start', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $q, $date) => $q->whereDate('period_end', '<=', $date->toDateString()))
            ->latest('period_end')->paginate(min(max($request->integer('per_page', 15), 1), 100));
        return response()->json($runs);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.manage'), 403);
        $data = $request->validate(['pay_group_id' => ['nullable', 'integer'], 'reference' => ['required', 'string', 'max:100'], 'name' => ['required', 'string', 'max:255'], 'period_start' => ['required', 'date'], 'period_end' => ['required', 'date', 'after_or_equal:period_start'], 'payment_date' => ['required', 'date', 'after_or_equal:period_end'], 'currency' => ['required', 'string', 'size:3']]);
        if (! empty($data['pay_group_id'])) abort_unless(PayGroup::query()->where('organization_id', $request->user()->organization_id)->whereKey($data['pay_group_id'])->exists(), 422, 'The selected pay group is invalid.');
        abort_if(PayrollRun::query()->where('organization_id', $request->user()->organization_id)->where('reference', $data['reference'])->exists(), 422, 'A payroll run with this reference already exists.');
        $run = PayrollRun::query()->create([...$data, 'organization_id' => $request->user()->organization_id, 'created_by_id' => $request->user()->id, 'status' => 'draft']);
        return response()->json(['payroll_run' => $run->load('payGroup')], 201);
    }

    public function show(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        abort_unless($payrollRun->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.runs.view'), 403);
        return response()->json(['payroll_run' => $payrollRun->load(['payGroup', 'createdBy', 'finalizedBy', 'items.lines'])]);
    }

    public function calculate(Request $request, PayrollRun $payrollRun, PayrollService $payroll): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.manage'), 403);
        return response()->json(['payroll_run' => $payroll->calculate($request->user(), $payrollRun)]);
    }

    public function submit(Request $request, PayrollRun $payrollRun, PayrollService $payroll): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.submit'), 403);
        return response()->json(['payroll_run' => $payroll->submit($request->user(), $payrollRun)]);
    }

    public function finalize(Request $request, PayrollRun $payrollRun, PayrollService $payroll): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.finalize'), 403);
        return response()->json(['payroll_run' => $payroll->finalize($request->user(), $payrollRun)]);
    }

    public function void(Request $request, PayrollRun $payrollRun, PayrollOperationsService $operations): JsonResponse
    {
        abort_unless($payrollRun->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.runs.finalize'), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:2000']]);
        abort_unless(in_array($payrollRun->status, ['approved', 'finalized'], true), 422, 'Only an approved or finalized payroll run can be voided.');
        if ($payrollRun->status === 'finalized') $operations->reverseFinalizedLoanRepayments($payrollRun);
        $payrollRun->update(['status' => 'voided', 'voided_at' => now(), 'void_reason' => $data['reason'], 'published_at' => null, 'published_by_id' => null]);
        return response()->json(['payroll_run' => $payrollRun->refresh()]);
    }

    public function publish(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        abort_unless($payrollRun->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.runs.finalize'), 403);
        abort_unless($payrollRun->status === 'finalized', 422, 'Only a finalized payroll run can be published.');
        $payrollRun->update(['published_by_id' => $request->user()->id, 'published_at' => now()]);
        return response()->json(['payroll_run' => $payrollRun->refresh()]);
    }
}
