<?php

namespace Database\Seeders;

use App\Models as M;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

/** Additive, local-only mobile personas. Never resets existing staff or role grants. */
class LashmaMobileDemoSeeder extends Seeder
{
    public const PERSONAS = [
        'manager' => ['Adebisi', 'Akinola', 'supervisor', 'CSC', null],
        'supervisor' => ['Chinwe', 'Okorie', 'supervisor', 'MED', null],
        'manager.empty' => ['Bashir', 'Lawal', 'supervisor', 'FIN', null],
        'structural.lead' => ['Funmilayo', 'Ojo', 'employee', 'ICT', null],
        'hr.director' => ['Nnenna', 'Eze', 'hr_director', 'ADM', null],
        'compliance' => ['Olumide', 'Balogun', 'compliance_officer', 'REG', null],
        'team.lagos' => ['Kemi', 'Adebanjo', 'employee', 'CSC', 'manager'],
        'team.ikeja' => ['Ibrahim', 'Sani', 'employee', 'CSC', 'manager'],
        'team.lekki' => ['Adaeze', 'Obi', 'employee', 'CSC', 'manager'],
        'team.ikorodu' => ['Seyi', 'Alabi', 'employee', 'CSC', 'manager'],
        'medical.day' => ['Amina', 'Usman', 'employee', 'MED', 'supervisor'],
        'medical.night' => ['Chukwudi', 'Nwosu', 'employee', 'MED', 'supervisor'],
        'ict.report' => ['Tosin', 'Ajayi', 'employee', 'ICT', 'structural.lead'],
        'new.starter' => ['Zainab', 'Bello', 'employee', 'ACC', null],
        'private' => ['Emeka', 'Udo', 'employee', 'AUD', null],
        'contract' => ['Yetunde', 'Salami', 'employee', 'SAL', null],
        'nysc' => ['Musa', 'Abubakar', 'employee', 'PRE', null],
        'intern' => ['Amaka', 'Nwankwo', 'employee', 'ACT', null],
        'onboarding' => ['Damilola', 'Ogundipe', 'employee', 'ADM', null],
        'suspended' => ['Segun', 'Adeleke', 'employee', 'REG', null],
        'exited' => ['Halima', 'Yusuf', 'employee', 'FIN', null],
    ];

