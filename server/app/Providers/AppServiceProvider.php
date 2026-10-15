<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request): array {
            $email = $request->input('email');
            $identity = hash('sha256', Str::lower(is_string($email) ? trim($email) : ''));

            return [
                Limit::perMinute(30)->by('login-ip:'.$request->ip()),
                Limit::perMinute(5)->by('login-identity:'.$identity),
            ];
        });

        RateLimiter::for('register', function (Request $request): array {
            $email = $request->input('email');
            $identity = hash('sha256', Str::lower(is_string($email) ? trim($email) : ''));

            return [
                Limit::perMinute(20)->by('register-ip:'.$request->ip()),
                Limit::perMinute(5)->by('register-identity:'.$identity),
            ];
        });

        RateLimiter::for('invitation-accept', function (Request $request): array {
            $token = (string) $request->route('token');

            return [
                Limit::perMinute(20)->by('invitation-accept-ip:'.$request->ip()),
                Limit::perMinute(10)->by('invitation-accept-token:'.hash('sha256', $token)),
            ];
        });

        RateLimiter::for('password-reset-request', function (Request $request): array {
            $email = $request->input('email');
            $identity = hash('sha256', Str::lower(is_string($email) ? trim($email) : ''));

            return [
                Limit::perMinute(10)->by('password-reset-request-ip:'.$request->ip()),
                Limit::perMinutes(15, 3)->by('password-reset-request-identity:'.$identity),
            ];
        });

        RateLimiter::for('password-reset-confirm', function (Request $request): array {
            $email = $request->input('email');
            $identity = hash('sha256', Str::lower(is_string($email) ? trim($email) : ''));

            return [
                Limit::perMinute(20)->by('password-reset-confirm-ip:'.$request->ip()),
                Limit::perMinutes(15, 5)->by('password-reset-confirm-identity:'.$identity),
            ];
        });
    }
}
