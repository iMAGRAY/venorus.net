import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'
import { getCacheManager } from '@/lib/dependency-injection'
import { invalidateProductCache } from '@/lib/cache/cache-utils'
import { requireAuth, hasPermission } from '@/lib/auth/database-auth'
import { preparedStatements, COMMON_QUERIES } from '@/lib/database/prepared-statements'
import { logger } from '@/lib/logger'

// SQL queries as constants for better maintainability  
const GET_PRODUCT_BY_ID_QUERY = `
  SELECT
    p.*,
    ms.name as model_line_name,
    m.name as manufacturer_name,
    pc.name as category_name,
    pc.name as category_full_path
  FROM products p
  LEFT JOIN model_series ms ON p.series_id = ms.id
  LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  WHERE p.id = $1 AND (p.is_deleted = false OR p.is_deleted IS NULL)
`

function isDbConfigured() {
  return !!process.env.DATABASE_URL || (
    !!process.env.POSTGRESQL_HOST && !!process.env.POSTGRESQL_USER && !!process.env.POSTGRESQL_DBNAME
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    logger.info('GET /api/products/[id] started')
    
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }
    // Оптимизация: убираем медленный testConnection()

    const { id } = await params
    logger.info('Extracted product ID', { id })
    
    // Строгая валидация ID для предотвращения SQL-инъекций
    const rawId = id.replace(/[^0-9]/g, '');
    if (rawId !== id || rawId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID format' },
        { status: 400 }
      )
    }
    const productId = parseInt(rawId, 10)
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    // Используем предопределенный запрос с правильным построением полного пути категории
    let productResult
    try {
      productResult = await executeQuery(GET_PRODUCT_BY_ID_QUERY, [productId])
    } catch (error) {
      logger.error('Database query failed for product by ID', { 
        productId, 
        error: error.message 
      })
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (productResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = productResult.rows[0]
    product.characteristics = {}
    product.imageUrls = []

    try {
      if (product.images && Array.isArray(product.images)) {
        product.imageUrls = product.images.map((img: any, index: number) => ({
          url: typeof img === 'string' ? img : img.url || img.image_url,
          alt: typeof img === 'object' ? img.alt || img.alt_text : `Product image ${index + 1}`,
          isPrimary: index === 0,
          order: index
        }))
      } else if (product.image_url) {
        product.imageUrls = [{ url: product.image_url, alt: product.name, isPrimary: true, order: 0 }]
      }
    } catch (_) {
      product.imageUrls = []
    }

    return NextResponse.json({ success: true, data: product })

  } catch (error) {
    logger.error('GET /api/products/[id] error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
  const _cacheManager = getCacheManager()

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }
    // Оптимизация: убираем медленный testConnection()

    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 })
    }

    let data
    try { data = await request.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400 }) }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 })
    }

    const checkQuery = `
      SELECT id, name FROM products
      WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)
    `

    const checkResult = await executeQuery(checkQuery, [productId])
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or already deleted' }, { status: 404 })
    }

    const query = `
      UPDATE products SET
        name = $1,
        description = $2,
        sku = $3,
        article_number = $4,
        price = $5,
        discount_price = $6,
        image_url = $7,
        images = $8,
        series_id = $9,
        manufacturer_id = $10,
        category_id = $11,
        in_stock = $12,
        stock_quantity = $13,
        stock_status = $14,
        weight = $15,
        battery_life = $16,
        warranty = $17,
        show_price = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19 AND (is_deleted = false OR is_deleted IS NULL)
      RETURNING *
    `

    const validateAndParseNumber = (value: any, fieldName: string, maxValue: number) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) { throw new Error(`Поле "${fieldName}" должно быть числом`) }
      if (parsed < 0) { throw new Error(`Поле "${fieldName}" не может быть отрицательным`) }
      if (parsed > maxValue) { throw new Error(`Поле "${fieldName}" не может превышать ${maxValue.toLocaleString('ru-RU')}`) }
      return parsed;
    };

    const validateAndParseInteger = (value: any, fieldName: string, maxValue: number = 2147483647) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseInt(value);
      if (isNaN(parsed)) { throw new Error(`Поле "${fieldName}" должно быть целым числом`) }
      if (parsed < 0) { throw new Error(`Поле "${fieldName}" не может быть отрицательным`) }
      if (parsed > maxValue) { throw new Error(`Поле "${fieldName}" не может превышать ${maxValue.toLocaleString('ru-RU')}`) }
      return parsed;
    };

    const values = [
      data.name.trim(),
      data.description || null,
      data.sku || null,
      data.article_number || null,
      validateAndParseNumber(data.price, 'цена', 99999999.99),
      validateAndParseNumber(data.discount_price, 'цена со скидкой', 99999999.99),
      data.image_url || null,
      JSON.stringify(data.images || []),
      validateAndParseInteger(data.series_id || data.model_line_id, 'линейка модели'),
      validateAndParseInteger(data.manufacturer_id, 'производитель'),
      validateAndParseInteger(data.category_id, 'категория'),
      data.in_stock !== undefined ? Boolean(data.in_stock) : true,
      validateAndParseInteger(data.stock_quantity, 'количество на складе') || 0,
      data.stock_status || 'in_stock',
      data.weight || null,
      data.battery_life || null,
      data.warranty || null,
      data.show_price !== undefined ? Boolean(data.show_price) : true,
      productId
    ]

    const result = await executeQuery(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or could not be updated' }, { status: 404 })
    }

    // Invalidate cache after update using unified function
    const categoryId = data.category_id || result.rows[0]?.category_id
    await invalidateProductCache(productId, categoryId, 'update')

    return NextResponse.json({ success: true, data: result.rows[0], message: 'Product updated successfully' })

  } catch (error) {
    if (error.message && (
      error.message.includes('должно быть числом') ||
      error.message.includes('не может быть отрицательным') ||
      error.message.includes('не может превышать') ||
      error.message.includes('должно быть целым числом')
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if ((error as any).code === '23514') {
      if ((error as any).constraint === 'check_stock_status_new') {
        return NextResponse.json({ error: 'Недопустимое значение статуса склада. Допустимые значения: В наличии, Нет в наличии, На заказ, Дальний склад, Ближний склад' }, { status: 400 })
      } else {
        return NextResponse.json({ error: 'Данные не соответствуют ограничениям базы данных' }, { status: 400 })
      }
    }

    if ((error as any).code === '23505') {
      if ((error as any).detail?.includes('sku')) {
        return NextResponse.json({ error: 'Продукт с таким SKU уже существует' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Продукт с такими данными уже существует' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Failed to update product', details: (error as any).message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cacheManager = getCacheManager()

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, error: 'Database config is not provided' }, { status: 503 })
    }
    // Оптимизация: убираем медленный testConnection()

    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, 'products.delete') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 })
    }

    const checkQuery = `SELECT id, name, category_id FROM products WHERE id = $1`
    const checkResult = await executeQuery(checkQuery, [productId])
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }
    
    const categoryId = checkResult.rows[0].category_id

    await executeQuery('BEGIN')

    try {
      const tablesToCheck = [
        'product_characteristics',
        'product_characteristics_simple',
        'product_characteristics_new',
        'product_variants',
        'product_images',
        'product_sizes',
        'product_specifications'
      ]

      for (const tableName of tablesToCheck) {
        try {
          const tableExists = await executeQuery(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = $1
            )
          `, [tableName])

          if (tableExists.rows[0]?.exists) {
            let deleteQuery = ''
            let paramsArr = [productId]

            switch (tableName) {
              case 'product_characteristics':
                deleteQuery = 'DELETE FROM product_characteristics WHERE product_id = $1'
                break
              case 'product_characteristics_simple':
                deleteQuery = 'DELETE FROM product_characteristics_simple WHERE product_id = $1'
                break
              case 'product_characteristics_new':
                deleteQuery = 'DELETE FROM product_characteristics_new WHERE variant_id IN (SELECT id FROM product_variants WHERE master_id = $1)'
                break
              case 'product_variants':
                deleteQuery = 'DELETE FROM product_variants WHERE master_id = $1'
                break
              case 'product_images':
                deleteQuery = 'DELETE FROM product_images WHERE product_id = $1'
                break
              case 'product_sizes':
                deleteQuery = 'DELETE FROM product_sizes WHERE product_id = $1'
                break
              case 'product_specifications':
                deleteQuery = 'DELETE FROM product_specifications WHERE product_id = $1'
                break
            }

            if (deleteQuery) { await executeQuery(deleteQuery, paramsArr) }
          }
        } catch (_) { /* skip individual table errors */ }
      }

      const deleteResult = await executeQuery('DELETE FROM products WHERE id = $1 RETURNING id, name', [productId])
      if (deleteResult.rows.length === 0) {
        await executeQuery('ROLLBACK')
        return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 })
      }

      await executeQuery('COMMIT')

      // Invalidate cache after deletion using unified function
      // Note: category query would fail after deletion, use provided categoryId if available
      await invalidateProductCache(productId, categoryId, 'delete')

      return NextResponse.json({ success: true, message: 'Product completely deleted', data: deleteResult.rows[0] })

    } catch (error) {
      await executeQuery('ROLLBACK')
      throw error
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete product', message: (error as any).message || 'Database operation failed' }, { status: 500 })
  }
}
