<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\EmployeeStatutoryProfile;
use App\Models\PayrollComponent;
use App\Models\PayrollInput;
use App\Models\PayrollJournalBatch;
use App\Models\PayrollPaymentBatch;
use App\Models\PayrollRun;
use App\Models\PayrollRunItem;
use App\Models\LoanRepayment;
use App\Services\PayrollOutputService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollOperationsController extends Controller
{
    public function inputs(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.manage'),403);
        $query=PayrollInput::query()->with(['employee','component'])->where('organization_id',$request->user()->organization_id)
            ->when($request->integer('employee_id'),fn($q,$id)=>$q->where('employee_id',$id))->when($request->string('status')->toString(),fn($q,$s)=>$q->where('status',$s));
        return response()->json($query->latest('effective_date')->paginate(min(max($request->integer('per_page',15),1),100)));
    }

    public function storeInput(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.runs.manage'),403);
        $data=$request->validate(['employee_id'=>['required','integer'],'payroll_component_id'=>['nullable','integer'],'type'=>['required',Rule::in(['bonus','allowance','deduction','reimbursement','adjustment'])],'description'=>['required','string','max:255'],'effective_date'=>['required','date'],'quantity'=>['sometimes','numeric','min:0'],'rate'=>['sometimes','numeric','min:0'],'amount'=>['required','numeric','min:0'],'metadata'=>['sometimes','array']]);
        abort_unless(Employee::query()->where('organization_id',$request->user()->organization_id)->whereKey($data['employee_id'])->exists(),422,'The selected employee is invalid.');
        if(!empty($data['payroll_component_id']))abort_unless(PayrollComponent::query()->where('organization_id',$request->user()->organization_id)->whereKey($data['payroll_component_id'])->exists(),422,'The selected component is invalid.');
        $input=PayrollInput::query()->create([...$data,'organization_id'=>$request->user()->organization_id,'created_by_id'=>$request->user()->id,'status'=>'approved']);
        return response()->json(['payroll_input'=>$input],201);
    }

    public function updateInput(Request $request, PayrollInput $payrollInput): JsonResponse
    {
        abort_unless($payrollInput->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.runs.manage'), 403);
        abort_unless($payrollInput->status === 'approved' && $payrollInput->payroll_run_id === null, 422, 'Only an unused payroll input can be changed.');
        $data = $request->validate([
            'description' => ['sometimes', 'string', 'max:255'], 'effective_date' => ['sometimes', 'date'],
            'quantity' => ['sometimes', 'numeric', 'min:0'], 'rate' => ['sometimes', 'numeric', 'min:0'],
            'amount' => ['sometimes', 'numeric', 'min:0'], 'status' => ['sometimes', Rule::in(['approved', 'cancelled'])],
        ]);
        $payrollInput->update($data);
        return response()->json(['payroll_input' => $payrollInput->refresh()]);
    }

    public function statutoryProfile(Request $request, Employee $employee): JsonResponse
    {
        abort_unless($employee->organization_id===$request->user()->organization_id,404);abort_unless($request->user()->can('payroll.compensation.view'),403);
        $profile=EmployeeStatutoryProfile::query()->firstOrCreate(['employee_id'=>$employee->id],['organization_id'=>$employee->organization_id]);
        return response()->json(['statutory_profile'=>$this->maskedProfile($profile)]);
    }

    public function updateStatutoryProfile(Request $request, Employee $employee): JsonResponse
    {
        abort_unless($employee->organization_id===$request->user()->organization_id,404);abort_unless($request->user()->can('payroll.compensation.manage'),403);
        $data=$request->validate(['paye_enabled'=>['sometimes','boolean'],'tax_state'=>['nullable','string','max:100'],'tax_id'=>['nullable','string','max:100'],'pension_enabled'=>['sometimes','boolean'],'pfa_name'=>['nullable','string','max:255'],'rsa_pin'=>['nullable','string','max:100'],'nhf_enabled'=>['sometimes','boolean'],'nhf_number'=>['nullable','string','max:100'],'reliefs'=>['sometimes','array'],'reliefs.*.name'=>['required_with:reliefs','string'],'reliefs.*.annual_amount'=>['required_with:reliefs','numeric','min:0'],'exemptions'=>['sometimes','array']]);
        $profile=EmployeeStatutoryProfile::query()->updateOrCreate(['employee_id'=>$employee->id],['organization_id'=>$employee->organization_id,...$data]);
        return response()->json(['statutory_profile'=>$this->maskedProfile($profile)]);
    }

    public function loans(Request $request): JsonResponse
    { abort_unless($request->user()->can('payroll.compensation.view'),403); return response()->json(EmployeeLoan::query()->with('employee')->where('organization_id',$request->user()->organization_id)->latest()->paginate(min(max($request->integer('per_page',15),1),100))); }

    public function storeLoan(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.compensation.manage'),403);
        $data=$request->validate(['employee_id'=>['required','integer'],'reference'=>['required','string','max:100'],'name'=>['required','string','max:255'],'principal'=>['required','numeric','gt:0'],'interest_amount'=>['sometimes','numeric','min:0'],'installment_amount'=>['required','numeric','gt:0'],'starts_on'=>['required','date'],'ends_on'=>['nullable','date','after_or_equal:starts_on']]);
        abort_unless(Employee::query()->where('organization_id',$request->user()->organization_id)->whereKey($data['employee_id'])->exists(),422,'The selected employee is invalid.');
        $total=(float)$data['principal']+(float)($data['interest_amount']??0);$loan=EmployeeLoan::query()->create([...$data,'organization_id'=>$request->user()->organization_id,'total_repayable'=>$total,'outstanding_balance'=>$total,'created_by_id'=>$request->user()->id]);
        return response()->json(['loan'=>$loan],201);
    }

    public function loanAction(Request $request, EmployeeLoan $loan): JsonResponse
    {
        abort_unless($loan->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.compensation.manage'), 403);
        $data = $request->validate(['action' => ['required', Rule::in(['pause', 'resume', 'cancel', 'write_off', 'record_repayment'])], 'amount' => ['required_if:action,record_repayment', 'numeric', 'gt:0'], 'reference' => ['nullable', 'string', 'max:100']]);
        DB::transaction(function () use ($loan, $data): void {
            $locked = EmployeeLoan::query()->whereKey($loan->id)->lockForUpdate()->firstOrFail();
            if ($data['action'] === 'pause') { abort_unless($locked->status === 'active', 422, 'Only an active loan can be paused.'); $locked->update(['status' => 'paused']); }
            if ($data['action'] === 'resume') { abort_unless($locked->status === 'paused', 422, 'Only a paused loan can be resumed.'); $locked->update(['status' => 'active']); }
            if ($data['action'] === 'cancel') { abort_unless((float) $locked->outstanding_balance === (float) $locked->total_repayable, 422, 'A loan with repayments cannot be cancelled.'); $locked->update(['status' => 'cancelled']); }
            if ($data['action'] === 'write_off') { abort_unless(in_array($locked->status, ['active', 'paused'], true), 422, 'This loan cannot be written off.'); $locked->update(['status' => 'written_off']); }
            if ($data['action'] === 'record_repayment') {
                abort_unless(in_array($locked->status, ['active', 'paused'], true), 422, 'This loan cannot receive repayments.');
                $amount = min((float) $data['amount'], (float) $locked->outstanding_balance);
                LoanRepayment::query()->create(['organization_id' => $locked->organization_id, 'employee_loan_id' => $locked->id, 'amount' => $amount, 'paid_on' => now()->toDateString(), 'reference' => $data['reference'] ?? null]);
                $balance = max(0, (float) $locked->outstanding_balance - $amount);
                $locked->update(['outstanding_balance' => $balance, 'status' => $balance <= 0 ? 'repaid' : $locked->status]);
            }
        });
        return response()->json(['loan' => $loan->refresh()->load('repayments')]);
    }

    public function markPaymentBatchPaid(Request $request, PayrollPaymentBatch $paymentBatch): JsonResponse
    {
        abort_unless($paymentBatch->organization_id === $request->user()->organization_id, 404);
        abort_unless($request->user()->can('payroll.runs.finalize'), 403);
        abort_unless($paymentBatch->status === 'generated', 422, 'Only a generated payment batch can be marked as paid.');
        $paymentBatch->update(['status' => 'paid', 'marked_paid_at' => now()]);
        return response()->json(['payment_batch' => $paymentBatch->refresh()]);
    }

    public function paymentExport(Request $request, PayrollRun $payrollRun, PayrollOutputService $outputs): JsonResponse
    { abort_unless($request->user()->can('payroll.runs.finalize'),403); return response()->json(['payment_batch'=>$outputs->paymentExport($request->user(),$payrollRun)],201); }

    public function downloadPayment(Request $request, PayrollPaymentBatch $paymentBatch): StreamedResponse
    { abort_unless($paymentBatch->organization_id===$request->user()->organization_id,404);abort_unless($request->user()->can('payroll.runs.finalize'),403);abort_unless(Storage::disk('local')->exists($paymentBatch->file_path),404);return Storage::disk('local')->download($paymentBatch->file_path,basename($paymentBatch->file_path)); }

    public function journal(Request $request, PayrollRun $payrollRun, PayrollOutputService $outputs): JsonResponse
    { abort_unless($request->user()->can('payroll.reports.view'),403);return response()->json(['journal'=>$outputs->journal($request->user(),$payrollRun)]); }

    public function payslip(Request $request, PayrollRunItem $payrollRunItem, PayrollOutputService $outputs): JsonResponse
    { abort_unless($payrollRunItem->organization_id===$request->user()->organization_id,404);abort_unless($request->user()->can('payroll.runs.finalize'),403);return response()->json(['document'=>$outputs->payslip($request->user(),$payrollRunItem)]); }

    public function downloadPayslip(Request $request, PayrollRunItem $payrollRunItem, PayrollOutputService $outputs): StreamedResponse
    {
        abort_unless($payrollRunItem->organization_id===$request->user()->organization_id,404);$own=$payrollRunItem->employee_id===$request->user()->employee?->id;
        abort_unless($own?$request->user()->can('payroll.payslips.view_own'):$request->user()->can('payroll.runs.view'),403);
        if($own)abort_unless($payrollRunItem->payrollRun()->where('status','finalized')->whereNotNull('published_at')->exists(),404);
        $document=$payrollRunItem->payslipDocument ?: $outputs->payslip($request->user(),$payrollRunItem);abort_unless(Storage::disk('local')->exists($document->file_path),404);
        return Storage::disk('local')->download($document->file_path,$document->file_name,['Content-Type'=>$document->mime_type]);
    }

    public function report(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.reports.view'),403);
        $runs=PayrollRun::query()->where('organization_id',$request->user()->organization_id)->when($request->string('status')->toString(),fn($q,$s)=>$q->where('status',$s))->when($request->date('date_from'),fn($q,$d)=>$q->whereDate('period_start','>=',$d))->when($request->date('date_to'),fn($q,$d)=>$q->whereDate('period_end','<=',$d));
        return response()->json(['summary'=>['run_count'=>(clone $runs)->count(),'employee_payments'=>(clone $runs)->sum('employee_count'),'gross'=>(float)(clone $runs)->sum('total_gross'),'deductions'=>(float)(clone $runs)->sum('total_deductions'),'net'=>(float)(clone $runs)->sum('total_net'),'employer_contributions'=>(float)(clone $runs)->sum('total_employer_contributions')],'data'=>$runs->latest('period_end')->paginate(min(max($request->integer('per_page',15),1),100))]);
    }

    public function statutoryReport(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('payroll.reports.view'),403);
        $rows=DB::table('payroll_run_item_lines as lines')->join('payroll_run_items as items','items.id','=','lines.payroll_run_item_id')->join('payroll_runs as runs','runs.id','=','items.payroll_run_id')
            ->where('lines.organization_id',$request->user()->organization_id)->where('lines.is_statutory',true)
            ->when($request->date('date_from'),fn($q,$d)=>$q->whereDate('runs.period_start','>=',$d))->when($request->date('date_to'),fn($q,$d)=>$q->whereDate('runs.period_end','<=',$d))
            ->select('lines.component_code','lines.component_name','lines.type',DB::raw('COUNT(DISTINCT items.employee_id) as employee_count'),DB::raw('SUM(lines.amount) as total_amount'))->groupBy('lines.component_code','lines.component_name','lines.type')->orderBy('lines.component_code')->get();
        return response()->json(['data'=>$rows]);
    }

    public function exportRegister(Request $request): StreamedResponse
    {
        abort_unless($request->user()->can('payroll.reports.view'),403);
        $query=PayrollRunItem::query()->with('payrollRun')->where('organization_id',$request->user()->organization_id)
            ->whereHas('payrollRun',fn($q)=>$q->when($request->integer('payroll_run_id'),fn($x,$id)=>$x->whereKey($id))->when($request->date('date_from'),fn($x,$d)=>$x->whereDate('period_start','>=',$d))->when($request->date('date_to'),fn($x,$d)=>$x->whereDate('period_end','<=',$d)));
        return response()->streamDownload(function()use($query){$h=fopen('php://output','w');fputcsv($h,['Run','Period Start','Period End','Employee Number','Employee Name','Gross','Deductions','Net','Employer Contributions','Status']);$query->chunk(200,function($items)use($h){foreach($items as $i)fputcsv($h,[$i->payrollRun->reference,$i->payrollRun->period_start->toDateString(),$i->payrollRun->period_end->toDateString(),$i->employee_number,$i->employee_name,$i->gross_pay,$i->total_deductions,$i->net_pay,$i->employer_contributions,$i->status]);});fclose($h);},'payroll-register-'.now()->format('Y-m-d-His').'.csv',['Content-Type'=>'text/csv; charset=UTF-8']);
    }

    private function maskedProfile(EmployeeStatutoryProfile $profile): array
    { return ['id'=>$profile->id,'employee_id'=>$profile->employee_id,'paye_enabled'=>$profile->paye_enabled,'tax_state'=>$profile->tax_state,'tax_id_last_four'=>$profile->tax_id?substr($profile->tax_id,-4):null,'pension_enabled'=>$profile->pension_enabled,'pfa_name'=>$profile->pfa_name,'rsa_pin_last_four'=>$profile->rsa_pin?substr($profile->rsa_pin,-4):null,'nhf_enabled'=>$profile->nhf_enabled,'nhf_number_last_four'=>$profile->nhf_number?substr($profile->nhf_number,-4):null,'reliefs'=>$profile->reliefs,'exemptions'=>$profile->exemptions]; }
}