    public function run(): void
    {
        $connection = DB::connection();
        if (! app()->environment('local') || $connection->getDriverName() !== 'mysql'
            || ! in_array($connection->getConfig('host'), ['127.0.0.1', 'localhost'], true)
            || $connection->getDatabaseName() !== 'valtireo') {
            throw new \RuntimeException('This fixture only targets the local valtireo MySQL database.');
        }
        $registrar = app(PermissionRegistrar::class);
        $previousTeam = $registrar->getPermissionsTeamId();
        try {
            DB::transaction(function () use ($registrar) {
                $org = M\Organization::where('code', 'LASHMA-DEMO')->lockForUpdate()->firstOrFail();
                if (data_get($org->settings, 'demo_fixture.synthetic') !== true) {
                    throw new \RuntimeException('Expected the original synthetic LASHMA fixture.');
                }
                // Older fixture rows used approval status "pending" on the source.
                // Real leave/correction submissions use "submitted". Only repair
                // untouched synthetic pending requests, never user-created history.
                foreach (M\ApprovalRequest::where('organization_id', $org->id)->where('status', 'pending')->whereDoesntHave('decisions')->get() as $request) {
                    if (! data_get($request->metadata, 'synthetic_fixture')) {
                        continue;
                    }
                    if (! in_array($request->approvable_type, [M\LeaveRequest::class, M\AttendanceCorrectionRequest::class])) {
                        continue;
                    }
                    $source = $request->approvable;
                    if ($source && $source->organization_id === $org->id && $source->status === 'pending') {
                        $source->update(['status' => 'submitted']);
                    }
                }
                if (data_get($org->settings, 'demo_fixture.mobile_v1')) {
                    $this->command?->info('Mobile fixture already exists; preserving demo changes.');

                    return;
                }
                foreach (array_keys(self::PERSONAS) as $alias) {
                    if (M\User::where('email', $alias.'@lashma.test')->exists()) {
                        throw new \RuntimeException('Reserved persona already exists: '.$alias);
                    }
                }
                $registrar->setPermissionsTeamId($org->id);
                $roles = $org->roles()->get()->keyBy('key');
                $today = CarbonImmutable::today('Africa/Lagos');
                $password = Hash::make('LashmaDemo2026!');
                $staff = [];
                $index = 0;
                foreach (self::PERSONAS as $alias => [$first, $last, $role, $code, $manager]) {
                    $department = M\Department::where('organization_id', $org->id)->where('code', $code)->firstOrFail();
                    $template = M\Employee::where('organization_id', $org->id)->where('department_id', $department->id)->where('status', 'active')->firstOrFail();
                    $user = M\User::create(['organization_id' => $org->id, 'name' => "$first $last (Demo)", 'email' => $alias.'@lashma.test', 'password' => $password, 'email_verified_at' => now()]);
                    $user->assignRole($roles->get($role) ?? throw new \RuntimeException('Missing role '.$role));
                    $employee = $template->replicate();
                    $status = in_array($alias, ['onboarding', 'suspended', 'exited']) ? $alias : 'active';
                    $locationCode = ['team.lagos' => 'ISL', 'team.ikeja' => 'IKJ', 'team.lekki' => 'LEK', 'team.ikorodu' => 'IKO', 'medical.night' => 'BAD', 'nysc' => 'ABJ'][$alias] ?? 'HQ';
                    $employee->fill(['user_id' => $user->id, 'employee_number' => 'LSH-M'.str_pad((string) ++$index, 3, '0', STR_PAD_LEFT), 'first_name' => $first, 'middle_name' => null, 'last_name' => $last, 'work_email' => $user->email, 'phone' => '+2340000000000', 'cluster_id' => null,
                        'organization_location_id' => M\OrganizationLocation::where('organization_id', $org->id)->where('code', $locationCode)->firstOrFail()->id,
                        'reporting_manager_id' => $manager ? $staff[$manager]->id : $department->head_employee_id,
                        'start_date' => $alias === 'new.starter' ? $today : $today->addDays($index % 7)->subYears(3), 'status' => $status,
                        'confirmation_status' => in_array($alias, ['new.starter', 'intern', 'nysc', 'onboarding']) ? 'probation' : 'confirmed',
                        'activated_at' => $status === 'active' ? now() : null, 'onboarding_completed_at' => $status === 'active' ? now() : null, 'pending_role_id' => null, 'invited_at' => null, 'probation_ends_at' => null]);
                    $type = ['contract' => 'CONT', 'nysc' => 'NYSC', 'intern' => 'INTERN'][$alias] ?? 'PERM';
                    $employee->employment_type_id = M\EmploymentType::where('organization_id', $org->id)->where('code', $type)->firstOrFail()->id;
                    $employee->save();
                    M\EmployeeProfile::create(['employee_id' => $employee->id, 'date_of_birth' => $today->addDays($index % 10)->subYears(30), 'residential_address' => 'Synthetic residence, '.$employee->location->city.', Nigeria', 'completion_status' => in_array($alias, ['new.starter', 'onboarding']) ? 'draft' : 'approved']);
                    $staff[$alias] = $employee;
                    if ($status === 'active') {
                        $this->selfService($employee, $today, ! in_array($alias, ['new.starter', 'manager.empty']), $alias === 'medical.night');
                        DB::table('employee_lifestyle_preferences')->insert(['employee_id' => $employee->id, 'share_birthday' => $alias !== 'private', 'share_anniversary' => $alias !== 'private', 'receive_appreciation' => $alias !== 'private', 'allow_shared_appreciation' => $alias !== 'private', 'appreciation_notifications' => false, 'created_at' => now(), 'updated_at' => now()]);
                    }
                }
                $cluster = M\Cluster::create(['organization_id' => $org->id, 'department_id' => $staff['manager']->department_id, 'code' => 'MOBILE-DEMO', 'name' => 'Lagos Mobile Demo Cluster', 'description' => 'Synthetic additional testing team', 'manager_employee_id' => $staff['manager']->id, 'is_active' => true]);
                foreach (['team.lagos', 'team.ikeja', 'team.lekki', 'team.ikorodu'] as $alias) {
                    $staff[$alias]->update(['cluster_id' => $cluster->id]);
                    $cluster->locations()->syncWithoutDetaching([$staff[$alias]->organization_location_id]);
                }
                foreach (['shared', 'private'] as $visibility) {
                    M\EmployeeAppreciation::create(['organization_id' => $org->id, 'sender_employee_id' => $staff['manager']->id, 'recipient_employee_id' => $staff['team.lagos']->id, 'message' => 'Synthetic appreciation: thank you for helping the Lagos enrolment team.', 'visibility' => $visibility]);
                }
                M\CompanyEvent::create(['organization_id' => $org->id, 'title' => 'Mobile demo employee welcome (Test)', 'description' => 'Synthetic calendar event.', 'starts_on' => $today->addDays(2), 'ends_on' => $today->addDays(2), 'created_by_user_id' => $staff['hr.director']->user_id, 'is_active' => true]);
                $settings = $org->settings;
                $settings['lifestyle']['milestones_enabled'] = true;
                $settings['lifestyle']['appreciation_enabled'] = true;
                $settings['demo_fixture']['mobile_v1'] = ['anchor_date' => $today->toDateString(), 'employees' => count($staff)];
                $org->update(['settings' => $settings]);
                $this->command?->info('Added '.count($staff).' synthetic mobile personas. Existing staff and role grants preserved.');
            });
        } finally {
            $registrar->setPermissionsTeamId($previousTeam);
            $registrar->forgetCachedPermissions();
        }
    }

