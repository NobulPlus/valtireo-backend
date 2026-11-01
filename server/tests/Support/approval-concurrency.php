<?php

/** Run manually: php tests/Support/approval-concurrency.php
 * Uses a disposable, uniquely named LOCAL MySQL database, never the configured application database.
 */
use App\Models\{ApprovalRequest, ApprovalWorkflow, DocumentType, EmployeeDocument, LeaveEntitlement, LeavePeriod, LeaveRequest, LeaveType, PayrollRun, User};
use App\Services\{ApprovalRequestService, LeaveRequestService, NotificationDispatchService, PayrollService};
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\{Artisan, DB};
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(static function (Throwable $exception): void {
    fwrite(STDERR, $exception->getMessage().PHP_EOL);
    exit(1);
});
$worker = ($argv[1] ?? '') === 'worker';
$testPort = $worker ? ($argv[8] ?? '') : ($argv[1] ?? '');
$connection = config('database.connections.mysql');
// Explicit alternate port is for an isolated, freshly initialized local test server only.
if ($testPort !== '') {
    if (! ctype_digit($testPort) || (int) $testPort < 1024 || (int) $testPort > 65535 || (int) $testPort === (int) $connection['port']) {
        throw new RuntimeException('Use a separate high port for the disposable test server.');
    }
    $connection = [...$connection, 'host' => '127.0.0.1', 'port' => (int) $testPort, 'username' => 'root', 'password' => '', 'url' => null];
    config(['database.connections.mysql' => $connection]);
}
if (! in_array($connection['host'] ?? '', ['127.0.0.1', 'localhost', '::1'], true) || ! empty($connection['url'])) {
    throw new RuntimeException('This harness only permits a local MySQL connection without a database URL.');
}
$database = $worker ? ($argv[2] ?? '') : 'codex_phase2b_'.bin2hex(random_bytes(6));
if (! preg_match('/^codex_phase2b_[a-f0-9]{12}$/', $database)) {
    throw new RuntimeException('Invalid disposable database name.');
}
$app['env'] = 'testing';
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database,
    'queue.default' => 'sync', 'cache.default' => 'array', 'session.driver' => 'array']);
DB::purge('mysql');
$app->instance(NotificationDispatchService::class, Mockery::mock(NotificationDispatchService::class)->shouldIgnoreMissing());

if ($worker) {
    $request = ApprovalRequest::findOrFail((int) $argv[3]);
    $actor = User::findOrFail((int) $argv[4]);
    app(PermissionRegistrar::class)->setPermissionsTeamId($actor->organization_id);
    $barrier = $argv[5];
    $slot = $argv[6];
    file_put_contents($barrier.'/ready-'.$slot, 'ready');
    $deadline = microtime(true) + 30;
    while (! is_file($barrier.'/go')) {
        if (microtime(true) > $deadline) throw new RuntimeException('Barrier timeout.');
        usleep(20000);
    }
    try {
        if ($argv[7] === 'domain_cancel') {
            app(LeaveRequestService::class)->cancel($actor, $request->approvable, 'Concurrent cancellation');
        } else {
            app(ApprovalRequestService::class)->act($actor, $request, $argv[7], 'Concurrent test');
        }
        echo '200';
    } catch (ValidationException) {
        echo '422';
    } catch (HttpExceptionInterface $exception) {
        echo $exception->getStatusCode();
    }
    exit;
}

