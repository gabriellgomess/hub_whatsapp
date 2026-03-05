FROM php:8.4-apache

# Habilita mod_rewrite do Apache
RUN a2enmod rewrite

# Extensões PHP necessárias para Laravel + supervisor para queue/reverb
RUN apt-get update && apt-get install -y \
    supervisor git curl zip unzip \
    libpng-dev libjpeg-dev libfreetype6-dev \
    libzip-dev libonig-dev libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mbstring exif pcntl bcmath gd zip xml ctype tokenizer \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Aponta o DocumentRoot do Apache para /public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && printf '<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>\n' \
       > /etc/apache2/conf-available/laravel.conf \
    && a2enconf laravel

# Supervisor: roda Apache + queue worker + Reverb juntos
RUN printf '[supervisord]\nnodaemon=true\nlogfile=/dev/stdout\nlogfile_maxbytes=0\n\n\
[program:apache]\ncommand=/usr/sbin/apache2ctl -D FOREGROUND\nautostart=true\nautorestart=true\n\
stdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n\
[program:queue]\ncommand=php /var/www/html/artisan queue:work --sleep=3 --tries=3\n\
autostart=true\nautorestart=true\nuser=www-data\n\
stdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n\
[program:reverb]\ncommand=php /var/www/html/artisan reverb:start --host=0.0.0.0 --port=8080 --no-interaction\n\
autostart=true\nautorestart=true\nuser=www-data\n\
stdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n' \
    > /etc/supervisord.conf

# Entrypoint: composer install + migrate + caches + inicia supervisor
RUN printf '#!/bin/bash\nset -e\ncd /var/www/html\n\
[ ! -d vendor ] && composer install --no-dev --optimize-autoloader\n\
php artisan migrate --force 2>/dev/null || true\n\
php artisan config:cache 2>/dev/null || true\n\
php artisan route:cache 2>/dev/null || true\n\
exec /usr/bin/supervisord -c /etc/supervisord.conf\n' \
    > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80 8080

ENTRYPOINT ["/entrypoint.sh"]