    private function selfService(M\Employee $employee, CarbonImmutable $today, bool $history, bool $night): void
    {
        $orgId = $employee->organization_id;
        $period = M\LeavePeriod::where('organization_id', $orgId)->where('is_active', true)->whereDate('starts_on', '<=', $today)->whereDate('ends_on', '>=', $today)->firstOrFail();
        $annual = null;
        foreach (M\LeaveType::where('organization_id', $orgId)->where('is_active', true)->get() as $type) {
            M\LeaveEntitlement::create(['organization_id' => $orgId, 'employee_id' => $employee->id, 'leave_type_id' => $type->id, 'leave_period_id' => $period->id, 'days_allocated' => $type->default_days_per_year, 'days_used' => 0, 'days_pending' => $history && $type->code === 'ANNUAL' ? 1 : 0, 'notes' => 'Synthetic mobile demo allowance.']);
            if ($type->code === 'ANNUAL') {
                $annual = $type;
            }
        }
        if (! $history) {
            return;
        }
        $date = $today->addWeekdays(5);
        $leave = M\LeaveRequest::create(['organization_id' => $orgId, 'employee_id' => $employee->id, 'leave_type_id' => $annual->id, 'leave_period_id' => $period->id, 'requested_by_id' => $employee->user_id, 'starts_on' => $date, 'ends_on' => $date, 'total_days' => 1, 'status' => 'submitted', 'reason' => 'Synthetic mobile demo family appointment.', 'submitted_at' => now()]);
        $workflow = M\ApprovalWorkflow::where('organization_id', $orgId)->where('module', 'leave')->where('action', 'submit')->where('is_active', true)->firstOrFail();
        $step = $workflow->steps()->where('is_active', true)->orderBy('step_order')->firstOrFail();
        M\ApprovalRequest::create(['organization_id' => $orgId, 'approval_workflow_id' => $workflow->id, 'requester_id' => $employee->user_id, 'subject_employee_id' => $employee->id, 'approvable_type' => M\LeaveRequest::class, 'approvable_id' => $leave->id, 'module' => 'leave', 'action' => 'submit', 'title' => 'Mobile demo leave: '.$employee->employee_number, 'status' => 'pending', 'current_step_order' => $step->step_order, 'submitted_at' => now(), 'metadata' => ['synthetic_fixture' => 'mobile_v1']]);
        $shift = M\WorkShift::where('organization_id', $orgId)->where('code', $night ? 'NIGHT' : 'DAY')->firstOrFail();
        for ($i = 1; $i <= 5; $i++) {
            $day = $today->subWeekdays($i);
            $in = $day->setTime($night ? 20 : 8, $i === 2 ? 25 : 0);
            $out = $night ? $day->addDay()->setTime(8, 0) : $day->setTime(17, 0);
            M\AttendanceRecord::create(['organization_id' => $orgId, 'employee_id' => $employee->id, 'work_shift_id' => $shift->id, 'recorded_by_id' => $employee->user_id, 'attendance_date' => $day, 'check_in_at' => $in->utc(), 'check_out_at' => $out->utc(), 'duration_minutes' => $in->diffInMinutes($out) - 60, 'source' => 'manual', 'status' => $i === 2 ? 'late' : 'present', 'notes' => 'Synthetic mobile demo attendance.']);
        }
    }
}
