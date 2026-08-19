<?php

namespace App\Models;

use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;
use Spatie\Permission\Models\Permission as SpatiePermission;

/**
 * Global, platform-curated permission catalog — never organization-scoped
 * (no team column, by design: permissions correspond to actual `can()`
 * checks in code, so the set of possible permissions is code-defined, not
 * tenant-defined). `name` is the immutable code key; `label`/`description`/
 * `group` are Platform-console-editable display metadata only — nothing
 * ever writes to `name` outside the seeder.
 */
class Permission extends SpatiePermission implements AuditableContract
{
    use Auditable;
}
