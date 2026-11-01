<?php
require __DIR__.'/../server/vendor/autoload.php';
$app = require __DIR__.'/../server/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models as M;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

if (!app()->environment('local') || DB::connection()->getConfig('host') !== '127.0.0.1' || DB::connection()->getDatabaseName() !== 'valtireo') throw new RuntimeException('Local fixture only');
$org = M\Organization::where('code', 'LASHMA-DEMO')->firstOrFail();
setPermissionsTeamId($org->id);
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$errors = []; $checks = []; $accounts = [];
function checkDemo(bool $condition, string $label): void { global $errors, $checks; $checks[$label] = $condition; if (!$condition) $errors[] = $label; }
function apiDemo(string $method, string $path, array $data = [], ?string $token = null): array {
    global $kernel;
    Auth::forgetGuards();
    $headers = ['HTTP_ACCEPT' => 'application/json'];
    if ($token) $headers['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    $request = Illuminate\Http\Request::create('/api/'.$path, $method, $data, [], [], $headers);
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);
    return [$response->getStatusCode(), json_decode($response->getContent(), true)];
}
foreach (Database\Seeders\LashmaMobileDemoSeeder::PERSONAS as $alias => $definition) {
    $user = M\User::where('email', $alias.'@lashma.test')->firstOrFail();
    $employee = $user->employee;
    checkDemo($user->organization_id === $org->id && $employee->organization_id === $org->id, "$alias tenant");
    checkDemo($employee->unit->department_id === $employee->department_id, "$alias unit");
    $manager = app(App\Services\DashboardService::class)->hasManagerScope($user);
    checkDemo($manager === in_array($alias, ['manager', 'supervisor']), "$alias manager eligibility");
    [$status, $body] = apiDemo('POST', 'auth/login', ['email' => $user->email, 'password' => 'LashmaDemo2026!', 'device_name' => 'lashma-mobile-verification']);
    $blocked = in_array($alias, ['suspended', 'exited']);
    $token = $body['token'] ?? $body['data']['token'] ?? null;
    checkDemo($blocked ? ($status === 422 && !$token) : ($status === 200 && (bool)$token), "$alias login ($status)");
    $accounts[$alias] = ['login_status' => $status, 'role' => $user->getRoleNames()->all(), 'manager_home' => $manager, 'direct_reports' => M\Employee::where('organization_id', $org->id)->where('reporting_manager_id', $employee->id)->count()];
    if (!$token) continue;
    try {
        foreach (['auth/me', ...($employee->status === 'active' ? ['dashboard/me', 'employee-profile/overview', 'leave/requests', 'attendance/records', 'lifestyle/preferences', 'lifestyle/milestones', 'lifestyle/appreciations'] : [])] as $path) {
            [$s, $b] = apiDemo('GET', $path, [], $token);
            checkDemo($s === 200, "$alias $path ($s)");
            if ($path === 'lifestyle/milestones' && $s === 200) {
                $private = M\Employee::where('work_email', 'private@lashma.test')->value('id');
                checkDemo(!collect($b['data'])->contains(fn($row) => $row['employee']['id'] === $private), "$alias private birthday hidden");
            }
        }
        if (in_array($alias, ['manager', 'supervisor', 'manager.empty', 'structural.lead', 'team.lagos'])) {
            [$s, $b] = apiDemo('GET', 'dashboard/manager', [], $token);
            checkDemo($s === ($manager ? 200 : 403), "$alias manager API ($s)");
        }
    } finally { Laravel\Sanctum\PersonalAccessToken::findToken($token)?->delete(); }
}
$manager = M\User::where('email', 'manager@lashma.test')->firstOrFail();
$subject = M\Employee::where('work_email', 'team.lagos@lashma.test')->firstOrFail();
$approval = M\ApprovalRequest::where('subject_employee_id', $subject->id)->where('status', 'pending')->firstOrFail();
$auth = app(App\Services\ApprovalDecisionAuthorizationService::class);
checkDemo($auth->restriction($subject->user, $approval, 'approve') !== null, 'Requester cannot self approve');
checkDemo($auth->restriction($subject->user, $approval, 'cancel') === null, 'Requester can withdraw submitted demo leave');
checkDemo($approval->approvable->status === 'submitted', 'Pending approval has submitted source');
checkDemo($auth->restriction($manager, $approval, 'approve') === null, 'Manager can review own team pending leave');
$unrelated = M\User::where('email', 'supervisor@lashma.test')->firstOrFail();
checkDemo($auth->restriction($unrelated, $approval, 'approve') !== null, 'Unrelated supervisor cannot approve this team leave');
checkDemo(!app(App\Services\EmployeeVisibility::class)->allows($unrelated, $subject->id), 'Unrelated supervisor cannot manage this employee');
checkDemo(app(App\Services\EmployeeVisibility::class)->allows($manager, $subject->id), 'Manager can manage their report');
$night = M\Employee::where('work_email', 'medical.night@lashma.test')->firstOrFail();
checkDemo(M\AttendanceRecord::where('employee_id', $night->id)->count() === 5, 'Five overnight attendance records');
checkDemo(M\Employee::where('work_email', 'new.starter@lashma.test')->firstOrFail()->status === 'active', 'New starter active');
$report = ['accounts' => $accounts, 'checks' => $checks, 'passed' => count(array_filter($checks)), 'total' => count($checks), 'errors' => $errors];
file_put_contents(__DIR__.'/lashma-mobile-verification.json', json_encode($report, JSON_PRETTY_PRINT));
echo json_encode(['passed' => $report['passed'], 'total' => $report['total'], 'accounts' => $accounts, 'errors' => $errors], JSON_PRETTY_PRINT).PHP_EOL;
exit($errors ? 1 : 0);
