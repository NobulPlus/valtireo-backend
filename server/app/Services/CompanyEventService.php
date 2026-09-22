<?php

namespace App\Services;

use App\Models\CompanyEvent;
use App\Models\Department;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CompanyEventService
{
    public function __construct(private readonly NotificationDispatchService $notifications)
    {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(User $actor, array $data): CompanyEvent
    {
        return DB::transaction(function () use ($actor, $data): CompanyEvent {
            $department = $this->departmentFor($actor, $data['department_id'] ?? null);
            $this->authorizeScope($actor, $department);

            $event = CompanyEvent::query()->create([
                'organization_id' => $actor->organization_id,
                'department_id' => $department?->id,
                'created_by_user_id' => $actor->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'starts_on' => $data['starts_on'],
                'ends_on' => $data['ends_on'],
                'is_active' => $data['is_active'] ?? true,
            ]);

            if ($event->is_active) {
                $this->notifications->companyEventPublished($event->refresh(), $actor, $this->audience($event));
            }

            return $event->load(['department', 'createdBy']);
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(User $actor, CompanyEvent $event, array $data): CompanyEvent
    {
        $this->ensureSameOrganization($actor, $event);
        $nextDepartment = array_key_exists('department_id', $data)
            ? $this->departmentFor($actor, $data['department_id'])
            : $event->department;

        $this->authorizeManageEvent($actor, $event);
        $this->authorizeScope($actor, $nextDepartment);
        $this->ensureDateOrder(
            $data['starts_on'] ?? $event->starts_on?->toDateString(),
            $data['ends_on'] ?? $event->ends_on?->toDateString()
        );

        $event->update($data);

        return $event->refresh()->load(['department', 'createdBy']);
    }

    public function deactivate(User $actor, CompanyEvent $event): CompanyEvent
    {
        $this->ensureSameOrganization($actor, $event);
        $this->authorizeManageEvent($actor, $event);

        $event->update(['is_active' => false]);

        return $event->refresh()->load(['department', 'createdBy']);
    }

    public function visibleTo(User $actor): Builder
    {
        $query = CompanyEvent::query()
            ->with(['department', 'createdBy'])
            ->where('organization_id', $actor->organization_id);

        if ($this->canManageCompanyEvents($actor)) {
            return $query;
        }

        $departmentId = $actor->employee?->department_id;

        return $query->where('is_active', true)
            ->where(fn (Builder $query) => $query
                ->whereNull('department_id')
                ->when($departmentId, fn (Builder $query) => $query->orWhere('department_id', $departmentId)));
    }

    public function canManage(User $actor, CompanyEvent $event): bool
    {
        if ($event->organization_id !== $actor->organization_id) {
            return false;
        }

        if ($this->canManageCompanyEvents($actor)) {
            return true;
        }

        return $event->created_by_user_id === $actor->id
            && $event->department_id !== null
            && $this->isDepartmentHead($actor, $event->department);
    }

    private function authorizeManageEvent(User $actor, CompanyEvent $event): void
    {
        if (! $this->canManage($actor, $event)) {
            abort(403);
        }
    }

    private function authorizeScope(User $actor, ?Department $department): void
    {
        if ($department === null) {
            abort_unless($this->canManageCompanyEvents($actor), 403);

            return;
        }

        if ($this->canManageCompanyEvents($actor) || $this->isDepartmentHead($actor, $department)) {
            return;
        }

        throw ValidationException::withMessages([
            'department_id' => ['You can only create or manage events for a department you lead.'],
        ]);
    }

    private function isDepartmentHead(User $actor, ?Department $department): bool
    {
        return $department !== null
            && $actor->employee?->id !== null
            && $department->head_employee_id === $actor->employee->id;
    }

    private function canManageCompanyEvents(User $actor): bool
    {
        return $actor->can('company_events.manage') || $actor->can('organizations.administer');
    }

    private function departmentFor(User $actor, mixed $departmentId): ?Department
    {
        if (blank($departmentId)) {
            return null;
        }

        return Department::query()
            ->where('organization_id', $actor->organization_id)
            ->findOrFail((int) $departmentId);
    }

    private function ensureSameOrganization(User $actor, CompanyEvent $event): void
    {
        abort_unless($event->organization_id === $actor->organization_id, 404);
    }

    private function ensureDateOrder(mixed $startsOn, mixed $endsOn): void
    {
        if (! $startsOn || ! $endsOn) {
            return;
        }

        if (CarbonImmutable::parse($endsOn)->lt(CarbonImmutable::parse($startsOn))) {
            throw ValidationException::withMessages([
                'ends_on' => ['The end date must be after or equal to the start date.'],
            ]);
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function audience(CompanyEvent $event): Collection
    {
        return User::query()
            ->where('organization_id', $event->organization_id)
            ->whereHas('employee', fn (Builder $query) => $query
                ->where('status', 'active')
                ->when($event->department_id, fn (Builder $query, int $departmentId) => $query->where('department_id', $departmentId)))
            ->get()
            ->unique('id')
            ->values();
    }
}
