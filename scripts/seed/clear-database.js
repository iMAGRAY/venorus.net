#!/usr/bin/env node

/**
 * Скрипт для полной очистки базы данных от товаров
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Настройка подключения к PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: parseInt(process.env.POSTGRESQL_PORT),
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: decodeURIComponent(process.env.POSTGRESQL_PASSWORD),
  ssl: false,
});

console.log('🗑️  ОЧИСТКА БАЗЫ ДАННЫХ');
console.log('============================================================');

async function clearDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🧹 Удаление данных...');
    
    // Удаляем в правильном порядке (с учетом внешних ключей)
    await client.query('DELETE FROM product_characteristics_simple');
    console.log('   ✅ Удалены характеристики товаров');
    
    await client.query('DELETE FROM products');
    console.log('   ✅ Удалены товары');
    
    await client.query('DELETE FROM characteristics_values_simple');
    console.log('   ✅ Удалены значения характеристик');
    
    await client.query('DELETE FROM characteristics_groups_simple');
    console.log('   ✅ Удалены группы характеристик');
    
    await client.query('DELETE FROM product_categories WHERE id >= 1');
    console.log('   ✅ Удалены категории товаров');
    
    await client.query('DELETE FROM manufacturers WHERE id >= 1');
    console.log('   ✅ Удалены производители');

    // Сбрасываем последовательности (автоинкремент) - используем правильные названия
    await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE manufacturers_id_seq RESTART WITH 1');
    // await client.query('ALTER SEQUENCE product_categories_id_seq RESTART WITH 1'); // Пропускаем - не существует
    await client.query('ALTER SEQUENCE characteristics_groups_simple_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE characteristics_values_simple_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE product_characteristics_simple_id_seq RESTART WITH 1');
    console.log('   ✅ Сброшены счетчики ID');

    await client.query('COMMIT');
    console.log('\n🎉 БАЗА ДАННЫХ ОЧИЩЕНА!');
    console.log('============================================================');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при очистке:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск скрипта
async function main() {
  try {
    await clearDatabase();
    console.log('\n🚀 Очистка завершена успешно!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Критическая ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();