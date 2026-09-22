<?php

namespace App\Services;

use App\Models\PayslipDocument;
use App\Models\PayrollJournalBatch;
use App\Models\PayrollPaymentBatch;
use App\Models\PayrollRun;
use App\Models\PayrollRunItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PayrollOutputService
{
    public function paymentExport(User $actor, PayrollRun $run): PayrollPaymentBatch
    {
        $this->ensureFinalized($actor,$run); $run->load('items');
        if($run->items->contains(fn($i)=>blank($i->bank_snapshot))) throw ValidationException::withMessages(['bank_accounts'=>['Every employee must have a bank snapshot before payment export.']]);
        $reference=$run->reference.'-PAYMENT-'.now()->format('YmdHis'); $path="payroll/{$run->organization_id}/payments/{$reference}.csv";
        $handle=fopen('php://temp','w+'); fputcsv($handle,['Employee Number','Employee Name','Bank Code','Bank Name','Account Name','Account Number','Amount','Reference']);
        foreach($run->items as $item)fputcsv($handle,[$item->employee_number,$item->employee_name,data_get($item->bank_snapshot,'bank_code'),data_get($item->bank_snapshot,'bank_name'),data_get($item->bank_snapshot,'account_name'),$item->bank_account_number,$item->net_pay,$run->reference]);
        rewind($handle);$content=stream_get_contents($handle);fclose($handle);Storage::disk('local')->put($path,$content);
        return PayrollPaymentBatch::query()->create(['organization_id'=>$run->organization_id,'payroll_run_id'=>$run->id,'reference'=>$reference,'format'=>'csv','payment_count'=>$run->items->count(),'total_amount'=>$run->items->sum('net_pay'),'file_path'=>$path,'checksum'=>hash('sha256',$content),'generated_by_id'=>$actor->id,'generated_at'=>now()]);
    }

    public function journal(User $actor, PayrollRun $run): PayrollJournalBatch
    {
        $this->ensureFinalized($actor,$run);
        return DB::transaction(function()use($actor,$run){
            $batch=PayrollJournalBatch::query()->firstOrCreate(['payroll_run_id'=>$run->id],['organization_id'=>$run->organization_id,'reference'=>$run->reference.'-JOURNAL','journal_date'=>$run->payment_date,'currency'=>$run->currency,'total_debit'=>$run->total_gross+$run->total_employer_contributions,'total_credit'=>$run->total_gross+$run->total_employer_contributions,'created_by_id'=>$actor->id]);
            if($batch->lines()->exists())return $batch->load('lines');
            $lines=[
                ['account_code'=>'SALARY_EXPENSE','account_name'=>'Salary expense','debit'=>$run->total_gross,'credit'=>0],
                ['account_code'=>'EMPLOYER_COST','account_name'=>'Employer contribution expense','debit'=>$run->total_employer_contributions,'credit'=>0],
                ['account_code'=>'PAYROLL_BANK','account_name'=>'Payroll bank payable','debit'=>0,'credit'=>$run->total_net],
                ['account_code'=>'DEDUCTIONS_PAYABLE','account_name'=>'Employee deductions payable','debit'=>0,'credit'=>$run->total_deductions],
                ['account_code'=>'EMPLOYER_PAYABLE','account_name'=>'Employer contributions payable','debit'=>0,'credit'=>$run->total_employer_contributions],
            ]; foreach($lines as $line)if((float)$line['debit']>0||(float)$line['credit']>0)$batch->lines()->create([...$line,'organization_id'=>$run->organization_id,'description'=>$run->name]);
            return $batch->load('lines');
        });
    }

    public function payslip(User $actor, PayrollRunItem $item): PayslipDocument
    {
        $run=$item->payrollRun; $this->ensureFinalized($actor,$run); $item->load('lines');
        $rows=$item->lines->map(fn($line)=>'<tr><td>'.e($line->component_name).'</td><td>'.e(ucwords(str_replace('_',' ',$line->type))).'</td><td style="text-align:right">'.number_format((float)$line->amount,2).'</td></tr>')->implode('');
        $html='<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title><style>body{font-family:Arial,sans-serif;color:#182230;padding:32px}h1{font-size:22px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{margin-top:24px;font-size:18px;font-weight:bold}</style></head><body><h1>'.e($run->name).' payslip</h1><div class="meta"><span>Employee: '.e($item->employee_name).'</span><span>Number: '.e($item->employee_number).'</span><span>Period: '.$run->period_start->toDateString().' to '.$run->period_end->toDateString().'</span><span>Payment date: '.$run->payment_date->toDateString().'</span></div><table><thead><tr><th>Item</th><th>Type</th><th>Amount ('.e($run->currency).')</th></tr></thead><tbody>'.$rows.'</tbody></table><div class="total">Net pay: '.e($run->currency).' '.number_format((float)$item->net_pay,2).'</div></body></html>';
        $path="payroll/{$run->organization_id}/payslips/{$run->reference}-{$item->employee_number}.html";Storage::disk('local')->put($path,$html);
        return PayslipDocument::query()->updateOrCreate(['payroll_run_item_id'=>$item->id],['organization_id'=>$run->organization_id,'file_path'=>$path,'file_name'=>basename($path),'mime_type'=>'text/html','checksum'=>hash('sha256',$html),'generated_by_id'=>$actor->id,'generated_at'=>now()]);
    }

    private function ensureFinalized(User $actor, PayrollRun $run): void { abort_unless($actor->organization_id===$run->organization_id,404); if($run->status!=='finalized')throw ValidationException::withMessages(['status'=>['The payroll run must be finalized first.']]); }
}
