#!/bin/bash

# Остановка предыдущего процесса если есть
pm2 stop venorus 2>/dev/null
pm2 delete venorus 2>/dev/null

# Убедимся что мы в правильной директории
cd /opt/venorus

# Загружаем переменные окружения
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Экспортируем критические переменные
export NODE_ENV=production
export PORT=3000

# Запускаем напрямую через node (как делает npm start)
pm2 start "node server.js" \
    --name "venorus" \
    --max-memory-restart "4G" \
    --node-args="--max-old-space-size=4096" \
    --log "./logs/venorus.log" \
    --time \
    --merge-logs

# Альтернативный вариант - запуск через npm (как работает npm start)
# pm2 start "npm start" \
#     --name "venorus" \
#     --max-memory-restart "4G" \
#     --node-args="--max-old-space-size=4096"

# Сохраняем конфигурацию
pm2 save
pm2 startup

echo "Venorus запущен через PM2"
echo "Используйте 'pm2 logs venorus' для просмотра логов"
echo "Используйте 'pm2 monit' для мониторинга"