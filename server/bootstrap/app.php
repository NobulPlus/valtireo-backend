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
                    return;
                }

                $safeInput = collect($request?->except([
                    'password',
                    'password_confirmation',
                    'current_password',
                    'token',
                    'auth_token',
                    'api_token',
                    'file',
                    'logo',
                    'attachment',
                    'passport_photo',
                ]) ?? [])->take(25)->all();

                $file = Str::after($exception->getFile(), base_path().DIRECTORY_SEPARATOR);
                $fingerprint = hash('sha256', implode('|', [
                    get_class($exception),
                    $file,
                    $exception->getLine(),
                    Str::limit($exception->getMessage(), 180, ''),
                ]));

                \App\Models\SystemErrorLog::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'organization_id' => $user?->organization_id,
                    'user_id' => $user?->id,
                    'level' => 'error',
                    'status_code' => $statusCode,
                    'exception_class' => get_class($exception),
                    'message' => Str::limit($exception->getMessage() ?: 'Unhandled exception', 2000, '...'),
                    'file' => $file,
                    'line' => $exception->getLine(),
                    'method' => $request?->method(),
                    'url' => $request?->fullUrl(),
                    'route' => $request?->route()?->getName() ?? $request?->path(),
                    'ip_address' => $request?->ip(),
                    'user_agent' => Str::limit((string) $request?->userAgent(), 1000, ''),
                    'request_id' => $request?->headers->get('X-Request-Id'),
                    'fingerprint' => $fingerprint,
                    'context' => [
                        'input' => $safeInput,
                        'query' => $request?->query() ?? [],
                    ],
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
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
