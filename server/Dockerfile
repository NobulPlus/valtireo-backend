FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --no-scripts \
    --no-autoloader

COPY . .
RUN composer dump-autoload --no-dev --classmap-authoritative

FROM php:8.4-fpm-bookworm AS runtime

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
        curl \
        gettext-base \
        libicu-dev \
        libonig-dev \
        libsqlite3-dev \
        libzip-dev \
        nginx \
        supervisor \
        unzip \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_sqlite \
        zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/www/html

WORKDIR /app

COPY --from=vendor /app /app
COPY docker/nginx.conf.template /etc/nginx/templates/valtireo.conf.template
COPY docker/supervisord.conf /etc/supervisor/conf.d/valtireo.conf
COPY docker/php-production.ini /usr/local/etc/php/conf.d/99-valtireo.ini
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint

RUN mkdir -p \
        bootstrap/cache \
        database \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        /run/nginx \
    && touch database/database.sqlite \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod +x /usr/local/bin/docker-entrypoint

ENV APP_ENV=production \
    APP_DEBUG=false \
    APP_PROCESS_MODE=all \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent "http://127.0.0.1:${PORT}/up" >/dev/null || exit 1

ENTRYPOINT ["docker-entrypoint"]
