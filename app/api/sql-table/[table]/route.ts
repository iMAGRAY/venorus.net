import { NextResponse, NextRequest } from "next/server"
import { executeQuery } from "@/lib/database/db-connection"
import { requireAuth, hasPermission } from "@/lib/auth/database-auth"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TABLES = [
  'products',
  'categories',
  'model_series',
  'manufacturers',
  'product_sizes',      // @deprecated: Use product_variants instead
  'product_variants',   // Unified table for product variants
  'product_images',
  'site_settings',
  'product_characteristics',
  'catalog_menu_settings',
  'spec_groups',
  'characteristic_groups',
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  // КРИТИЧЕСКАЯ ПРОВЕРКА БЕЗОПАСНОСТИ
  const session = await requireAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только суперадмины могут читать прямые данные из БД
  if (!hasPermission(session.user, 'system.debug') &&
      !hasPermission(session.user, '*')) {
    return NextResponse.json({ error: 'Access denied - admin privileges required' }, { status: 403 })
  }

  const resolvedParams = await params
  const { table } = resolvedParams
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
  }
  const limit = 50
  try {
    const result = await executeQuery(`SELECT * FROM ${table} ORDER BY 1 LIMIT $1`, [limit])
    return NextResponse.json({ rows: result.rows })
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 })
  }
}