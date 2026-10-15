<?php
require __DIR__.'/../server/vendor/autoload.php';
$app = require __DIR__.'/../server/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models as M;
use Illuminate\Support\Facades\{Auth, Hash, Storage};
$org = M\Organization::where('code', 'LASHMA-DEMO')->firstOrFail();
if (! app()->environment(['local', 'testing'])) throw new RuntimeException('Local only');
app(Spatie\Permission\PermissionRegistrar::class)->setPermissionsTeamId($org->id);
$counts = [];
foreach (['Employee','Department','Unit','OrganizationLocation','Cluster','LeaveEntitlement','LeaveRequest','AttendanceRecord','AttendanceCorrectionRequest','EmployeeDocument','Ticket','Asset','PayrollRun','PayrollRunItem','CompanyEvent'] as $name) {
    $class = 'App\\Models\\'.$name;
    $counts[$name] = $class::where('organization_id', $org->id)->count();
}
$errors = [];
$checkedHashes = [];
$staff = M\Employee::with(['user','department','unit','location'])->where('organization_id', $org->id)->orderBy('employee_number')->get();
$roster = "# LASHMA synthetic test accounts\n\nShared local test password: `LashmaDemo2026!`. These are fictional people and contacts. Suspended and exited accounts intentionally cannot sign in.\n\n| Number | Name | Email | Role | Department | Unit | Location | Status |\n|---|---|---|---|---|---|---|---|\n";
foreach ($staff as $e) {
    foreach (['user','department','unit','location'] as $rel) if (!$e->$rel || $e->$rel->organization_id !== $org->id) $errors[] = "{$e->employee_number}: invalid $rel";
    if ($e->unit->department_id !== $e->department_id) $errors[] = 'Unit department mismatch';
    $hash = $e->user->password;
    if (!isset($checkedHashes[$hash])) $checkedHashes[$hash] = Hash::check('LashmaDemo2026!', $hash);
    if (!$checkedHashes[$hash]) $errors[] = 'Password mismatch';
    if ($e->reporting_manager_id && !$staff->contains('id', $e->reporting_manager_id)) $errors[] = 'Manager outside fixture';
    $roster .= '| '.implode(' | ', [$e->employee_number, $e->first_name.' '.$e->last_name,$e->user->email,$e->user->getRoleNames()->join(', '),$e->department->name,$e->unit->name,$e->location->name,$e->status])." |\n";
}
foreach (M\EmployeeDocument::where('organization_id',$org->id)->get() as $doc) {
    if (!Storage::disk('local')->exists($doc->file_path) || !str_starts_with(Storage::disk('local')->get($doc->file_path),'%PDF-')) $errors[] = 'Invalid document '.$doc->id;
}
foreach (M\PayrollRun::where('organization_id',$org->id)->get() as $run) {
    $items = M\PayrollRunItem::where('payroll_run_id',$run->id)->get();
    foreach (['gross_pay'=>'total_gross','net_pay'=>'total_net','total_deductions'=>'total_deductions'] as $field=>$total) if (abs($items->sum($field)-$run->$total)>0.01) $errors[] = 'Payroll total mismatch';
}
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
function callApi($method,$path,$params=[],$token=null) {
    global $kernel;
    Auth::forgetGuards();
    $headers = ['HTTP_ACCEPT'=>'application/json'];
    if ($token) $headers['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    $req = Illuminate\Http\Request::create('/api/'.$path,$method,$params,[],[],$headers);
    $response = $kernel->handle($req);
    $kernel->terminate($req,$response);
    return [$response->getStatusCode(),json_decode($response->getContent(),true)];
}
$api = [];
foreach (['employee','admin','hr','payroll','ict','csc.head'] as $login) {
    [$status,$body] = callApi('POST','auth/login',['email'=>$login.'@lashma.test','password'=>'LashmaDemo2026!','device_name'=>'lashma-fixture-verification']);
    $api[$login.' login'] = $status;
    $token = $body['token'] ?? $body['data']['token'] ?? null;
    if ($status !== 200 || !$token) { $errors[] = $login.' login failed: '.json_encode($body); continue; }
    try {
        $paths = $login === 'employee' ? ['auth/me','dashboard/me','employee-profile/overview','leave/requests','attendance/records','documents','tickets','assets','notifications','payroll/me/payslips','employees/directory?department_id=all','company-events'] : ['auth/me'];
        foreach ($paths as $path) {
            [$s,$b] = callApi('GET',$path,[],$token);
            $api[$login.' '.$path] = $s;
            // The organization-wide document list is restricted to staff with review permissions.
            $expected = $login === 'employee' && $path === 'documents' ? 403 : 200;
            if ($s !== $expected) $errors[] = "$login $path ($s): ".($b['message'] ?? 'Unexpected response');
        }
        if ($login === 'employee') {
            $employee = $staff->first(fn($e) => $e->user->email === 'employee@lashma.test');
            $doc = M\EmployeeDocument::where('employee_id',$employee->id)->firstOrFail();
            [$s,$b] = callApi('GET','documents/'.$doc->id,[],$token);
            $api['employee own document'] = $s;
            if ($s !== 200) $errors[] = 'Own document access failed';
        }
    } finally { Laravel\Sanctum\PersonalAccessToken::findToken($token)?->delete(); }
}
file_put_contents(__DIR__.'/../docs/lashma-test-accounts.md',$roster);
$report = ['counts'=>$counts,'api'=>$api,'errors'=>$errors];
file_put_contents(__DIR__.'/lashma-verification.json',json_encode($report,JSON_PRETTY_PRINT));
echo json_encode($report,JSON_PRETTY_PRINT).PHP_EOL;
exit(count($errors) ? 1 : 0);
