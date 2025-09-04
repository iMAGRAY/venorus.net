require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function updateSettings() {
  const pool = new Pool({
    host: process.env.POSTGRESQL_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRESQL_PORT || process.env.PGPORT || '5432'),
    user: process.env.POSTGRESQL_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || process.env.PGPASSWORD,
    database: process.env.POSTGRESQL_DBNAME || process.env.PGDATABASE || 'venorus_db',
    ssl: false
  });

  try {
    await pool.query(`
      UPDATE site_settings SET
        site_name = 'Венорус - Российские товары',
        site_description = 'Платформа для продвижения российских производителей. Качественные товары с доставкой по всей России.',
        hero_title = 'Лучшие российские товары',
        hero_subtitle = 'От проверенных производителей. Поддерживаем отечественный бизнес',
        contact_email = 'info@venorus.net',
        contact_phone = '+7 (495) 123-45-67',
        address = 'г. Москва, ул. Инновационная, д. 15, офис 501',
        social_media = '{
          "vk": "https://vk.com/venorus_russia",
          "telegram": "https://t.me/venorus_official",
          "youtube": "https://youtube.com/@venorus"
        }'::jsonb,
        additional_contacts = '[
          {
            "type": "Отдел продаж",
            "phone": "+7 (495) 123-45-68",
            "email": "sales@venorus.net"
          },
          {
            "type": "Техническая поддержка",
            "phone": "+7 (495) 123-45-69",
            "email": "support@venorus.net"
          },
          {
            "type": "Сервисный центр",
            "phone": "+7 (495) 123-45-70",
            "email": "service@venorus.net"
          }
        ]'::jsonb,
        updated_at = NOW()
      WHERE id = 1
    `);
    // Проверяем результат
    const result = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    const settings = result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

updateSettings();