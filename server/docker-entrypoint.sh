#!/bin/sh
set -eu

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY is required. Generate one with: php artisan key:generate --show" >&2
    exit 1
fi

export PORT="${PORT:-8000}"
export APP_PROCESS_MODE="${APP_PROCESS_MODE:-all}"

case "$APP_PROCESS_MODE" in
    web|worker|scheduler|all) ;;
    *)
        echo "APP_PROCESS_MODE must be one of: web, worker, scheduler, all" >&2
        exit 1
        ;;
esac

if [ "${DB_CONNECTION:-mysql}" = "sqlite" ]; then
    database_path="${DB_DATABASE:-/app/database/database.sqlite}"
    mkdir -p "$(dirname "$database_path")"
    touch "$database_path"
    chown www-data:www-data "$database_path"
fi

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

envsubst '${PORT}' < /etc/nginx/templates/valtireo.conf.template > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default

if [ "${RUN_MIGRATIONS:-true}" = "true" ] && [ "$APP_PROCESS_MODE" != "worker" ] && [ "$APP_PROCESS_MODE" != "scheduler" ]; then
    if [ "${RESET_DB_ON_BOOT:-false}" = "true" ]; then
        if [ "${ALLOW_DESTRUCTIVE_DB_RESET:-false}" != "true" ]; then
            echo "RESET_DB_ON_BOOT requires ALLOW_DESTRUCTIVE_DB_RESET=true." >&2
            exit 1
        fi
        php artisan migrate:fresh --seed --force
    else
        php artisan migrate --force
    fi
fi

php artisan storage:link --force >/dev/null 2>&1 || true
php artisan optimize

case "$APP_PROCESS_MODE" in
    web)
        php-fpm -D
        exec nginx -g 'daemon off;'
        ;;
    worker)
        exec su -s /bin/sh www-data -c 'php artisan queue:work --sleep=3 --tries=3 --timeout=120 --max-time=3600'
        ;;
    scheduler)
        exec su -s /bin/sh www-data -c 'php artisan schedule:work'
        ;;
    all)
        exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf -n
        ;;
esac
