<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAppreciation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class EmployeeLifestyleService
{
    public const DEFAULTS = [
        'share_birthday' => false,
        'share_anniversary' => false,
        'receive_appreciation' => false,
        'appreciation_notifications' => false,
        'allow_shared_appreciation' => false,
    ];

    public function employee(User $actor): Employee
    {
        return Employee::where('organization_id', $actor->organization_id)
            ->where('user_id', $actor->id)->where('status', 'active')->firstOrFail();
    }

    public function enabled(User $actor, string $feature): void
    {
        abort_unless((bool) data_get($actor->organization?->settings, "lifestyle.{$feature}_enabled", false), 403, 'This lifestyle feature is disabled for your organization.');
    }

    public function preferences(Employee $employee): array
    {
        $stored = DB::table('employee_lifestyle_preferences')->where('employee_id', $employee->id)->first();

        return collect(self::DEFAULTS)->map(fn ($default, $key) => (bool) ($stored?->$key ?? $default))->all();
    }

    public function summary(Employee $employee): array
    {
        return ['id' => $employee->id, 'name' => trim($employee->first_name.' '.$employee->last_name)];
    }

    public function milestones(User $actor, int $days): array
    {
        $this->employee($actor);
        $this->enabled($actor, 'milestones');
        $today = CarbonImmutable::today(data_get($actor->organization->settings, 'localization.timezone', 'Africa/Lagos'));
        $end = $today->addDays($days - 1);
        $result = [];
        $employees = Employee::with('profile')->where('organization_id', $actor->organization_id)->where('status', 'active')
            ->whereIn('id', DB::table('employee_lifestyle_preferences')->select('employee_id')->where(fn ($q) => $q->where('share_birthday', true)->orWhere('share_anniversary', true)))->get();
        $preferences = DB::table('employee_lifestyle_preferences')->whereIn('employee_id', $employees->modelKeys())->get()->keyBy('employee_id');
        foreach ($employees as $employee) {
            $pref = $preferences[$employee->id];
            foreach (['birthday' => $employee->profile?->date_of_birth, 'anniversary' => $employee->start_date] as $type => $date) {
                $key = 'share_'.$type;
                if (! $pref->$key || ! $date) {
                    continue;
                }
                $original = CarbonImmutable::parse($date);
                for ($year = $today->year; $year <= $end->year; $year++) {
                    // Feb 29 is celebrated on Feb 28 in non-leap years.
                    $month = $today->setDate($year, $original->month, 1);
                    $occurrence = $month->day(min($original->day, $month->daysInMonth));
                    if ($occurrence->lt($today) || $occurrence->gt($end) || $year <= $original->year) {
                        continue;
                    }
                    $result[] = ['employee' => $this->summary($employee), 'type' => $type, 'date' => $occurrence->toDateString(), ...($type === 'anniversary' ? ['years_of_service' => $year - $original->year] : [])];
                }
            }
        }

        return collect($result)->sortBy(fn ($row) => $row['date'].'-'.$row['employee']['id'].'-'.$row['type'])->values()->all();
    }

    public function visibleAppreciations(Employee $employee): Builder
    {
        return EmployeeAppreciation::with(['sender', 'recipient'])->where('organization_id', $employee->organization_id)
            ->whereNull('hidden_at')
            ->whereHas('sender', fn ($q) => $q->where('status', 'active')->where('organization_id', $employee->organization_id))
            ->whereHas('recipient', fn ($q) => $q->where('status', 'active')->where('organization_id', $employee->organization_id))
            ->where(function ($q) use ($employee) {
                $q->where('sender_employee_id', $employee->id)->orWhere('recipient_employee_id', $employee->id)
                    ->orWhere(fn ($shared) => $shared->where('visibility', 'shared')->whereIn('recipient_employee_id', DB::table('employee_lifestyle_preferences')->select('employee_id')->where('receive_appreciation', true)->where('allow_shared_appreciation', true)));
            });
    }

    public function appreciation(EmployeeAppreciation $record): array
    {
        return ['id' => $record->id, 'sender' => $this->summary($record->sender), 'recipient' => $this->summary($record->recipient), 'message' => $record->message, 'visibility' => $record->visibility, 'created_at' => $record->created_at->toISOString()];
    }
}
