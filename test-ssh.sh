#!/bin/bash

echo "Тестируем SSH подключение к серверу 109.73.195.215..."
echo "Введите пароль: iYuj2v4wqU-C?A"

ssh -o StrictHostKeyChecking=no root@109.73.195.215 << 'ENDSSH'
    echo "=== Успешное подключение к серверу ==="
    echo "Информация о системе:"
    uname -a
    echo ""
    echo "Дисковое пространство:"
    df -h
    echo ""
    echo "Память:"
    free -h
    echo ""
    echo "Версии установленного ПО:"
    if command -v node >/dev/null 2>&1; then
        echo "Node.js: $(node --version)"
    else
        echo "Node.js: не установлен"
    fi
    
    if command -v nginx >/dev/null 2>&1; then
        echo "Nginx: $(nginx -v 2>&1)"
    else
        echo "Nginx: не установлен"
    fi
    
    if command -v git >/dev/null 2>&1; then
        echo "Git: $(git --version)"
    else
        echo "Git: не установлен"
    fi
    echo ""
    echo "Проверяем порты:"
    echo "Порт 80 (HTTP):"
    netstat -tlnp | grep ':80 ' || echo "Порт 80 не используется"
    echo "Порт 443 (HTTPS):"
    netstat -tlnp | grep ':443 ' || echo "Порт 443 не используется"
    echo "Порт 3000:"
    netstat -tlnp | grep ':3000 ' || echo "Порт 3000 не используется"
ENDSSH

echo "Тест подключения завершен"