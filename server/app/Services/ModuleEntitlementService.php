<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Support\Collection;

class ModuleEntitlementService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function forUser(User $user): array
    {
        $user->loadMissing('organization');

        $organization = $user->organization;

        if (! $organization) {
            return [];
        }

        $subscriptions = $organization->moduleSubscriptions()
            ->get()
            ->keyBy('platform_module_id');

        return PlatformModule::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (PlatformModule $module) => $this->modulePayload($user, $organization, $module, $subscriptions))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param Collection<int, mixed> $subscriptions
     *
     * @return array<string, mixed>|null
     */
    private function modulePayload(User $user, Organization $organization, PlatformModule $module, Collection $subscriptions): ?array
    {
        $subscription = $subscriptions->get($module->id);
        $subscriptionStatus = $subscription?->status ?? 'locked';
        $isSubscribed = $subscription ? $this->subscriptionIsActive($subscription) : false;
        $isAdmin = $user->is_platform_admin || $user->can('organizations.administer');
        $canAccess = $this->userCanAccessModule($user, $module, $isSubscribed, $isAdmin);

        if (! $isAdmin && ! $canAccess) {
            return null;
        }

        return [
            'key' => $module->key,
            'name' => $module->name,
            'description' => $module->description,
            'category' => $module->category,
            'subscription_status' => $subscriptionStatus,
            'is_subscribed' => $isSubscribed,
            'can_access' => $canAccess,
            'access' => $this->accessLevel($user, $module, $isSubscribed, $isAdmin),
            'visibility' => $this->visibility($isSubscribed, $canAccess),
            'sort_order' => $module->sort_order,
            'settings' => $subscription?->settings ?? [],
            'organization_id' => $organization->id,
        ];
    }

    private function userCanAccessModule(User $user, PlatformModule $module, bool $isSubscribed, bool $isAdmin): bool
    {
        if (! $isSubscribed) {
            return false;
        }

        if ($isAdmin) {
            return true;
        }

        if (! $module->required_permission) {
            return true;
        }

        return $user->can($module->required_permission);
    }

    public function organizationHasActiveSubscription(Organization $organization, string $moduleKey): bool
    {
        $module = PlatformModule::query()
            ->where('key', $moduleKey)
            ->where('is_active', true)
            ->first();

        if (! $module) {
            return false;
        }

        $subscription = $organization->moduleSubscriptions()
            ->where('platform_module_id', $module->id)
            ->first();

        return $subscription ? $this->subscriptionIsActive($subscription) : false;
    }

    private function subscriptionIsActive(mixed $subscription): bool
    {
        if (! in_array($subscription->status, ['active', 'trial'], true)) {
            return false;
        }

        if ($subscription->starts_at && $subscription->starts_at->isFuture()) {
            return false;
        }

        if ($subscription->expires_at && $subscription->expires_at->isPast()) {
            return false;
        }

        return true;
    }

    private function accessLevel(User $user, PlatformModule $module, bool $isSubscribed, bool $isAdmin): string
    {
        if (! $isSubscribed) {
            return 'none';
        }

        if ($isAdmin) {
            return 'manage';
        }

        if ($user->can('leave_requests.create') && in_array($module->key, ['employee_self_service', 'leave'], true)) {
            return 'self';
        }

        if ($module->required_permission && $user->can($module->required_permission)) {
            return str_ends_with($module->required_permission, '.view') ? 'view' : 'manage';
        }

        return $module->required_permission ? 'none' : 'view';
    }

    private function visibility(bool $isSubscribed, bool $canAccess): string
    {
        if (! $isSubscribed) {
            return 'locked';
        }

        return $canAccess ? 'enabled' : 'hidden';
    }
}
