<?php

namespace App\Services;

use App\Models\OrbitProject;
use Illuminate\Support\Facades\DB;

/**
 * Generates PROJ-124-style keys. Reuses the exact concurrency-safety
 * pattern already established in this codebase at
 * App\Models\User::createToken() — lock the counter row before a
 * check-then-write — rather than inventing a new one. Guarantees no two
 * concurrent requests in the same project ever receive the same key; it
 * does not guarantee gap-free sequencing (a key can be "burned" if item
 * creation fails after the number is reserved), which is an accepted
 * tradeoff, not a bug — uniqueness is the only real requirement.
 */
class OrbitWorkItemKeyGenerator
{
    public function next(OrbitProject $project): string
    {
        return DB::transaction(function () use ($project) {
            $locked = OrbitProject::query()->where('id', $project->id)->lockForUpdate()->first();
            $number = $locked->next_item_number;
            $locked->increment('next_item_number');

            return "{$locked->key_prefix}-{$number}";
        });
    }
}
