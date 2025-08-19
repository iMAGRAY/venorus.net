#!/bin/bash

# Скрипт для обновления данных на сервере venorus.com
# Обновляет код и базу данных российскими товарами

set -e

SERVER_USER="root"
SERVER_HOST="109.73.195.215"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

update_server() {
    log "🇷🇺 Обновляем сервер российскими товарами..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        set -e
        
        cd /opt/medsip
        
        # Получаем последний код
        echo "📥 Получение обновлений из Git..."
        git fetch origin
        git reset --hard origin/main
        
        # Устанавливаем зависимости
        echo "📦 Установка зависимостей..."
        npm ci --production
        
        # Очищаем и наполняем базу российскими товарами
        echo "🗑️  Очистка базы данных..."
        node scripts/seed/clear-database.js
        
        echo "🇷🇺 Создание российских товаров..."
        node scripts/seed/russian-consumer-goods.js
        
        # Перестраиваем приложение
        echo "🔨 Сборка приложения..."
        npm run build
        
        # Перезапускаем сервис
        echo "🔄 Перезапуск приложения..."
        systemctl restart medsip
        
        echo "✅ Сервер успешно обновлен!"
ENDSSH
}

verify_update() {
    log "🔍 Проверяем обновление..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Ждем запуска
        sleep 10
        
        # Проверяем статус сервиса
        systemctl status medsip --no-pager -l
        
        # Проверяем здоровье приложения
        if curl -f http://localhost:3000/api/health; then
            echo "✅ Приложение работает корректно"
        else
            echo "❌ Проблемы с приложением"
            journalctl -u medsip --no-pager -n 20
            exit 1
        fi
        
        # Проверяем данные в базе
        echo "🔍 Проверяем российские товары в базе..."
        node -e "
        const { Pool } = require('pg');
        require('dotenv').config();
        
        const pool = new Pool({
          host: process.env.POSTGRESQL_HOST,
          port: parseInt(process.env.POSTGRESQL_PORT),
          database: process.env.POSTGRESQL_DBNAME,
          user: process.env.POSTGRESQL_USER,
          password: decodeURIComponent(process.env.POSTGRESQL_PASSWORD),
          ssl: { rejectUnauthorized: false }
        });
        
        (async () => {
          try {
            const result = await pool.query('SELECT COUNT(*) as count FROM products');
            console.log('📊 Товаров в базе:', result.rows[0].count);
            
            const manufacturers = await pool.query('SELECT name FROM manufacturers LIMIT 3');
            console.log('🏭 Производители:', manufacturers.rows.map(r => r.name).join(', '));
            
            await pool.end();
          } catch (error) {
            console.error('Ошибка:', error.message);
            process.exit(1);
          }
        })();
        "
ENDSSH
}

main() {
    log "🚀 Начинаем обновление сервера venorus.com..."
    
    # Обновляем сервер
    update_server
    
    # Проверяем обновление
    verify_update
    
    log "🎉 Сервер успешно обновлен российскими товарами!"
    log "🌐 Сайт доступен: http://109.73.195.215"
    log "📊 Мониторинг: systemctl status medsip"
    log "📋 Логи: journalctl -u medsip -f"
    
    warn "📝 Для полноценной работы нужно:"
    warn "1. Настроить DNS venorus.com -> 109.73.195.215"
    warn "2. Установить SSL сертификат"
}

main "$@"