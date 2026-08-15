<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Designation;
use App\Models\DocumentRequirement;
use App\Models\DocumentType;
use App\Models\Employee;
use App\Models\EmploymentType;
use App\Models\GradeLevel;
use App\Models\LeaveEntitlement;
use App\Models\LeavePeriod;
use App\Models\LeaveType;
use App\Models\OrganizationLocation;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkShift;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TemplateImportService
{
    /** @var array<string, Model|null> Per-request lookup cache so repeated codes/numbers across rows don't re-query. */
    private array $lookupCache = [];

    public function __construct(
        private readonly TemplateRegistryService $templates,
        private readonly EmployeeOnboardingService $employees,
        private readonly AttendanceService $attendance,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function preview(User $user, string $key, UploadedFile $file): array
    {
        $template = $this->templates->findFor($user, $key);
        $rows = $this->parse($file, $template['columns']);
        $validated = $this->validateRows($user, $template['key'], $rows);

        return $this->response($template, $validated, false);
    }

    /**
     * @return array<string, mixed>
     */
    public function import(User $user, string $key, UploadedFile $file): array
    {
        $template = $this->templates->findFor($user, $key);
        $rows = $this->parse($file, $template['columns']);
        $validated = $this->validateRows($user, $template['key'], $rows);

        foreach ($validated as &$row) {
            if (! $row['valid']) {
                continue;
            }

            try {
                $imported = DB::transaction(fn () => $this->importRow($user, $template['key'], $row['data']));

                $row['imported'] = true;
                $row['record'] = [
                    'type' => class_basename($imported),
                    'id' => $imported->getKey(),
                ];
            } catch (ValidationException $exception) {
                $row['valid'] = false;
                $row['imported'] = false;
                $row['errors'] = $this->flattenErrors($exception->errors());
            } catch (\Throwable $exception) {
                $row['valid'] = false;
                $row['imported'] = false;
                $row['errors'] = ['row' => $exception->getMessage()];
            }
        }
        unset($row);

        return $this->response($template, $validated, true);
    }

    /**
     * @return array{template: array<string, mixed>, rows: array<int, array<string, mixed>>}
     */
    public function failedRows(User $user, string $key, UploadedFile $file): array
    {
        $template = $this->templates->findFor($user, $key);
        $rows = $this->parse($file, $template['columns']);
        $validated = $this->validateRows($user, $template['key'], $rows);

        return [
            'template' => $template,
            'rows' => array_values(array_filter($validated, fn (array $row) => ! $row['valid'])),
        ];
    }

    /**
     * @param array<int, string> $expectedColumns
     * @return array<int, array{row_number: int, data: array<string, string|null>}>
     */
    private function parse(UploadedFile $file, array $expectedColumns): array
    {
        $handle = fopen($file->getRealPath(), 'r');

        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => ['The uploaded CSV file could not be read.'],
            ]);
        }

        $header = fgetcsv($handle);

        if ($header === false) {
            fclose($handle);

            throw ValidationException::withMessages([
                'file' => ['The uploaded CSV file is empty.'],
            ]);
        }

        $header = array_map(fn ($value) => trim((string) $value), $header);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0] ?? '');

        if ($header !== $expectedColumns) {
            fclose($handle);

            throw ValidationException::withMessages([
                'file' => ['The CSV header does not match the selected template. Download the latest template and try again.'],
            ]);
        }

        $rows = [];
        $rowNumber = 1;

        while (($values = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $values = array_slice(array_pad($values, count($header), null), 0, count($header));
            $rows[] = [
                'row_number' => $rowNumber,
                'data' => array_combine($header, array_map(fn ($value) => $this->clean($value), $values)),
            ];
        }

        fclose($handle);

        return $rows;
    }

    /**
     * @param array<int, array{row_number: int, data: array<string, string|null>}> $rows
     * @return array<int, array<string, mixed>>
     */
    private function validateRows(User $user, string $key, array $rows): array
    {
        return array_map(function (array $row) use ($user, $key): array {
            $errors = match ($key) {
                'attendance_import' => $this->validateAttendanceRow($user, $row['data']),
                'employee_import' => $this->validateEmployeeRow($user, $row['data']),
                'leave_entitlement_import' => $this->validateLeaveEntitlementRow($user, $row['data']),
                'document_requirement_import' => $this->validateDocumentRequirementRow($user, $row['data']),
                default => ['template' => 'Unsupported import template.'],
            };

            return [
                'row_number' => $row['row_number'],
                'data' => $row['data'],
                'valid' => $errors === [],
                'errors' => $errors,
                'imported' => false,
            ];
        }, $rows);
    }

    /**
     * @param array<string, string|null> $row
     * @return array<string, string>
     */
    private function validateAttendanceRow(User $user, array $row): array
    {
        $errors = [];
        $employee = $this->employeeByNumber($user, $row['employee_number'] ?? null);

        if (! $employee) {
            $errors['employee_number'] = 'Employee number was not found in this organization.';
        } elseif (! $user->can('attendance.update') && $user->employee?->id !== $employee->id) {
            $errors['employee_number'] = 'You can only import your own attendance rows.';
        }

        if (! $this->filled($row['attendance_date'] ?? null) || ! $this->validDate($row['attendance_date'])) {
            $errors['attendance_date'] = 'Attendance date must be a valid date.';
        }

        if ($this->filled($row['check_in_at'] ?? null) && ! $this->validDate($row['check_in_at'])) {
            $errors['check_in_at'] = 'Check-in time must be a valid date/time.';
        }

        if ($this->filled($row['check_out_at'] ?? null) && ! $this->validDate($row['check_out_at'])) {
            $errors['check_out_at'] = 'Check-out time must be a valid date/time.';
        }

        if (
            $this->filled($row['check_in_at'] ?? null)
            && $this->filled($row['check_out_at'] ?? null)
            && $this->validDate($row['check_in_at'])
            && $this->validDate($row['check_out_at'])
            && Carbon::parse($row['check_out_at'])->lt(Carbon::parse($row['check_in_at']))
        ) {
            $errors['check_out_at'] = 'Check-out time must be after or equal to check-in time.';
        }

        if ($this->filled($row['source'] ?? null) && ! in_array($row['source'], ['manual', 'employee', 'import', 'device'], true)) {
            $errors['source'] = 'Source must be manual, employee, import, or device.';
        }

        if ($this->filled($row['status'] ?? null) && ! in_array($row['status'], ['present', 'absent', 'late', 'half_day', 'corrected'], true)) {
            $errors['status'] = 'Status must be present, absent, late, half_day, or corrected.';
        }

        if ($this->filled($row['work_shift_code'] ?? null) && ! $this->byCode(WorkShift::class, $user, $row['work_shift_code'])) {
            $errors['work_shift_code'] = 'Work shift code was not found in this organization.';
        }

        return $errors;
    }

    /**
     * @param array<string, string|null> $row
     * @return array<string, string>
     */
    private function validateEmployeeRow(User $user, array $row): array
    {
        $errors = [];

        foreach (['employee_number', 'first_name', 'last_name', 'work_email', 'department_code', 'designation_code', 'employment_type_code', 'location_code'] as $field) {
            if (! $this->filled($row[$field] ?? null)) {
                $errors[$field] = 'This field is required.';
            }
        }

        if ($this->filled($row['work_email'] ?? null) && ! filter_var($row['work_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['work_email'] = 'Work email must be a valid email address.';
        }

        if ($this->filled($row['employee_number'] ?? null) && $this->employeeByNumber($user, $row['employee_number'])) {
            $errors['employee_number'] = 'Employee number already exists in this organization.';
        }

        if ($this->filled($row['work_email'] ?? null) && Employee::query()->where('organization_id', $user->organization_id)->where('work_email', $row['work_email'])->exists()) {
            $errors['work_email'] = 'Work email already exists in this organization.';
        }

        $department = $this->byCode(Department::class, $user, $row['department_code'] ?? null);
        if ($this->filled($row['department_code'] ?? null) && ! $department) {
            $errors['department_code'] = 'Department code was not found in this organization.';
        }

        $unit = $this->byCode(Unit::class, $user, $row['unit_code'] ?? null);
        if ($this->filled($row['unit_code'] ?? null) && ! $unit) {
            $errors['unit_code'] = 'Unit code was not found in this organization.';
        } elseif ($unit && $department && $unit->department_id !== $department->id) {
            $errors['unit_code'] = 'Unit code does not belong to the selected department.';
        }

        if ($this->filled($row['designation_code'] ?? null) && ! $this->byCode(Designation::class, $user, $row['designation_code'])) {
            $errors['designation_code'] = 'Designation code was not found in this organization.';
        }

        if ($this->filled($row['grade_level_code'] ?? null) && ! $this->byCode(GradeLevel::class, $user, $row['grade_level_code'])) {
            $errors['grade_level_code'] = 'Grade level code was not found in this organization.';
        }

        if ($this->filled($row['employment_type_code'] ?? null) && ! $this->byCode(EmploymentType::class, $user, $row['employment_type_code'])) {
            $errors['employment_type_code'] = 'Employment type code was not found in this organization.';
        }

        if ($this->filled($row['location_code'] ?? null) && ! $this->byCode(OrganizationLocation::class, $user, $row['location_code'])) {
            $errors['location_code'] = 'Location code was not found in this organization.';
        }

        if ($this->filled($row['reporting_manager_number'] ?? null) && ! $this->employeeByNumber($user, $row['reporting_manager_number'])) {
            $errors['reporting_manager_number'] = 'Reporting manager number was not found in this organization.';
        }

        if ($this->filled($row['start_date'] ?? null) && ! $this->validDate($row['start_date'])) {
            $errors['start_date'] = 'Start date must be a valid date.';
        }

        if ($this->filled($row['send_invitation'] ?? null) && $this->bool($row['send_invitation']) === null) {
            $errors['send_invitation'] = 'Send invitation must be true or false.';
        }

        return $errors;
    }

    /**
     * @param array<string, string|null> $row
     * @return array<string, string>
     */
    private function validateLeaveEntitlementRow(User $user, array $row): array
    {
        $errors = [];

        if (! $this->employeeByNumber($user, $row['employee_number'] ?? null)) {
            $errors['employee_number'] = 'Employee number was not found in this organization.';
        }

        if (! $this->byCode(LeaveType::class, $user, $row['leave_type_code'] ?? null)) {
            $errors['leave_type_code'] = 'Leave type code was not found in this organization.';
        }

        if (! $this->leavePeriodByName($user, $row['leave_period_name'] ?? null)) {
            $errors['leave_period_name'] = 'Leave period name was not found in this organization.';
        }

        if (! is_numeric($row['days_allocated'] ?? null) || (float) $row['days_allocated'] < 0) {
            $errors['days_allocated'] = 'Days allocated must be a number greater than or equal to zero.';
        }

        return $errors;
    }

    /**
     * @param array<string, string|null> $row
     * @return array<string, string>
     */
    private function validateDocumentRequirementRow(User $user, array $row): array
    {
        $errors = [];

        if (! $this->byCode(DocumentType::class, $user, $row['document_type_code'] ?? null)) {
            $errors['document_type_code'] = 'Document type code was not found in this organization.';
        }

        if (! $this->filled($row['requirement_name'] ?? null)) {
            $errors['requirement_name'] = 'Requirement name is required.';
        }

        foreach (['is_required', 'employee_upload_allowed', 'approval_required', 'is_active'] as $field) {
            if ($this->filled($row[$field] ?? null) && $this->bool($row[$field]) === null) {
                $errors[$field] = 'This value must be true or false.';
            }
        }

        if ($this->filled($row['reminder_days'] ?? null) && (! ctype_digit((string) $row['reminder_days']) || (int) $row['reminder_days'] > 365)) {
            $errors['reminder_days'] = 'Reminder days must be an integer between 0 and 365.';
        }

        if ($this->filled($row['department_code'] ?? null) && ! $this->byCode(Department::class, $user, $row['department_code'])) {
            $errors['department_code'] = 'Department code was not found in this organization.';
        }

        if ($this->filled($row['designation_code'] ?? null) && ! $this->byCode(Designation::class, $user, $row['designation_code'])) {
            $errors['designation_code'] = 'Designation code was not found in this organization.';
        }

        if ($this->filled($row['grade_level_code'] ?? null) && ! $this->byCode(GradeLevel::class, $user, $row['grade_level_code'])) {
            $errors['grade_level_code'] = 'Grade level code was not found in this organization.';
        }

        if ($this->filled($row['employment_type_code'] ?? null) && ! $this->byCode(EmploymentType::class, $user, $row['employment_type_code'])) {
            $errors['employment_type_code'] = 'Employment type code was not found in this organization.';
        }

        if ($this->filled($row['location_code'] ?? null) && ! $this->byCode(OrganizationLocation::class, $user, $row['location_code'])) {
            $errors['location_code'] = 'Location code was not found in this organization.';
        }

        return $errors;
    }

    /**
     * @param array<string, string|null> $row
     */
    private function importRow(User $user, string $key, array $row): Model
    {
        return match ($key) {
            'attendance_import' => $this->importAttendance($user, $row),
            'employee_import' => $this->importEmployee($user, $row),
            'leave_entitlement_import' => $this->importLeaveEntitlement($user, $row),
            'document_requirement_import' => $this->importDocumentRequirement($user, $row),
            default => throw ValidationException::withMessages(['template' => ['Unsupported import template.']]),
        };
    }

    /**
     * @param array<string, string|null> $row
     */
    private function importAttendance(User $user, array $row): Model
    {
        $employee = $this->employeeByNumber($user, $row['employee_number']);
        $shift = $this->byCode(WorkShift::class, $user, $row['work_shift_code'] ?? null);

        return $this->attendance->createRecord($user, [
            'employee_id' => $employee->id,
            'attendance_date' => $row['attendance_date'],
            'check_in_at' => $row['check_in_at'] ?? null,
            'check_out_at' => $row['check_out_at'] ?? null,
            'source' => $row['source'] ?: 'import',
            'work_shift_id' => $shift?->id,
            'status' => $row['status'] ?: null,
            'notes' => $row['notes'] ?? null,
        ]);
    }

    /**
     * @param array<string, string|null> $row
     */
    private function importEmployee(User $user, array $row): Model
    {
        $result = $this->employees->createEmployee($user, [
            'employee_number' => $row['employee_number'],
            'first_name' => $row['first_name'],
            'middle_name' => $row['middle_name'] ?: null,
            'last_name' => $row['last_name'],
            'work_email' => $row['work_email'],
            'phone' => $row['phone'] ?: null,
            'department_id' => $this->byCode(Department::class, $user, $row['department_code'])->id,
            'unit_id' => $this->byCode(Unit::class, $user, $row['unit_code'] ?? null)?->id,
            'designation_id' => $this->byCode(Designation::class, $user, $row['designation_code'])->id,
            'grade_level_id' => $this->byCode(GradeLevel::class, $user, $row['grade_level_code'] ?? null)?->id,
            'employment_type_id' => $this->byCode(EmploymentType::class, $user, $row['employment_type_code'])->id,
            'organization_location_id' => $this->byCode(OrganizationLocation::class, $user, $row['location_code'])->id,
            'reporting_manager_id' => $this->employeeByNumber($user, $row['reporting_manager_number'] ?? null)?->id,
            'start_date' => $row['start_date'] ?: null,
        ], $this->bool($row['send_invitation'] ?? null) ?? false);

        return $result['employee'];
    }

    /**
     * @param array<string, string|null> $row
     */
    private function importLeaveEntitlement(User $user, array $row): Model
    {
        $employee = $this->employeeByNumber($user, $row['employee_number']);
        $leaveType = $this->byCode(LeaveType::class, $user, $row['leave_type_code']);
        $period = $this->leavePeriodByName($user, $row['leave_period_name']);

        $entitlement = LeaveEntitlement::query()->firstOrNew([
            'organization_id' => $user->organization_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'leave_period_id' => $period->id,
        ]);

        if (! $entitlement->exists) {
            $entitlement->days_used = 0;
            $entitlement->days_pending = 0;
        }

        $entitlement->days_allocated = (float) $row['days_allocated'];
        $entitlement->notes = $row['notes'] ?: null;
        $entitlement->save();

        return $entitlement;
    }

    /**
     * @param array<string, string|null> $row
     */
    private function importDocumentRequirement(User $user, array $row): Model
    {
        $documentType = $this->byCode(DocumentType::class, $user, $row['document_type_code']);

        return DocumentRequirement::query()->updateOrCreate(
            [
                'organization_id' => $user->organization_id,
                'document_type_id' => $documentType->id,
                'name' => $row['requirement_name'],
            ],
            [
                'description' => $row['description'] ?: null,
                'is_required' => $this->bool($row['is_required'] ?? null) ?? true,
                'employee_upload_allowed' => $this->bool($row['employee_upload_allowed'] ?? null) ?? true,
                'approval_required' => $this->bool($row['approval_required'] ?? null) ?? true,
                'reminder_days' => $this->filled($row['reminder_days'] ?? null) ? (int) $row['reminder_days'] : null,
                'department_id' => $this->byCode(Department::class, $user, $row['department_code'] ?? null)?->id,
                'designation_id' => $this->byCode(Designation::class, $user, $row['designation_code'] ?? null)?->id,
                'grade_level_id' => $this->byCode(GradeLevel::class, $user, $row['grade_level_code'] ?? null)?->id,
                'employment_type_id' => $this->byCode(EmploymentType::class, $user, $row['employment_type_code'] ?? null)?->id,
                'organization_location_id' => $this->byCode(OrganizationLocation::class, $user, $row['location_code'] ?? null)?->id,
                'is_active' => $this->bool($row['is_active'] ?? null) ?? true,
            ]
        );
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    private function response(array $template, array $rows, bool $imported): array
    {
        $valid = collect($rows)->where('valid', true)->count();
        $failed = collect($rows)->where('valid', false)->count();

        return [
            'template' => [
                'key' => $template['key'],
                'name' => $template['name'],
                'module' => $template['module'],
            ],
            'summary' => [
                'total_rows' => count($rows),
                'valid_rows' => $valid,
                'invalid_rows' => $failed,
                'imported_rows' => $imported ? collect($rows)->where('imported', true)->count() : 0,
                'failed_rows' => $imported ? $failed : 0,
            ],
            'rows' => array_values($rows),
        ];
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function filled(?string $value): bool
    {
        return $value !== null && trim($value) !== '';
    }

    private function bool(?string $value): ?bool
    {
        if (! $this->filled($value)) {
            return null;
        }

        return match (strtolower(trim($value))) {
            '1', 'true', 'yes', 'y' => true,
            '0', 'false', 'no', 'n' => false,
            default => null,
        };
    }

    private function validDate(?string $value): bool
    {
        if (! $this->filled($value)) {
            return false;
        }

        try {
            Carbon::parse($value);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function employeeByNumber(User $user, ?string $number): ?Employee
    {
        if (! $this->filled($number)) {
            return null;
        }

        $cacheKey = 'employee_number:'.$user->organization_id.':'.$number;

        if (! array_key_exists($cacheKey, $this->lookupCache)) {
            $this->lookupCache[$cacheKey] = Employee::query()
                ->where('organization_id', $user->organization_id)
                ->where('employee_number', $number)
                ->first();
        }

        return $this->lookupCache[$cacheKey];
    }

    /**
     * @template TModel of Model
     * @param class-string<TModel> $model
     * @return TModel|null
     */
    private function byCode(string $model, User $user, ?string $code): ?Model
    {
        if (! $this->filled($code)) {
            return null;
        }

        $cacheKey = 'code:'.$model.':'.$user->organization_id.':'.$code;

        if (! array_key_exists($cacheKey, $this->lookupCache)) {
            $this->lookupCache[$cacheKey] = $model::query()
                ->where('organization_id', $user->organization_id)
                ->where('code', $code)
                ->first();
        }

        return $this->lookupCache[$cacheKey];
    }

    private function leavePeriodByName(User $user, ?string $name): ?LeavePeriod
    {
        if (! $this->filled($name)) {
            return null;
        }

        $cacheKey = 'leave_period_name:'.$user->organization_id.':'.$name;

        if (! array_key_exists($cacheKey, $this->lookupCache)) {
            $this->lookupCache[$cacheKey] = LeavePeriod::query()
                ->where('organization_id', $user->organization_id)
                ->where('name', $name)
                ->first();
        }

        return $this->lookupCache[$cacheKey];
    }

    /**
     * @param array<string, array<int, string>> $errors
     * @return array<string, string>
     */
    private function flattenErrors(array $errors): array
    {
        return collect($errors)
            ->map(fn (array $messages) => $messages[0] ?? 'Invalid value.')
            ->all();
    }
}
