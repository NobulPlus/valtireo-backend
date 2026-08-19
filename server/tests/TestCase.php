<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    /**
     * Spatie's team context has no HTTP request to inherit from during test
     * setup (creating fixtures, assigning roles before ever calling
     * getJson()/postJson()) — without this, it silently keeps whatever
     * organization $this->seed() last touched (DatabaseSeeder seeds several
     * demo organizations after Valtireo, so this is never Valtireo's id by
     * default), and any assignRole()/whereHas('...roles', ...) call
     * attaches or queries against the wrong tenant with no error.
     */
    protected function setPermissionsTeamId(int $organizationId): void
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId($organizationId);
    }

    /**
     * The common case: create/fetch a user, then act as them. A real
     * request establishes team context via the SetPermissionsTeamId
     * middleware, but Sanctum::actingAs() alone does not, so this pairs
     * both for setup code that assigns roles or queries role-scoped data
     * for $user before or without an actual HTTP call.
     */
    protected function actingAsInOrganization(User $user): static
    {
        $this->setPermissionsTeamId($user->organization_id);
        Sanctum::actingAs($user);

        return $this;
    }
}
