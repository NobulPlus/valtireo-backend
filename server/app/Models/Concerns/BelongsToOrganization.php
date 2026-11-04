<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * Orbit's models are the first in this codebase to use an automatic
 * organization-scoping global scope. Everywhere else, every controller
 * manually repeats `where('organization_id', ...)` with no structural
 * safety net — exactly the bug class fixed in commit cd5b14a ("My Assets
 * leaked the whole org's asset list to privileged viewers"). This trait is
 * additive only: it touches no existing model, and every Orbit write path
 * still sets/checks organization_id explicitly too (defense in depth,
 * matching existing controller style) — this is a second layer, not a
 * replacement for careful queries.
 *
 * Scoped to the authenticated user's organization when one exists. Outside
 * an authenticated request (console commands, factories, direct test setup)
 * there is nothing to scope to, so both the query filter and the
 * auto-fill-on-create below are simply skipped — callers in that context
 * must set organization_id explicitly, exactly as every other model in this
 * app already requires.
 */
trait BelongsToOrganization
{
    protected static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $builder) {
            if ($organizationId = auth()->user()?->organization_id) {
                $builder->where($builder->getModel()->getTable().'.organization_id', $organizationId);
            }
        });

        static::creating(function ($model) {
            if (! $model->organization_id && $organizationId = auth()->user()?->organization_id) {
                $model->organization_id = $organizationId;
            }
        });
    }
}
