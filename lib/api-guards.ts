import { NextResponse } from 'next/server'
import { executeQuery, isDatabaseAvailableSync } from '@/lib/database/db-connection'

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function guardDbOr503(): Promise<NextResponse | null> {
  if (!isDbConfigured()) {
    console.error('🚨 Database config is not provided')
    return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
  }
  
  // Removed testConnection for performance - connections are tested on actual query
  return null
}

export function guardDbOr503Fast(): NextResponse | null {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
  }
  if (!isDatabaseAvailableSync()) {
    return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 503 })
  }
  return null
}

// Кеш для результатов проверки таблиц (живет 24 часа)
const tablesCache = new Map<string, { result: Record<string, boolean>, timestamp: number }>()
const TABLES_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 часа

export async function tablesExist(tableNames: string[]): Promise<Record<string, boolean>> {
  if (!tableNames || tableNames.length === 0) return {}
  if (!isDatabaseAvailableSync()) {
    const map: Record<string, boolean> = {}
    for (const t of tableNames) map[t] = false
    return map
  }
  
  // Создаем уникальный набор нормализованных имен для запроса
  const uniqueNormalized = new Set<string>()
  const nameMapping: Array<{ original: string, normalized: string }> = []
  
  for (const name of tableNames) {
    const normalized = name.toLowerCase().trim()
    uniqueNormalized.add(normalized)
    nameMapping.push({ original: name, normalized })
  }
  
  // Проверяем кеш по уникальным нормализованным именам
  const sortedUnique = Array.from(uniqueNormalized).sort()
  const cacheKey = JSON.stringify(sortedUnique)
  const cached = tablesCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < TABLES_CACHE_TTL) {
    // Восстанавливаем результат с оригинальными именами
    const map: Record<string, boolean> = {}
    for (const { original, normalized } of nameMapping) {
      map[original] = cached.result[normalized] || false
    }
    return map
  }
  
  // Оптимизированный запрос с LIMIT (используем уникальные нормализованные имена)
  const sql = `
    SELECT LOWER(table_name) as table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND LOWER(table_name) = ANY($1::text[])
    LIMIT ${sortedUnique.length}
  `
  const res = await executeQuery(sql, [sortedUnique])
  const set = new Set(res.rows.map((r: any) => r.table_name))
  
  // Создаем результат с нормализованными именами для кеша
  const normalizedResult: Record<string, boolean> = {}
  for (const n of sortedUnique) {
    normalizedResult[n] = set.has(n)
  }
  
  // Сохраняем в кеш
  tablesCache.set(cacheKey, { result: normalizedResult, timestamp: Date.now() })
  
  // Возвращаем результат с оригинальными именами
  const map: Record<string, boolean> = {}
  for (const { original, normalized } of nameMapping) {
    map[original] = normalizedResult[normalized]
  }
  
  // Очищаем старые записи из кеша
  if (tablesCache.size > 100) {
    const now = Date.now()
    for (const [key, value] of tablesCache.entries()) {
      if (now - value.timestamp > TABLES_CACHE_TTL) {
        tablesCache.delete(key)
      }
    }
  }
  
  return map
}

export async function columnsExist(table: string, columns: string[]): Promise<Record<string, boolean>> {
  if (!columns || columns.length === 0) return {}
  if (!isDatabaseAvailableSync()) {
    const map: Record<string, boolean> = {}
    for (const c of columns) map[c] = false
    return map
  }
  const sql = `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name = $1 AND column_name = ANY($2)
  `
  const res = await executeQuery(sql, [table, columns])
  const set = new Set(res.rows.map((r: any) => r.column_name))
  const map: Record<string, boolean> = {}
  for (const c of columns) map[c] = set.has(c)
  return map
}

export function okEmpty(dataKey: string = 'data', extra: Record<string, any> = {}) {
  return NextResponse.json({ success: true, [dataKey]: Array.isArray(extra[dataKey]) ? extra[dataKey] : [], ...extra })
}