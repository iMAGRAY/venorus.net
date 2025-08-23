import { pool } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'
import type { QueryResult, QueryResultRow } from 'pg'

/**
 * Кэш для prepared statements для улучшения производительности
 * Часто используемые запросы будут предварительно подготовлены
 */
class PreparedStatementsManager {
  private statements: Map<string, boolean> = new Map()
  private enabled = true

  constructor() {
    // В development режиме отключаем prepared statements для удобства отладки
    if (process.env.NODE_ENV === 'development') {
      this.enabled = false
      logger.debug('Prepared statements disabled in development mode')
    }
  }

  /**
   * Выполнить запрос с автоматическим prepared statement
   */
  async executeQuery<T extends QueryResultRow = QueryResultRow>(
    name: string,
    query: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    if (!this.enabled) {
      // В development просто выполняем обычный запрос
      return await pool.query<T>(query, params)
    }

    try {
      // Если statement не подготовлен, подготавливаем его
      if (!this.statements.has(name)) {
        await pool.query(`PREPARE ${name} AS ${query}`)
        this.statements.set(name, true)
        logger.debug(`Prepared statement created: ${name}`)
      }

      // Выполняем подготовленный запрос
      const paramsList = params.length > 0 ? `(${params.map((_, i) => `$${i + 1}`).join(',')})` : ''
      return await pool.query<T>(`EXECUTE ${name}${paramsList}`, params)
      
    } catch (error) {
      logger.warn(`Prepared statement failed for ${name}, falling back to regular query`, { 
        error: error.message 
      })
      
      // Fallback на обычный запрос при ошибке
      return await pool.query<T>(query, params)
    }
  }

  /**
   * Очистить все prepared statements (при необходимости)
   */
  async clearAll(): Promise<void> {
    try {
      for (const name of this.statements.keys()) {
        await pool.query(`DEALLOCATE ${name}`)
      }
      this.statements.clear()
      logger.info('All prepared statements cleared')
    } catch (error) {
      logger.warn('Error clearing prepared statements', { error: error.message })
    }
  }

  /**
   * Получить статистику prepared statements
   */
  getStats() {
    return {
      enabled: this.enabled,
      count: this.statements.size,
      statements: Array.from(this.statements.keys())
    }
  }
}

// Экспорт singleton instance
export const preparedStatements = new PreparedStatementsManager()

// Часто используемые prepared queries
export const COMMON_QUERIES = {
  // Продукты
  GET_PRODUCTS_LIST: 'get_products_list',
  GET_PRODUCT_BY_ID: 'get_product_by_id',
  COUNT_PRODUCTS: 'count_products',
  
  // Категории
  GET_CATEGORIES: 'get_categories',
  GET_CATEGORY_BY_ID: 'get_category_by_id',
  
  // Производители
  GET_MANUFACTURERS: 'get_manufacturers',
  
  // Health checks
  HEALTH_CHECK: 'health_check',
  TABLE_EXISTS: 'table_exists',
} as const

// Helper функция для быстрого выполнения часто используемых запросов
export async function executeCommonQuery<T extends QueryResultRow = QueryResultRow>(
  queryName: keyof typeof COMMON_QUERIES,
  params: any[] = []
): Promise<QueryResult<T>> {
  const queries = {
    GET_PRODUCTS_LIST: `
      SELECT p.*, ms.name as model_line_name, m.name as manufacturer_name
      FROM products p
      LEFT JOIN model_series ms ON p.series_id = ms.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
      ORDER BY p.id DESC
      LIMIT $1 OFFSET $2
    `,
    GET_PRODUCT_BY_ID: `
      SELECT p.*, ms.name as model_line_name, m.name as manufacturer_name
      FROM products p
      LEFT JOIN model_series ms ON p.series_id = ms.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE p.id = $1 AND (p.is_deleted = false OR p.is_deleted IS NULL)
    `,
    COUNT_PRODUCTS: 'SELECT COUNT(*) as total FROM products WHERE (is_deleted = false OR is_deleted IS NULL)',
    GET_CATEGORIES: 'SELECT * FROM product_categories ORDER BY name',
    GET_CATEGORY_BY_ID: 'SELECT * FROM product_categories WHERE id = $1',
    GET_MANUFACTURERS: 'SELECT * FROM manufacturers ORDER BY name',
    HEALTH_CHECK: 'SELECT 1 as health',
    TABLE_EXISTS: `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `
  }

  const query = queries[queryName]
  if (!query) {
    throw new Error(`Unknown query name: ${queryName}`)
  }

  return preparedStatements.executeQuery<T>(COMMON_QUERIES[queryName], query, params)
}