const { Client } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const BCRYPT_ROUNDS = 12;

async function createTestUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Подключение к базе данных установлено');

    // Проверяем существование таблиц
    const tablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'roles')
    `);

    if (tablesCheck.rows.length < 2) {
      console.log('❌ Таблицы users или roles не найдены');
      console.log('Необходимо сначала запустить миграцию пользователей');
      return;
    }

    // Проверяем существующие роли
    const existingRoles = await client.query('SELECT id, name, display_name, permissions FROM roles ORDER BY id');
    
    if (existingRoles.rows.length === 0) {
      console.log('📝 Создаем базовые роли...');
      
      // Создаем базовые роли
      const roles = [
        {
          name: 'super_admin',
          display_name: 'Супер Администратор',
          description: 'Полный доступ ко всем функциям системы',
          permissions: ['*']
        },
        {
          name: 'admin',
          display_name: 'Администратор',
          description: 'Администратор с широкими правами',
          permissions: [
            'products.*', 'categories.*', 'users.manage', 'media.*', 
            'warehouse.*', 'orders.*', 'reports.*'
          ]
        },
        {
          name: 'manager',
          display_name: 'Менеджер',
          description: 'Менеджер каталога и заказов',
          permissions: [
            'products.read', 'products.create', 'products.update',
            'categories.read', 'media.upload', 'orders.*'
          ]
        },
        {
          name: 'editor',
          display_name: 'Редактор',
          description: 'Редактор контента',
          permissions: [
            'products.read', 'products.update', 'categories.read', 'media.upload'
          ]
        }
      ];

      for (const role of roles) {
        await client.query(`
          INSERT INTO roles (name, display_name, description, permissions, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [role.name, role.display_name, role.description, role.permissions]);
        console.log(`   ✓ Роль "${role.display_name}" создана`);
      }
    } else {
      console.log('✅ Найдены существующие роли:');
      existingRoles.rows.forEach(role => {
        console.log(`   - ${role.display_name} (${role.name})`);
      });
    }

    // Получаем роль супер-админа
    const superAdminRole = await client.query(`
      SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1
    `);

    if (superAdminRole.rows.length === 0) {
      console.log('❌ Роль super_admin не найдена');
      return;
    }

    const roleId = superAdminRole.rows[0].id;

    // Данные тестового пользователя
    const testUser = {
      username: 'test_admin',
      email: 'test@venorus.local',
      password: 'Test123!@#',
      firstName: 'Тестовый',
      lastName: 'Пользователь'
    };

    // Проверяем, существует ли уже такой пользователь
    const existingUser = await client.query(`
      SELECT id, username, email FROM users WHERE username = $1 OR email = $2
    `, [testUser.username, testUser.email]);

    if (existingUser.rows.length > 0) {
      console.log('⚠️  Пользователь уже существует:');
      existingUser.rows.forEach(user => {
        console.log(`   - ${user.username} (${user.email})`);
      });
      
      // Спрашиваем, хотим ли мы пересоздать
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Пересоздать пользователя? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('✅ Операция отменена пользователем');
        return;
      }

      // Удаляем существующего пользователя
      await client.query('DELETE FROM users WHERE username = $1 OR email = $2', [testUser.username, testUser.email]);
      console.log('✅ Существующий пользователь удален');
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(testUser.password, BCRYPT_ROUNDS);

    // Создаем тестового пользователя
    const createUserResult = await client.query(`
      INSERT INTO users (
        username, email, password_hash, role_id,
        first_name, last_name, status, email_verified,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, email, created_at
    `, [
      testUser.username, testUser.email, passwordHash, roleId,
      testUser.firstName, testUser.lastName
    ]);

    const newUser = createUserResult.rows[0];

    // Добавляем в audit log
    await client.query(`
      INSERT INTO user_audit_log (
        user_id, action, resource_type, resource_id,
        details, created_at
      ) VALUES ($1, 'user_created', 'user', $2, $3, CURRENT_TIMESTAMP)
    `, [
      newUser.id, newUser.id,
      JSON.stringify({
        username: newUser.username,
        email: newUser.email,
        role: 'super_admin',
        created_by: 'test_script',
        timestamp: new Date().toISOString()
      })
    ]);

    console.log('\n🎉 Тестовый пользователь успешно создан!');
    console.log('==========================================');
    console.log(`ID: ${newUser.id}`);
    console.log(`Логин: ${testUser.username}`);
    console.log(`Пароль: ${testUser.password}`);
    console.log(`Email: ${testUser.email}`);
    console.log(`Роль: Супер Администратор`);
    console.log('==========================================');
    console.log('URL админ-панели: http://localhost:3000/admin');
    console.log('\n⚠️  ВАЖНО: Используйте этого пользователя только для тестирования!');

    // Проверяем права доступа
    console.log('\n🔐 Проверяем права доступа...');
    try {
      const permissionTest = await client.query(`
        SELECT user_has_permission($1, 'products.create') as can_create_products,
               user_has_permission($1, 'users.manage') as can_manage_users,
               user_has_permission($1, 'admin.settings') as can_manage_settings
      `, [newUser.id]);

      const perms = permissionTest.rows[0];
      console.log(`   ✓ Создание товаров: ${perms.can_create_products ? '✅' : '❌'}`);
      console.log(`   ✓ Управление пользователями: ${perms.can_manage_users ? '✅' : '❌'}`);
      console.log(`   ✓ Настройки системы: ${perms.can_manage_settings ? '✅' : '❌'}`);
    } catch (error) {
      console.log('   ⚠️  Не удалось проверить права (функция user_has_permission может отсутствовать)');
    }

  } catch (error) {
    console.error('❌ Ошибка создания тестового пользователя:', error);
    console.error('Подробности:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Запускаем если файл вызывается напрямую
if (require.main === module) {
  createTestUser();
}

module.exports = createTestUser;