#!/usr/bin/env node

/**
 * Скрипт оптимизации производительности таблицы orders
 * Добавляет недостающие индексы для ускорения запросов
 */

const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: 'database.env' })

function buildPool() {
  const connectionString = process.env.DATABASE_URL || (
    `postgresql://${process.env.POSTGRESQL_USER || 'postgres'}:${encodeURIComponent(process.env.POSTGRESQL_PASSWORD || '')}` +
    `@${process.env.POSTGRESQL_HOST || 'localhost'}:${process.env.POSTGRESQL_PORT || 5432}/${process.env.POSTGRESQL_DBNAME || 'default_db'}`
  )
  const ssl = process.env.NODE_ENV === 'production' || /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false
  return new Pool({ connectionString, ssl })
}

async function executeQuery(query, params = []) {
  const pool = buildPool()
  try {
    const result = await pool.query(query, params)
    return result
  } finally {
    await pool.end()
  }
}

const OPTIMIZATION_QUERIES = [
  // Индекс на поле status - часто используется в фильтрации
  {
    name: 'idx_orders_status',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
    description: 'Индекс для быстрой фильтрации по статусу заказов'
  },
  
  // Индекс на created_at для сортировки и фильтрации по дате
  {
    name: 'idx_orders_created_at',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`,
    description: 'Индекс для быстрой сортировки по дате создания'
  },
  
  // Индекс на updated_at для отслеживания изменений
  {
    name: 'idx_orders_updated_at',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);`,
    description: 'Индекс для быстрого поиска недавно обновленных заказов'
  },
  
  // Составной индекс для комплексных запросов
  {
    name: 'idx_orders_status_created_at',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);`,
    description: 'Составной индекс для фильтрации по статусу с сортировкой по дате'
  },
  
  // Индекс для поиска по email клиента
  {
    name: 'idx_orders_customer_email',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);`,
    description: 'Индекс для быстрого поиска заказов по email клиента'
  },
  
  // Индекс для поиска по телефону клиента
  {
    name: 'idx_orders_customer_phone',
    query: `CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);`,
    description: 'Индекс для быстрого поиска заказов по телефону клиента'
  }
]

async function optimizeOrdersPerformance() {
  console.log('🚀 Начинаем оптимизацию производительности таблицы orders...')
  
  let successCount = 0
  let errorCount = 0
  
  for (const optimization of OPTIMIZATION_QUERIES) {
    try {
      console.log(`📦 Создаем индекс: ${optimization.name}`)
      console.log(`   ${optimization.description}`)
      
      const startTime = Date.now()
      await executeQuery(optimization.query)
      const duration = Date.now() - startTime
      
      console.log(`✅ Индекс ${optimization.name} создан успешно за ${duration}ms`)
      successCount++
      
    } catch (error) {
      console.error(`❌ Ошибка создания индекса ${optimization.name}:`, error.message)
      errorCount++
    }
  }
  
  console.log('\n📊 Результаты оптимизации:')
  console.log(`✅ Успешно создано индексов: ${successCount}`)
  console.log(`❌ Ошибок: ${errorCount}`)
  
  if (successCount > 0) {
    console.log('🔄 Обновляем статистику таблицы для оптимального использования индексов...')
    try {
      await executeQuery('ANALYZE orders;')
      console.log('✅ Статистика таблицы обновлена')
    } catch (error) {
      console.error('⚠️ Не удалось обновить статистику:', error.message)
    }
  }
  
  return { successCount, errorCount }
}

// Функция для проверки существующих индексов
async function checkExistingIndexes() {
  try {
    console.log('🔍 Проверяем существующие индексы для таблицы orders...')
    const result = await executeQuery(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'orders' 
      ORDER BY indexname;
    `)
    
    console.log(`📋 Найдено индексов: ${result.rows.length}`)
    result.rows.forEach(row => {
      console.log(`   - ${row.indexname}`)
    })
    
    return result.rows
  } catch (error) {
    console.error('❌ Ошибка проверки индексов:', error.message)
    return []
  }
}

// Запуск оптимизации
async function main() {
  try {
    await checkExistingIndexes()
    console.log('\n' + '='.repeat(50))
    
    const result = await optimizeOrdersPerformance()
    
    console.log('\n' + '='.repeat(50))
    console.log('🎉 Оптимизация завершена!')
    
    if (result.successCount > 0) {
      console.log('💡 Рекомендации:')
      console.log('   - Перезапустите приложение для обновления connection pool')
      console.log('   - Мониторьте производительность запросов в следующие дни')
      console.log('   - При необходимости добавьте дополнительные индексы')
    }
    
    process.exit(result.errorCount > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('💥 Критическая ошибка оптимизации:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { optimizeOrdersPerformance, checkExistingIndexes }