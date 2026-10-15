<?php

namespace Database\Seeders;

use App\Models as M;
use App\Notifications\ValtireoNotification;
use App\Services\DefaultApprovalWorkflowService;
use App\Services\DefaultRoleSeedingService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

/** Isolated, synthetic fixture. Never resets existing organizations or sends mail. */
class LashmaDemoSeeder extends Seeder
{
    private M\Organization $org;

    private CarbonImmutable $today;

    private array $staff = [];

    private array $departments = [];

    private array $locations = [];

    private array $clusters = [];

    private $roles;

    private string $password;

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('LASHMA synthetic data is restricted to local/testing environments.');
        }
        $existing = M\Organization::where('code', 'LASHMA-DEMO')->first();
        if ($existing) {
            if (data_get($existing->settings, 'demo_fixture.version') === 1) {
                $this->command?->info('LASHMA fixture already exists; preserved all subsequent test changes.');

                return;
            }
            throw new \RuntimeException('LASHMA-DEMO already exists without the fixture marker; refusing to overwrite it.');
        }
        if (M\User::where('email', 'like', '%@lashma.test')->exists()) {
            throw new \RuntimeException('Reserved @lashma.test accounts already exist; refusing to repurpose them.');
        }
        $this->today = CarbonImmutable::today('Africa/Lagos');
        $this->password = Hash::make('LashmaDemo2026!');
        $registrar = app(PermissionRegistrar::class);
        $previousTeam = $registrar->getPermissionsTeamId();
        try {
            DB::transaction(function (): void {
                $this->organization();
                $this->structure();
                $this->employees();
                $this->command?->info('Organization, locations and employees created. Seeding employee journeys...');
                $this->leaveAndAttendance();
                $this->documents();
                $this->ticketsAndAssets();
                $this->payroll();
                $settings = $this->org->settings;
                $settings['demo_fixture'] = ['version' => 1, 'anchor_date' => $this->today->toDateString(), 'synthetic' => true];
                $this->org->update(['settings' => $settings]);
            });
        } finally {
            $registrar->setPermissionsTeamId($previousTeam);
            $registrar->forgetCachedPermissions();
        }
        $this->command?->info('LASHMA-DEMO created: '.count($this->staff).' synthetic employees. Password: LashmaDemo2026!');
    }

    private function row(string $class, array $data)
    {
        return $class::create($class === M\EmployeeProfile::class ? $data : ['organization_id' => $this->org->id, ...$data]);
    }

    private function organization(): void
    {
        foreach (app(RolePermissionSeeder::class)->permissions() as $permission) {
            M\Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }
        $this->org = M\Organization::create([
            'code' => 'LASHMA-DEMO', 'name' => 'Lagos State Health Management Agency (Test)',
            'email' => 'admin@lashma.test', 'phone' => '+2340000000000', 'website' => 'https://lashma.test',
            'sector' => 'healthcare', 'status' => 'active', 'address' => 'Synthetic Test Headquarters, Alausa, Ikeja',
            'city' => 'Ikeja', 'state' => 'Lagos', 'country' => 'Nigeria',
            'settings' => [
                'identity' => ['short_name' => 'LASHMA Test', 'welcome_message' => 'Synthetic LASHMA testing workspace — no real employee records.', 'support_email' => 'ict@lashma.test'],
                'localization' => ['timezone' => 'Africa/Lagos', 'currency' => 'NGN', 'country' => 'Nigeria', 'date_format' => 'd/m/Y', 'time_format' => '24h'],
                'employee_experience' => ['allow_employee_directory' => true, 'allow_profile_corrections' => true, 'show_org_chart' => true],
            ],
        ]);
        app(PermissionRegistrar::class)->setPermissionsTeamId($this->org->id);
        $this->roles = app(DefaultRoleSeedingService::class)->seedForOrganization($this->org);
        $modules = M\PlatformModule::where('is_active', true)->get();
        if ($modules->isEmpty()) {
            throw new \RuntimeException('Seed the platform module catalogue first.');
        }
        foreach ($modules as $module) {
            $this->row(M\OrganizationModule::class, ['platform_module_id' => $module->id, 'status' => 'active', 'starts_at' => $this->today->subMonth(), 'expires_at' => null, 'settings' => []]);
        }
    }

    private function structure(): void
    {
        $departments = [
            'ACC' => ['Account', 'General Ledger', 'Payables', 'Receivables'],
            'FIN' => ['Finance', 'Budget and Planning', 'Treasury', 'Financial Reporting'],
            'ADM' => ['Admin', 'Human Resources', 'Procurement', 'Facilities'],
            'CSC' => ['Client Service', 'Enrollee Support', 'Contact Centre', 'Provider Relations'],
            'SAL' => ['Sales', 'Corporate Sales', 'Community Enrolment', 'Partnerships'],
            'ICT' => ['ICT', 'Application Support', 'Infrastructure', 'Data and Security'],
            'MED' => ['Medical', 'Clinical Quality', 'Claims Review', 'Provider Accreditation'],
            'REG' => ['Regulations', 'Compliance', 'Policy and Standards', 'Monitoring'],
            'PRE' => ['PRE', 'Planning', 'Research', 'Evaluation'],
            'AUD' => ['Audit', 'Internal Audit', 'Risk Assurance', 'Compliance Review'],
            'ACT' => ['Actuary', 'Pricing', 'Reserving', 'Risk Modelling'],
            'EXE' => ['Executive Office', 'Strategy', 'Secretariat', 'Governance'],
        ];
        foreach ($departments as $code => $data) {
            $department = $this->row(M\Department::class, ['code' => $code, 'name' => $data[0], 'description' => 'Synthetic testing department', 'is_active' => true]);
            $units = [];
            foreach (array_slice($data, 1) as $i => $name) {
                $units[] = $this->row(M\Unit::class, ['code' => "$code-U".($i + 1), 'name' => $name, 'department_id' => $department->id, 'is_active' => true]);
            }
            $this->departments[$code] = [$department, $units];
        }
        $locations = [
            ['HQ', 'Alausa Test Headquarters', 'Ikeja', 'Lagos', 'head_office'],
            ['IKJ', 'Ikeja Test Branch', 'Ikeja', 'Lagos', 'branch'],
            ['YAB', 'Yaba Test Branch', 'Yaba', 'Lagos', 'branch'],
            ['SUR', 'Surulere Test Branch', 'Surulere', 'Lagos', 'branch'],
            ['ISL', 'Lagos Island Test Branch', 'Lagos Island', 'Lagos', 'branch'],
            ['LEK', 'Lekki Test Branch', 'Lekki', 'Lagos', 'branch'],
            ['IKO', 'Ikorodu Test Branch', 'Ikorodu', 'Lagos', 'branch'],
            ['EPE', 'Epe Test Branch', 'Epe', 'Lagos', 'branch'],
            ['BAD', 'Badagry Test Branch', 'Badagry', 'Lagos', 'branch'],
            ['ALI', 'Alimosho Test Branch', 'Alimosho', 'Lagos', 'branch'],
            ['ABJ', 'Abuja Test Liaison Office', 'Abuja', 'FCT', 'branch'],
            ['ABE', 'Abeokuta Test Liaison Office', 'Abeokuta', 'Ogun', 'branch'],
        ];
        foreach ($locations as $i => [$code, $name, $city, $state, $type]) {
            $this->locations[] = $this->row(M\OrganizationLocation::class, ['code' => $code, 'name' => $name, 'type' => $type, 'city' => $city, 'state' => $state, 'country' => 'Nigeria', 'address' => 'Test location '.($i + 1).", $city (fictional office)", 'email' => strtolower($code).'@lashma.test', 'is_primary' => $i === 0, 'is_active' => true]);
        }
        foreach (['Ikeja', 'Lagos Island', 'Ikorodu', 'Epe', 'Badagry'] as $i => $name) {
            $cluster = $this->row(M\Cluster::class, ['code' => 'CL'.($i + 1), 'name' => "$name Test Cluster", 'department_id' => $this->departments['CSC'][0]->id, 'description' => 'Synthetic operational cluster', 'is_active' => true]);
            $cluster->locations()->sync(match ($i) {
                0 => [$this->locations[0]->id, $this->locations[1]->id, $this->locations[9]->id], 1 => [$this->locations[2]->id, $this->locations[3]->id, $this->locations[4]->id, $this->locations[5]->id], 2 => [$this->locations[6]->id], 3 => [$this->locations[7]->id], 4 => [$this->locations[8]->id]
            });
            $this->clusters[] = $cluster;
        }
    }

    private function employees(): void
    {
        $types = [];
        foreach (['PERM' => 'Permanent', 'CONT' => 'Contract', 'NYSC' => 'NYSC', 'INTERN' => 'Internship'] as $code => $name) {
            $types[] = $this->row(M\EmploymentType::class, compact('code', 'name') + ['is_active' => true]);
        }
        $grades = [];
        $designations = [];
        foreach ([7, 8, 9, 10, 12, 14, 16, 17] as $rank) {
            $grades[] = $this->row(M\GradeLevel::class, ['code' => 'GL'.$rank, 'name' => 'Test Grade '.$rank, 'rank' => $rank, 'is_active' => true]);
        }
        foreach (['Officer', 'Senior Officer', 'Principal Officer', 'Assistant Director', 'Department Head', 'Executive Director'] as $i => $name) {
            $designations[] = $this->row(M\Designation::class, ['code' => 'DES'.($i + 1), 'name' => $name, 'is_active' => true]);
        }
        $first = ['Adewale', 'Chioma', 'Aisha', 'Oluwaseun', 'Chinedu', 'Fatima', 'Tunde', 'Ngozi', 'Ibrahim', 'Temitope', 'Emeka', 'Zainab', 'Babatunde', 'Amaka', 'Musa', 'Folake', 'Chiamaka', 'Yusuf', 'Yetunde', 'Uche', 'Halima', 'Abimbola', 'Ifeanyi', 'Maryam'];
        $last = ['Adeyemi', 'Okafor', 'Bello', 'Akinyemi', 'Nwosu', 'Yusuf', 'Ogunleye', 'Eze', 'Abubakar', 'Balogun', 'Obi', 'Suleiman', 'Fashola', 'Ibrahim', 'Ajayi', 'Udo'];
        $director = M\User::create(['organization_id' => $this->org->id, 'name' => 'Temilade Adebayo (Test)', 'email' => 'admin@lashma.test', 'password' => $this->password, 'email_verified_at' => now()]);
        $director->assignRole($this->roles->get('organization_admin'));
        $chief = $this->row(M\Employee::class, ['user_id' => $director->id, 'employee_number' => 'LSH-000', 'first_name' => 'Temilade', 'last_name' => 'Adebayo', 'work_email' => $director->email, 'department_id' => $this->departments['EXE'][0]->id, 'unit_id' => $this->departments['EXE'][1][0]->id, 'designation_id' => $designations[5]->id, 'grade_level_id' => $grades[7]->id, 'employment_type_id' => $types[0]->id, 'organization_location_id' => $this->locations[0]->id, 'start_date' => $this->today->subYears(8), 'status' => 'active', 'confirmation_status' => 'confirmed', 'activated_at' => $this->today->subYears(8)]);
        $this->staff[] = $chief;
        $index = 0;
        foreach ($this->departments as $code => [$department, $units]) {
            $head = null;
            for ($i = 0; $i < ($code === 'CSC' ? 30 : 12); $i++) {
                $index++;
                $given = $first[($index - 1) % count($first)];
                $surname = $last[intdiv($index - 1, count($first)) % count($last)];
                $role = $i === 0 ? 'department_head' : 'employee';
                $email = 'employee'.str_pad((string) $index, 3, '0', STR_PAD_LEFT).'@lashma.test';
                if ($i === 0) {
                    $email = strtolower($code).'.head@lashma.test';
                }
                if ($code === 'ADM' && $i === 1) {
                    $email = 'hr@lashma.test';
                    $role = 'hr_officer';
                }
                if ($code === 'FIN' && $i === 1) {
                    $email = 'payroll@lashma.test';
                    $role = 'payroll_admin';
                }
                if ($code === 'ICT' && $i === 1) {
                    $email = 'ict@lashma.test';
                    $role = 'ict_admin';
                }
                if ($code === 'CSC' && $i === 1) {
                    $email = 'employee@lashma.test';
                }
                $user = M\User::create(['organization_id' => $this->org->id, 'name' => "$given $surname", 'email' => $email, 'password' => $this->password, 'email_verified_at' => now()]);
                $user->assignRole($this->roles->get($role));
                $cluster = $this->clusters[($index - 1) % 5];
                $location = $i === 0 ? $this->locations[0] : $this->locations[($index - 1) % count($this->locations)];
                $status = $code === 'EXE' && $i >= 9 ? ['onboarding', 'suspended', 'exited'][$i - 9] : 'active';
                $employee = $this->row(M\Employee::class, ['user_id' => $user->id, 'employee_number' => 'LSH-'.str_pad((string) $index, 3, '0', STR_PAD_LEFT), 'first_name' => $given, 'last_name' => $surname, 'work_email' => $email, 'phone' => '+234000'.str_pad((string) $index, 7, '0', STR_PAD_LEFT), 'department_id' => $department->id, 'unit_id' => $units[$i % 3]->id, 'cluster_id' => $code === 'CSC' ? $cluster->id : null, 'designation_id' => $designations[$i === 0 ? 4 : $i % 4]->id, 'grade_level_id' => $grades[$i === 0 ? 6 : $i % 5]->id, 'employment_type_id' => $types[$i > 8 ? $i % 4 : 0]->id, 'organization_location_id' => $location->id, 'reporting_manager_id' => $head?->id ?? $chief->id, 'start_date' => $this->today->subMonths(6 + $index % 84), 'status' => $status, 'confirmation_status' => $i === 11 ? 'probation' : 'confirmed', 'activated_at' => $status === 'active' ? $this->today->subMonths(6) : null, 'onboarding_completed_at' => $status === 'active' ? $this->today->subMonths(6) : null]);
                if ($i === 0) {
                    $head = $employee;
                    $department->update(['head_employee_id' => $head->id]);
                }
                $this->staff[] = $employee;
            }
        }
        foreach ($this->clusters as $i => $cluster) {
            $members = collect($this->staff)->where('cluster_id', $cluster->id)->values();
            $cluster->update(['manager_employee_id' => $members[0]->id, 'supervisor_employee_id' => $members[1]->id]);
            foreach ($members as $member) {
                $cluster->locations()->syncWithoutDetaching([$member->organization_location_id]);
            }
        }
        foreach ($this->staff as $i => $employee) {
            $this->row(M\EmployeeProfile::class, ['employee_id' => $employee->id, 'date_of_birth' => $this->today->subYears(24 + $i % 32)->subDays($i * 3), 'gender' => $i % 2 ? 'female' : 'male', 'personal_email' => 'personal'.$i.'@lashma.test', 'residential_address' => 'Test Residence '.($i + 1).', '.($i % 4 ? 'Lagos' : 'Ogun').', Nigeria', 'next_of_kin_name' => 'Synthetic Next of Kin '.$i, 'next_of_kin_phone' => '+2340000000000', 'completion_status' => $employee->status === 'onboarding' ? 'draft' : 'approved']);
            $this->row(M\EmployeeEmergencyContact::class, ['employee_id' => $employee->id, 'name' => 'Synthetic Emergency Contact '.$i, 'relationship' => 'Sibling', 'phone' => '+2340000000000', 'is_primary' => true]);
        }
    }

    private function approval($model, M\Employee $employee, string $module, string $status = 'pending', string $action = 'submit'): void
    {
        $workflow = M\ApprovalWorkflow::where('organization_id', $this->org->id)->where('module', $module)->where('action', $action)->firstOrFail();
        $step = $workflow->steps()->orderBy('step_order')->firstOrFail();
        $request = $this->row(M\ApprovalRequest::class, ['approval_workflow_id' => $workflow->id, 'requester_id' => $employee->user_id, 'subject_employee_id' => $employee->id, 'approvable_type' => $model::class, 'approvable_id' => $model->id, 'module' => $module, 'action' => $action, 'title' => 'Test '.$module.' request: '.$employee->employee_number, 'status' => $status, 'current_step_order' => $status === 'pending' ? $step->step_order : null, 'submitted_at' => $this->today->subDays(3), 'completed_at' => $status === 'pending' ? null : $this->today->subDay(), 'metadata' => ['synthetic_fixture' => true]]);
        if ($status !== 'pending') {
            $request->decisions()->create(['approval_workflow_step_id' => $step->id, 'actor_id' => $this->staff[0]->user_id, 'action' => $status === 'approved' ? 'approve' : ($status === 'rejected' ? 'reject' : 'request_changes'), 'previous_status' => 'pending', 'next_status' => $status, 'note' => 'Synthetic testing decision; please review the submitted details.', 'metadata' => []]);
        }
    }

    private function leaveAndAttendance(): void
    {
        foreach (['IT' => 'ICT Support', 'HR_POLICY' => 'HR and Policy', 'FAC' => 'Facilities', 'PAY' => 'Payroll Enquiry'] as $code => $name) {
            $this->row(M\TicketCategory::class, ['code' => $code, 'name' => $name, 'is_active' => true, 'response_sla_hours' => 8, 'resolution_sla_hours' => 48]);
        }
        app(DefaultApprovalWorkflowService::class)->seedForOrganization($this->org);
        $period = $this->row(M\LeavePeriod::class, ['name' => $this->today->year.' Leave Year', 'starts_on' => $this->today->startOfYear(), 'ends_on' => $this->today->endOfYear(), 'is_active' => true]);
        for ($day = 0; $day < 7; $day++) {
            $this->row(M\LeaveWorkDay::class, ['day_of_week' => $day, 'is_working_day' => $day > 0 && $day < 6]);
        }
        $types = [];
        foreach (['ANNUAL' => ['Annual Leave', 25], 'SICK' => ['Sick Leave', 12], 'COMP' => ['Compassionate Leave', 5], 'STUDY' => ['Study Leave', 10], 'MAT' => ['Maternity Leave', 90], 'PAT' => ['Paternity Leave', 10]] as $code => [$name, $days]) {
            $types[] = $this->row(M\LeaveType::class, ['code' => $code, 'name' => $name, 'default_days_per_year' => $days, 'auto_grant_on_activation' => true, 'is_paid' => true, 'requires_attachment' => $code === 'SICK', 'is_active' => true]);
        }
        $shift = $this->row(M\WorkShift::class, ['code' => 'DAY', 'name' => 'Day Shift', 'starts_at' => '08:00', 'ends_at' => '17:00', 'break_minutes' => 60, 'is_default' => true, 'is_active' => true, 'is_overnight' => false]);
        $this->row(M\WorkShift::class, ['code' => 'NIGHT', 'name' => 'Medical Night Shift', 'starts_at' => '20:00', 'ends_at' => '08:00', 'break_minutes' => 60, 'is_default' => false, 'is_active' => true, 'is_overnight' => true]);
        $this->row(M\AttendanceSetting::class, ['timezone' => 'Africa/Lagos', 'late_grace_minutes' => 10, 'early_checkout_grace_minutes' => 10, 'rounding_minutes' => 0, 'allow_employee_clock_in' => true, 'allow_employee_corrections' => true, 'require_approval_for_corrections' => true, 'allowed_sources' => ['manual', 'mobile']]);
        foreach ($this->staff as $i => $employee) {
            if ($employee->status !== 'active') {
                continue;
            }
            foreach ($types as $j => $type) {
                $this->row(M\LeaveEntitlement::class, ['employee_id' => $employee->id, 'leave_type_id' => $type->id, 'leave_period_id' => $period->id, 'days_allocated' => $type->default_days_per_year, 'days_used' => $j === 0 ? 1 : 0, 'days_pending' => $j === 0 ? 1 : 0, 'notes' => 'Synthetic test entitlement; not an official agency policy.']);
            }
            foreach (['approved', 'pending', 'rejected'] as $j => $status) {
                $date = $j === 0 ? $this->today->subWeekdays(5) : $this->today->addWeekdays(5 + $j * 4);
                $leave = $this->row(M\LeaveRequest::class, ['employee_id' => $employee->id, 'leave_type_id' => $types[0]->id, 'leave_period_id' => $period->id, 'requested_by_id' => $employee->user_id, 'starts_on' => $date, 'ends_on' => $date, 'total_days' => 1, 'status' => $status, 'reason' => ['Synthetic family appointment', 'Synthetic planned personal leave', 'Synthetic rejected leave scenario'][$j], 'handover_to_employee_id' => $this->staff[($i + 1) % count($this->staff)]->id, 'handover_note' => 'Please cover the test work queue during my absence.', 'submitted_at' => $this->today->subDays(3), 'reviewed_at' => $status === 'pending' ? null : $this->today->subDay()]);
                $this->approval($leave, $employee, 'leave', $status);
            }
            for ($day = 1; $day <= 22; $day++) {
                $date = $this->today->subWeekdays($day);
                $status = $day === 5 ? 'absent' : (($i + $day) % 9 === 0 ? 'late' : 'present');
                $in = $date->setTime(8, $status === 'late' ? 25 : 0);
                $record = $this->row(M\AttendanceRecord::class, ['employee_id' => $employee->id, 'work_shift_id' => $shift->id, 'recorded_by_id' => $employee->user_id, 'attendance_date' => $date, 'check_in_at' => $status === 'absent' ? null : $in->utc(), 'check_out_at' => $status === 'absent' ? null : $date->setTime(17, 0)->utc(), 'duration_minutes' => $status === 'absent' ? 0 : ($status === 'late' ? 455 : 480), 'source' => 'manual', 'status' => $status, 'notes' => $day === 5 ? 'Approved test leave day' : 'Synthetic attendance']);
                if ($day === 2 && $i % 5 === 0) {
                    $correction = $this->row(M\AttendanceCorrectionRequest::class, ['employee_id' => $employee->id, 'attendance_record_id' => $record->id, 'requested_by_id' => $employee->user_id, 'requested_check_in_at' => $date->setTime(8, 0)->utc(), 'requested_check_out_at' => $date->setTime(17, 0)->utc(), 'reason' => 'Synthetic clock terminal outage', 'status' => 'pending', 'submitted_at' => $this->today->subDay()]);
                    $this->approval($correction, $employee, 'attendance', 'pending', 'correction');
                }
            }
        }
        foreach ([['New Year (test calendar)', '01-01'], ['Workers Day (test calendar)', '05-01'], ['Democracy Day (test calendar)', '06-12'], ['Independence Day (test calendar)', '10-01'], ['Christmas (test calendar)', '12-25']] as [$name, $date]) {
            $this->row(M\LeaveHoliday::class, ['name' => $name, 'date' => $this->today->year.'-'.$date, 'is_active' => true]);
        }
        foreach (['Employee Orientation', 'Provider Quality Workshop', 'Claims Review Session', 'Cybersecurity Awareness', 'Community Enrolment Briefing', 'Quarterly Town Hall'] as $i => $title) {
            $this->row(M\CompanyEvent::class, ['title' => $title.' (Test)', 'description' => 'Synthetic event for calendar testing.', 'starts_on' => $this->today->addDays(2 + $i * 5), 'ends_on' => $this->today->addDays(2 + $i * 5), 'created_by_user_id' => $this->staff[0]->user_id, 'is_active' => true]);
        }
    }

    private function pdf(string $text): string
    {
        $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $stream = "BT /F1 12 Tf 40 760 Td (SYNTHETIC TEST DOCUMENT - NOT OFFICIAL) Tj 0 -30 Td ($safe) Tj ET";
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length '.strlen($stream).">>\nstream\n$stream\nendstream"];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n$object\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf."trailer << /Size 6 /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
    }

    private function documents(): void
    {
        foreach (['ID' => ['Test Identification', 'none'], 'POLICY' => ['Test Employee Handbook', 'acknowledge'], 'AGREEMENT' => ['Test Confidentiality Agreement', 'signed_copy']] as $code => [$name, $method]) {
            $type = $this->row(M\DocumentType::class, ['code' => $code, 'name' => $name, 'signature_method' => $method, 'requires_expiry_date' => $code === 'ID', 'default_reminder_days' => 30, 'employee_upload_allowed' => true, 'approval_required' => true, 'is_active' => true]);
            $requirement = $this->row(M\DocumentRequirement::class, ['document_type_id' => $type->id, 'name' => $name, 'is_required' => true, 'employee_upload_allowed' => true, 'approval_required' => true, 'is_active' => true, 'reminder_days' => 30]);
            foreach ($this->staff as $i => $employee) {
                if ($code === 'ID' && $i % 8 === 0) {
                    continue;
                }
                $bytes = $this->pdf($name.' - '.$employee->employee_number);
                $path = 'demo/lashma/'.$employee->employee_number.'/'.$code.'.pdf';
                Storage::disk('local')->put($path, $bytes);
                $status = $method === 'signed_copy' ? 'awaiting_signature' : ($code === 'ID' && $i % 5 === 0 ? 'submitted' : 'approved');
                $doc = $this->row(M\EmployeeDocument::class, ['employee_id' => $employee->id, 'document_type_id' => $type->id, 'document_requirement_id' => $requirement->id, 'uploaded_by_id' => $code === 'ID' ? $employee->user_id : $this->staff[0]->user_id, 'title' => $name, 'file_name' => "$code.pdf", 'file_path' => $path, 'mime_type' => 'application/pdf', 'file_size' => strlen($bytes), 'issued_at' => $this->today->subYear(), 'expires_at' => $code === 'ID' ? $this->today->addDays($i % 3 === 0 ? -10 : ($i % 3 === 1 ? 14 : 365)) : null, 'status' => $status, 'submitted_at' => $this->today->subWeek(), 'reviewed_at' => $status === 'approved' ? $this->today->subDays(4) : null, 'acknowledged_at' => $method === 'acknowledge' && $i % 2 === 0 ? $this->today->subDay() : null]);
                if ($status === 'submitted') {
                    $this->approval($doc, $employee, 'employee_documents');
                }
            }
        }
    }

    private function ticketsAndAssets(): void
    {
        $categories = M\TicketCategory::where('organization_id', $this->org->id)->get();
        $assetCategory = $this->row(M\AssetCategory::class, ['name' => 'Laptops', 'code' => 'LAPTOP', 'is_active' => true]);
        $phoneCategory = $this->row(M\AssetCategory::class, ['name' => 'Mobile Devices', 'code' => 'PHONE', 'is_active' => true]);
        $this->row(M\AssetCategory::class, ['name' => 'Office Equipment', 'code' => 'OFFICE', 'is_active' => true]);
        foreach ($this->staff as $i => $employee) {
            $asset = $this->row(M\Asset::class, ['asset_tag' => 'LSH-LAP-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT), 'name' => 'Test Laptop '.$employee->employee_number, 'serial_number' => 'SYNTHETIC-LAP-'.$i, 'asset_category_id' => $assetCategory->id, 'status' => 'assigned', 'condition' => 'good', 'assigned_to_employee_id' => $employee->id, 'assigned_at' => $this->today->subMonths(3), 'organization_location_id' => $employee->organization_location_id, 'purchase_date' => $this->today->subYear(), 'warranty_expires_at' => $this->today->addYear(), 'notes' => 'Synthetic equipment; no real serial number.']);
            $this->row(M\AssetAssignmentHistory::class, ['asset_id' => $asset->id, 'employee_id' => $employee->id, 'assigned_by_id' => $this->staff[0]->user_id, 'assigned_at' => $this->today->subMonths(3), 'issue_condition' => 'good']);
            if ($i % 3 === 0) {
                $this->row(M\Asset::class, ['asset_tag' => 'LSH-PHN-'.$i, 'name' => 'Test Work Phone', 'asset_category_id' => $phoneCategory->id, 'status' => 'assigned', 'condition' => 'good', 'assigned_to_employee_id' => $employee->id, 'assigned_at' => $this->today->subMonth(), 'organization_location_id' => $employee->organization_location_id]);
            }
            $count = $employee->work_email === 'employee@lashma.test' ? 60 : 3;
            for ($j = 0; $j < $count; $j++) {
                $status = ['submitted', 'in_progress', 'resolved', 'changes_requested', 'closed', 'cancelled'][$j % 6];
                $ticket = $this->row(M\Ticket::class, ['employee_id' => $employee->id, 'requested_by_id' => $employee->user_id, 'assigned_to_user_id' => M\User::where('email', 'ict@lashma.test')->value('id'), 'ticket_category_id' => $categories[$j % $categories->count()]->id, 'department_id' => $this->departments['ICT'][0]->id, 'subject' => ['Laptop connection issue', 'Policy clarification', 'Workspace equipment request', 'Payroll explanation'][$j % 4].' (Test '.($j + 1).')', 'description' => 'Synthetic employee request for testing comments, status changes and history. No real incident.', 'status' => $status, 'priority' => ['low', 'medium', 'high'][$j % 3], 'submitted_at' => $this->today->subDays($j + 1), 'resolved_at' => in_array($status, ['resolved', 'closed']) ? $this->today->subDay() : null, 'closed_at' => $status === 'closed' ? $this->today : null]);
                M\TicketComment::create(['ticket_id' => $ticket->id, 'user_id' => $employee->user_id, 'comment' => 'Synthetic follow-up: please review this test request.', 'visibility' => 'public']);
                M\TicketComment::create(['ticket_id' => $ticket->id, 'user_id' => $this->staff[0]->user_id, 'comment' => 'Test support response: we are reviewing your request.', 'visibility' => 'public']);
                if (in_array($status, ['submitted', 'changes_requested'])) {
                    $this->approval($ticket, $employee, 'service_desk', $status === 'submitted' ? 'pending' : 'changes_requested', strtolower($categories[$j % $categories->count()]->code));
                }
            }
            for ($j = 0; $j < ($employee->work_email === 'employee@lashma.test' ? 40 : 6); $j++) {
                DB::table('notifications')->insert(['id' => (string) Str::uuid(), 'type' => ValtireoNotification::class, 'notifiable_type' => M\User::class, 'notifiable_id' => $employee->user_id, 'data' => json_encode(['organization_id' => $this->org->id, 'category' => 'service_desk', 'event' => 'demo.ticket.updated', 'severity' => $j % 3 === 0 ? 'warning' : 'info', 'title' => 'Test request update '.($j + 1), 'message' => 'Synthetic activity for your LASHMA test workspace.', 'action_label' => 'View requests', 'action_url' => '/my-tickets', 'entity_type' => 'ticket', 'entity_id' => $ticket->id, 'metadata' => ['synthetic' => true]]), 'read_at' => $j % 2 ? null : $this->today, 'created_at' => $this->today->subHours($j + 1), 'updated_at' => $this->today]);
            }
        }
    }

    private function payroll(): void
    {
        $group = $this->row(M\PayGroup::class, ['code' => 'MONTHLY', 'name' => 'Synthetic Monthly Payroll', 'frequency' => 'monthly', 'pay_day' => 25, 'is_active' => true]);
        $compensations = [];
        foreach ($this->staff as $i => $employee) {
            if ($employee->status !== 'active') {
                continue;
            }
            $base = 180000 + ($i % 12) * 35000;
            $compensations[$employee->id] = $this->row(M\EmployeeCompensation::class, ['employee_id' => $employee->id, 'pay_group_id' => $group->id, 'base_salary' => $base, 'currency' => 'NGN', 'pay_frequency' => 'monthly', 'recurring_components' => [], 'effective_from' => $this->today->subYear()->startOfYear(), 'status' => 'active', 'created_by_id' => $this->staff[0]->user_id]);
        }
        for ($month = 1; $month <= 3; $month++) {
            $date = $this->today->subMonthsNoOverflow($month);
            $run = $this->row(M\PayrollRun::class, ['pay_group_id' => $group->id, 'reference' => 'LSH-DEMO-'.$date->format('Ym'), 'name' => $date->format('F Y').' — Synthetic Test Payroll', 'period_start' => $date->startOfMonth(), 'period_end' => $date->endOfMonth(), 'payment_date' => $date->day(25), 'currency' => 'NGN', 'status' => 'finalized', 'created_by_id' => $this->staff[0]->user_id, 'finalized_by_id' => $this->staff[0]->user_id, 'published_by_id' => $this->staff[0]->user_id, 'finalized_at' => $date->endOfMonth(), 'published_at' => $date->endOfMonth(), 'calculation_context' => ['synthetic' => true, 'note' => 'Illustrative amounts only; not Nigerian statutory payroll calculations.']]);
            $gross = 0;
            $deductions = 0;
            foreach ($this->staff as $employee) {
                if (! isset($compensations[$employee->id])) {
                    continue;
                }
                $comp = $compensations[$employee->id];
                $base = (float) $comp->base_salary;
                $deduction = 5000;
                $item = $this->row(M\PayrollRunItem::class, ['payroll_run_id' => $run->id, 'employee_id' => $employee->id, 'employee_compensation_id' => $comp->id, 'employee_number' => $employee->employee_number, 'employee_name' => $employee->first_name.' '.$employee->last_name, 'employment_snapshot' => ['department' => $employee->department?->name, 'synthetic' => true], 'period_days' => $date->daysInMonth, 'payable_days' => $date->daysInMonth, 'base_pay' => $base, 'gross_pay' => $base, 'total_deductions' => $deduction, 'net_pay' => $base - $deduction, 'status' => 'finalized', 'exceptions' => []]);
                foreach ([['BASIC', 'Test basic salary', 'earning', $base], ['TEST_DED', 'Illustrative test deduction', 'deduction', $deduction]] as [$code, $name, $type, $amount]) {
                    $this->row(M\PayrollRunItemLine::class, ['payroll_run_item_id' => $item->id, 'component_code' => $code, 'component_name' => $name, 'type' => $type, 'quantity' => 1, 'rate' => $amount, 'amount' => $amount, 'is_taxable' => false, 'is_statutory' => false, 'calculation_snapshot' => ['synthetic' => true]]);
                }
                $gross += $base;
                $deductions += $deduction;
            }
            $run->update(['employee_count' => count($compensations), 'total_gross' => $gross, 'total_deductions' => $deductions, 'total_net' => $gross - $deductions]);
        }
    }
}
