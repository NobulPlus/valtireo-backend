<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withSchedule(function (Schedule $schedule): void {
        // Document expiry, onboarding follow-up, pending approval, and
        // probation review reminders all live behind this one command —
        // without this entry it only ever runs if someone triggers it by
        // hand. Still requires the server's own cron to call
        // `php artisan schedule:run` every minute (standard Laravel
        // deployment requirement, not something this file alone can do).
        $schedule->command('valtireo:send-reminders')->daily();
        $schedule->command('valtireo:run-operational-automations')->hourly()->withoutOverlapping();
        $schedule->command('connect:reconcile')->everyMinute()->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (\Throwable $exception) {
            try {
                $request = request();
                $user = $request?->user();
                $statusCode = $exception instanceof HttpExceptionInterface
                    ? $exception->getStatusCode()
                    : null;

                if ($statusCode !== null && $statusCode < 500) {
                    // Still suppress Laravel's own (unsanitized) default reporting for
                    // these — we just don't want a SystemErrorLog row for routine 4xx
                    // responses. A bare `return;` here does NOT count as "handled" to
                    // the exception handler, so it would fall through to the default
                    // reporter and log the raw, unsanitized exception anyway.
                    return false;
                }

                $safeContext = [
                    'privacy_version' => 2,
                    'input_count' => count($request?->all() ?? []),
                    'query_count' => count($request?->query() ?? []),
                ];

                $file = Str::after($exception->getFile(), base_path().DIRECTORY_SEPARATOR);
                $fingerprint = hash('sha256', implode('|', [
                    get_class($exception),
                    $file,
                    $exception->getLine(),
                ]));

                \App\Models\SystemErrorLog::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'organization_id' => $user?->organization_id,
                    'user_id' => $user?->id,
                    'level' => 'error',
                    'status_code' => $statusCode,
                    'exception_class' => get_class($exception),
                    'message' => 'Unhandled '.get_class($exception),
                    'file' => $file,
                    'line' => $exception->getLine(),
                    'method' => $request?->method(),
                    'url' => null,
                    'route' => $request?->route()?->getName() ?? $request?->route()?->uri(),
                    'ip_address' => $request?->ip(),
                    'user_agent' => null,
                    'request_id' => null,
                    'fingerprint' => $fingerprint,
                    'context' => $safeContext,
                    'trace_excerpt' => collect($exception->getTrace())
                        ->take(8)
                        ->map(fn (array $frame) => [
                            'file' => isset($frame['file']) ? Str::after($frame['file'], base_path().DIRECTORY_SEPARATOR) : null,
                            'line' => $frame['line'] ?? null,
                            'function' => $frame['function'] ?? null,
                            'class' => $frame['class'] ?? null,
                        ])
                        ->values()
                        ->all(),
                ]);
            } catch (\Throwable) {
                // Never let monitoring create a second exception.
            }

            // Do not let the default reporter write the raw exception message,
            // SQL bindings, or exception context to another log channel.
            try {
                \Illuminate\Support\Facades\Log::error('Unhandled application exception', [
                    'exception_class' => get_class($exception),
                    'file' => Str::after($exception->getFile(), base_path().DIRECTORY_SEPARATOR),
                    'line' => $exception->getLine(),
                ]);
            } catch (\Throwable) {
                // Reporting must not interrupt the original response.
            }

            return false;
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
