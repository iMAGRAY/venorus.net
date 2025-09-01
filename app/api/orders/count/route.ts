import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'
import { getCacheManager, getLogger } from '@/lib/dependency-injection'

export async function GET(_request: NextRequest) {
  const logger = getLogger()
  const cacheManager = getCacheManager()

  try {

    const cacheKey = 'orders:count'
    const cached = cacheManager.get(cacheKey)

    if (cached !== undefined && cached !== null) {
      logger.info('Cache hit for orders count', { cached })
      return NextResponse.json(cached)
    }

    // Оптимизированный запрос - сначала проверяем approximate count
    // Если таблица большая, используем приблизительный подсчет для быстрости
    let result
    try {
      // Быстрая проверка размера таблицы через статистики
      const approxQuery = `
        SELECT 
          CASE 
            WHEN n_tup_ins + n_tup_del < 10000 THEN 
              (SELECT COUNT(*) FROM orders)::bigint
            ELSE 
              GREATEST(n_tup_ins - n_tup_del, 0)::bigint
          END as total
        FROM pg_stat_user_tables 
        WHERE relname = 'orders'
        UNION ALL
        SELECT COUNT(*)::bigint FROM orders
        WHERE NOT EXISTS (SELECT 1 FROM pg_stat_user_tables WHERE relname = 'orders')
        LIMIT 1
      `
      result = await executeQuery(approxQuery)
      
      // Валидация результата - если получили 0 или отрицательное, делаем точный подсчет
      const approxTotal = parseInt(result.rows[0]?.total || '0')
      if (approxTotal < 0 || (approxTotal === 0 && result.rows.length === 0)) {
        result = await executeQuery('SELECT COUNT(*)::bigint as total FROM orders')
      }
    } catch (statsError) {
      // Если оптимизированный запрос не работает, используем обычный COUNT
      logger.warn('Stats-based count failed, using regular COUNT', { error: statsError.message })
      result = await executeQuery('SELECT COUNT(*)::bigint as total FROM orders')
    }
    
    const _total = parseInt(result.rows[0].total)

    const responseData = {
      success: true,
      data: { total: _total }
    }

    // Кэшируем результат на 5 минут для снижения нагрузки на БД
    // COUNT(*) запросы медленные, поэтому увеличиваем TTL
    cacheManager.set(cacheKey, responseData, 300000)

    logger.info('Orders count loaded successfully', { total: _total })

    return NextResponse.json(responseData)

  } catch (error) {
    logger.error('Ошибка получения количества заказов:', error)
    // Возвращаем fallback данные если БД недоступна
    const fallbackData = {
      success: true,
      data: { total: 0 },
      fallback: true,
      error: 'Database unavailable'
    }

    return NextResponse.json(fallbackData)
  }
}