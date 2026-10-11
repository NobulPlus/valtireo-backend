<?php

namespace App\Support;

use OwenIt\Auditing\Contracts\Auditable;
use OwenIt\Auditing\Contracts\Resolver;

final class SafeAuditUrl implements Resolver
{
    public static function resolve(Auditable $auditable): string
    {
        // Never retain query strings, route parameter values, or CLI arguments.
        return app()->runningInConsole() ? 'console' : (request()->route()?->uri() ?? 'unmatched');
    }
}
