# Инструкции по использованию тестового пользователя

## Создание тестового пользователя

Для создания тестового пользователя с полными правами запустите:

```bash
cd C:\Users\1\Documents\GitHub\venorus.com
node scripts/setup/create-test-user.js
```

## Данные тестового пользователя

После успешного создания вы получите:

- **Логин**: `test_admin`
- **Пароль**: `Test123!@#`
- **Email**: `test@venorus.local`
- **Роль**: Супер Администратор (полный доступ)

## URL для доступа

- **Админ-панель**: http://localhost:3000/admin
- **API Endpoint входа**: POST http://localhost:3000/api/admin/auth/login

## Тестирование API

### 1. Запуск сервера
```bash
npm run dev
# или
yarn dev
```

### 2. Вход через API
```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin","password":"Test123!@#"}'
```

### 3. Тестирование CRUD операций

После входа вы получите сессию и сможете тестировать:

- **Пользователи**: GET/POST/PUT/DELETE `/api/admin/users`
- **Роли**: GET/POST/PUT/DELETE `/api/admin/roles`
- **Товары**: GET/POST/PUT/DELETE `/api/products`
- **Категории**: GET/POST/PUT/DELETE `/api/categories`

## Примеры CRUD операций

### Получить список пользователей
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: session_cookie_from_login"
```

### Создать нового пользователя
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: session_cookie_from_login" \
  -d '{
    "username": "new_user",
    "email": "newuser@example.com",
    "password": "NewPass123!",
    "roleId": 2,
    "firstName": "Новый",
    "lastName": "Пользователь"
  }'
```

## Важные замечания

⚠️ **БЕЗОПАСНОСТЬ**:
- Используйте этого пользователя ТОЛЬКО для тестирования
- НЕ используйте в производственной среде
- Удалите после завершения тестирования

⚠️ **БАЗА ДАННЫХ**:
- Скрипт автоматически создает базовые роли если их нет
- При повторном запуске предложит пересоздать пользователя
- Все действия логируются в таблицу `user_audit_log`

## Роли в системе

Скрипт создает 4 базовые роли:

1. **super_admin** - Полный доступ (`*`)
2. **admin** - Широкие административные права
3. **manager** - Управление каталогом и заказами
4. **editor** - Редактирование контента

## Структура прав доступа

Система использует массив разрешений в формате:
- `*` - все права
- `products.*` - все права на продукты
- `products.read` - только чтение продуктов
- `users.manage` - управление пользователями

## Отладка

Если возникают проблемы:

1. Проверьте подключение к базе данных в `.env.local`
2. Убедитесь, что таблицы `users` и `roles` существуют
3. Запустите миграцию: `node scripts/migration/run-user-system-migration.js`
4. Проверьте логи в консоли