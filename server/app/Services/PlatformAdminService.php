<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmployeeInvitation;
use App\Models\LeaveRequest;
use App\Models\Organization;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformAdminService
{
    public function __construct(private readonly WorkspaceSettingsService $workspaceSettings)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboard(Request $request): array
    {
        $filters = $this->dashboardFilters($request);
        $organizations = $this->dashboardOrganizationQuery($filters);
        $organizationIds = (clone $organizations)->pluck('id');

        return [
            'filters' => $filters,
            'summary' => [
                'organizations_total' => (clone $organizations)->count(),
                'organizations_active' => (clone $organizations)->where('status', 'active')->count(),
                'organizations_invited' => (clone $organizations)->where('status', 'invited')->count(),
                'organizations_setup' => (clone $organizations)->whereIn('status', ['setup', 'setup_in_progress'])->count(),
                'organizations_suspended' => (clone $organizations)->where('status', 'suspended')->count(),
                'users_total' => User::query()->whereIn('organization_id', $organizationIds)->count(),
                'employees_total' => Employee::query()->whereIn('organization_id', $organizationIds)->count(),
                'pending_invitations' => EmployeeInvitation::query()->whereIn('organization_id', $organizationIds)->where('status', 'pending')->count(),
                'pending_documents' => EmployeeDocument::query()->whereIn('organization_id', $organizationIds)->where('status', 'submitted')->count(),
                'pending_leave_requests' => LeaveRequest::query()->whereIn('organization_id', $organizationIds)->where('status', 'submitted')->count(),
            ],
            'organizations_by_status' => $this->statusBreakdown($filters),
            'module_adoption' => $this->moduleAdoption($organizationIds->all()),
            'recent_organizations' => $this->dashboardOrganizationQuery($filters)
                ->latest()
                ->limit(15)
                ->get()
                ->map(fn (Organization $organization) => $this->organizationSummary($organization))
                ->values(),
            'attention' => [
                'setup_incomplete' => $this->dashboardOrganizationQuery($filters)->whereIn('status', ['invited', 'setup', 'setup_in_progress'])->count(),
                'without_modules' => $this->dashboardOrganizationQuery($filters)
                    ->whereDoesntHave('moduleSubscriptions', fn (Builder $query) => $query->whereIn('status', ['active', 'trial']))
                    ->count(),
                'without_admins' => $this->dashboardOrganizationQuery($filters)
                    ->whereDoesntHave('users.roles', fn (Builder $query) => $query->where('name', 'Organization Admin'))
                    ->count(),
            ],
            'attention_details' => [
                'setup_incomplete' => $this->attentionOrganizations(
                    $this->dashboardOrganizationQuery($filters)->whereIn('status', ['invited', 'setup', 'setup_in_progress'])
                ),
                'without_modules' => $this->attentionOrganizations(
                    $this->dashboardOrganizationQuery($filters)
                        ->whereDoesntHave('moduleSubscriptions', fn (Builder $query) => $query->whereIn('status', ['active', 'trial']))
                ),
                'without_admins' => $this->attentionOrganizations(
                    $this->dashboardOrganizationQuery($filters)
                        ->whereDoesntHave('users.roles', fn (Builder $query) => $query->where('name', 'Organization Admin'))
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function dashboardFilters(Request $request): array
    {
        return [
            'date_from' => $request->date('date_from')?->toDateString(),
            'date_to' => $request->date('date_to')?->toDateString(),
            'status' => $request->string('status')->toString() ?: null,
            'search' => $request->string('search')->toString() ?: null,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     *
     * @return Builder<Organization>
     */
    private function dashboardOrganizationQuery(array $filters): Builder
    {
        return Organization::query()
            ->when($filters['status'], fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['search'], function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('country', 'like', "%{$search}%");
                });
            })
            ->when($filters['date_from'], fn (Builder $query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn (Builder $query, string $date) => $query->whereDate('created_at', '<=', $date));
    }

    /**
     * @return array<string, mixed>
     */
    public function organizations(Request $request): array
    {
        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $organizations = $this->organizationListQuery($request)->paginate($perPage);

        return [
            'data' => $organizations->getCollection()->map(fn (Organization $organization) => $this->organizationSummary($organization))->values(),
            'meta' => [
                'current_page' => $organizations->currentPage(),
                'from' => $organizations->firstItem(),
                'last_page' => $organizations->lastPage(),
                'per_page' => $organizations->perPage(),
                'to' => $organizations->lastItem(),
                'total' => $organizations->total(),
            ],
        ];
    }

    public function exportOrganizations(Request $request): StreamedResponse
    {
        $filename = 'valtireo-organizations-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Organization',
                'Code',
                'Status',
                'Country',
                'Users',
                'Employees',
                'Module Subscriptions',
                'Created At',
            ]);

            $this->organizationListQuery($request)
                ->chunk(200, function ($organizations) use ($handle): void {
                    foreach ($organizations as $organization) {
                        fputcsv($handle, [
                            $organization->name,
                            $organization->code,
                            $organization->status,
                            $organization->country,
                            $organization->users_count,
                            $organization->employees_count,
                            $organization->module_subscriptions_count,
                            $organization->created_at?->toDateTimeString(),
                        ]);
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * @return Builder<Organization>
     */
    private function organizationListQuery(Request $request): Builder
    {
        [$sortBy, $sortDirection] = $this->organizationSort($request);

        return Organization::query()
            ->withCount(['users', 'employees', 'moduleSubscriptions'])
            ->when($request->string('search')->toString(), function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('country', 'like', "%{$search}%");
                });
            })
            ->when($request->string('status')->toString(), fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($request->date('date_from'), fn (Builder $query, $date) => $query->whereDate('created_at', '>=', $date->toDateString()))
            ->when($request->date('date_to'), fn (Builder $query, $date) => $query->whereDate('created_at', '<=', $date->toDateString()))
            ->orderBy($sortBy, $sortDirection);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function organizationSort(Request $request): array
    {
        $sortBy = $request->string('sort_by', 'created_at')->toString();
        $sortDirection = strtolower($request->string('sort_direction', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $sortBy = in_array($sortBy, ['name', 'code', 'status', 'country', 'created_at', 'updated_at', 'employees_count', 'module_subscriptions_count'], true)
            ? $sortBy
            : 'created_at';

        return [$sortBy, $sortDirection];
    }

    /**
     * @return array<string, mixed>
     */
    public function organization(Organization $organization): array
    {
        $organization->load([
            'locations',
            'moduleSubscriptions.platformModule',
            'users.roles',
        ]);

        return [
            'organization' => [
                ...$this->organizationSummary($organization),
                'email' => $organization->email,
                'phone' => $organization->phone,
                'website' => $organization->website,
                'sector' => $organization->sector,
                'address' => $organization->address,
                'city' => $organization->city,
                'state' => $organization->state,
                'country' => $organization->country,
                'created_at' => $organization->created_at,
                'updated_at' => $organization->updated_at,
            ],
            'workspace' => $this->workspaceSettings->forOrganization($organization),
            'metrics' => [
                'users' => $organization->users()->count(),
                'employees' => $organization->employees()->count(),
                'active_employees' => $organization->employees()->where('status', 'active')->count(),
                'pending_invitations' => $organization->employees()->where('status', 'invited')->count(),
                'departments' => $organization->departments()->count(),
                'locations' => $organization->locations()->count(),
                'document_requirements' => $organization->documentRequirements()->count(),
                'pending_documents' => $organization->employeeDocuments()->where('status', 'submitted')->count(),
                'leave_requests_pending' => $organization->leaveRequests()->where('status', 'submitted')->count(),
                'attendance_records' => $organization->attendanceRecords()->count(),
            ],
            'modules' => $organization->moduleSubscriptions
                ->map(fn ($subscription) => [
                    'id' => $subscription->id,
                    'key' => $subscription->platformModule?->key,
                    'name' => $subscription->platformModule?->name,
                    'category' => $subscription->platformModule?->category,
                    'status' => $subscription->status,
                    'starts_at' => $subscription->starts_at,
                    'expires_at' => $subscription->expires_at,
                ])
                ->values(),
            'admins' => $organization->users
                ->filter(fn (User $user) => $user->hasRole('Organization Admin'))
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'created_at' => $user->created_at,
                ])
                ->values(),
            'locations' => $organization->locations
                ->map(fn ($location) => [
                    'id' => $location->id,
                    'code' => $location->code,
                    'name' => $location->name,
                    'type' => $location->type,
                    'city' => $location->city,
                    'state' => $location->state,
                    'country' => $location->country,
                    'is_primary' => $location->is_primary,
                    'is_active' => $location->is_active,
                ])
                ->values(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function statusBreakdown(array $filters): array
    {
        return $this->dashboardOrganizationQuery($filters)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'total' => (int) $row->total,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function moduleAdoption(array $organizationIds): array
    {
        return PlatformModule::query()
            ->where('is_active', true)
            ->withCount([
                'organizationSubscriptions as active_organizations_count' => fn (Builder $query) => $query
                    ->whereIn('status', ['active', 'trial'])
                    ->whereIn('organization_id', $organizationIds),
            ])
            ->orderBy('sort_order')
            ->get()
            ->map(fn (PlatformModule $module) => [
                'key' => $module->key,
                'name' => $module->name,
                'category' => $module->category,
                'active_organizations' => $module->active_organizations_count,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function attentionOrganizations(Builder $query): array
    {
        return $query
            ->withCount(['users', 'employees', 'moduleSubscriptions'])
            ->latest()
            ->limit(12)
            ->get()
            ->map(fn (Organization $organization) => $this->organizationSummary($organization))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function organizationSummary(Organization $organization): array
    {
        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'code' => $organization->code,
            'status' => $organization->status,
            'country' => $organization->country,
            'users_count' => $organization->users_count ?? $organization->users()->count(),
            'employees_count' => $organization->employees_count ?? $organization->employees()->count(),
            'modules_count' => $organization->module_subscriptions_count ?? $organization->moduleSubscriptions()->whereIn('status', ['active', 'trial'])->count(),
            'created_at' => $organization->created_at,
        ];
    }
}
