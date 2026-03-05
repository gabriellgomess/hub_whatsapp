#!/bin/bash
set -e

cd /var/www

# Caches de produção
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Migrations automáticas
php artisan migrate --force

# Inicia todos os processos via supervisor
exec /usr/bin/supervisord -c /etc/supervisord.conf