config(['database.connections.phase2b_server' => [...$connection, 'database' => null]]);
$server = DB::connection('phase2b_server');
$server->statement("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$processes = [];
try {
    Artisan::call('migrate', ['--force' => true]);
    Artisan::call('db:seed', ['--force' => true]);
    $admin = User::where('email', 'admin@valtireo.test')->firstOrFail();
    $owner = User::where('email', 'aisha.bello@valtireo.test')->firstOrFail();
    app(PermissionRegistrar::class)->setPermissionsTeamId($admin->organization_id);
    foreach ([['document', 'approve'], ['document', 'cancel'], ['payroll', 'approve'], ['leave', 'approve'], ['leave', 'cancel'], ['leave', 'domain_cancel']] as [$kind, $secondAction]) {
        $reviewer = $admin;
        $balance = null;
        if ($kind === 'document') {
            $source = EmployeeDocument::create([
            'organization_id' => $owner->organization_id, 'employee_id' => $owner->employee->id,
            'document_type_id' => DocumentType::where('organization_id', $owner->organization_id)->firstOrFail()->id,
            'uploaded_by_id' => $owner->id, 'title' => 'Concurrency test', 'file_name' => 'test.pdf', 'file_path' => 'test.pdf',
            'status' => 'submitted',
            ]);
            $request = app(ApprovalRequestService::class)->submit($owner, $source, 'employee_documents', 'submit', 'Race', $owner->employee);
        } elseif ($kind === 'payroll') {
            $source = PayrollRun::create([
                'organization_id' => $admin->organization_id, 'reference' => 'RACE', 'name' => 'Payroll race',
                'period_start' => '2026-01-01', 'period_end' => '2026-01-31', 'payment_date' => '2026-01-31',
                'currency' => 'NGN', 'status' => 'calculated', 'created_by_id' => $admin->id,
            ]);
            app(PayrollService::class)->submit($admin, $source);
            $request = ApprovalRequest::where('approvable_type', PayrollRun::class)->where('approvable_id', $source->id)->firstOrFail();
            $reviewer = User::where('email', 'mariam.okafor@valtireo.test')->firstOrFail();
        } else {
            $workflow = ApprovalWorkflow::where('organization_id', $admin->organization_id)->where('module', 'leave')->firstOrFail();
            $workflow->steps()->where('step_order', '>', 1)->update(['is_active' => false]);
            $period = LeavePeriod::create(['organization_id' => $admin->organization_id, 'name' => 'Race '.$secondAction,
                'starts_on' => now()->startOfYear(), 'ends_on' => now()->endOfYear(), 'is_active' => true]);
            $type = LeaveType::where('organization_id', $admin->organization_id)->firstOrFail();
            $balance = LeaveEntitlement::create(['organization_id' => $admin->organization_id, 'employee_id' => $owner->employee->id,
                'leave_type_id' => $type->id, 'leave_period_id' => $period->id, 'days_allocated' => 20, 'days_pending' => 2, 'days_used' => 0]);
            $source = LeaveRequest::create(['organization_id' => $admin->organization_id, 'employee_id' => $owner->employee->id,
                'leave_type_id' => $type->id, 'leave_period_id' => $period->id, 'requested_by_id' => $owner->id,
                'starts_on' => now()->addDays(10), 'ends_on' => now()->addDays(11), 'total_days' => 2, 'status' => 'submitted']);
            $request = app(ApprovalRequestService::class)->submit($owner, $source, 'leave', 'submit', 'Race', $owner->employee);
        }
        $barrier = sys_get_temp_dir().'/'.$database.'-'.$kind.'-'.$secondAction;
        mkdir($barrier);
        $processes = [];
        foreach (['approve', $secondAction] as $slot => $action) {
            $pipes = [];
            $process = proc_open([PHP_BINARY, __FILE__, 'worker', $database, (string) $request->id,
                (string) $reviewer->id, $barrier, (string) $slot, $action, $testPort],
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(), null,
                ['bypass_shell' => true, 'create_no_window' => true]);
            if (! is_resource($process)) throw new RuntimeException('Could not start worker.');
            fclose($pipes[0]);
            $processes[] = [$process, $pipes];
        }
        $deadline = microtime(true) + 30;
        while (! is_file($barrier.'/ready-0') || ! is_file($barrier.'/ready-1')) {
            if (microtime(true) > $deadline) throw new RuntimeException('Workers did not reach barrier.');
            usleep(20000);
        }
        file_put_contents($barrier.'/go', 'go');
        $results = [];
        foreach ($processes as [$process, $pipes]) {
            $results[] = trim(stream_get_contents($pipes[1]));
            $errors = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            if (proc_close($process) !== 0) throw new RuntimeException($errors);
        }
        $processes = [];
        sort($results);
        $validResults = $results === ['200', '422'] || ($secondAction === 'domain_cancel' && $results === ['200', '200']);
        if (! $validResults || $request->decisions()->count() !== 1) {
            throw new RuntimeException('Race failed: '.json_encode($results));
        }
        if ($kind === 'document' && $source->reviews()->count() !== 1) throw new RuntimeException('Duplicate document effect.');
        if ($kind === 'payroll' && $source->fresh()->status !== 'approved') throw new RuntimeException('Payroll not approved.');
        if ($balance) {
            $expectedUsed = $source->fresh()->status === 'approved' ? 2.0 : 0.0;
            if ((float) $balance->fresh()->days_pending !== 0.0 || (float) $balance->fresh()->days_used !== $expectedUsed) {
                throw new RuntimeException('Incorrect leave balance after race.');
            }
            if ($secondAction === 'domain_cancel' && $source->fresh()->status !== 'cancelled') throw new RuntimeException('Leave not cancelled.');
        }
        echo "PASS MySQL {$kind} approve/{$secondAction}: one decision, source effects verified\n";
        foreach (['ready-0', 'ready-1', 'go'] as $file) unlink($barrier.'/'.$file);
        rmdir($barrier);
    }
    echo 'MySQL version: '.$server->selectOne('SELECT VERSION() AS version')->version."\n";
} finally {
    foreach ($processes as [$process]) if (is_resource($process)) proc_terminate($process);
    DB::disconnect('mysql');
    $server->statement("DROP DATABASE `{$database}`");
}
