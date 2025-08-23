import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'Неверный ID продукта'
      }, { status: 400 })
    }
    
    // Получаем варианты продукта (минимальный безопасный набор полей)
    const result = await pool.query(`
      SELECT 
        pv.id,
        pv.master_id,
        pv.sku,
        pv.price,
        pv.discount_price,
        pv.stock_quantity,
        pv.created_at,
        pv.updated_at
      FROM product_variants pv
      WHERE pv.master_id = $1
      ORDER BY pv.id
    `, [productId])
    
    // Форматируем данные (базовая структура)
    const variants = result.rows.map(row => ({
      id: row.id,
      masterId: row.master_id,
      sku: row.sku,
      price: row.price ? parseFloat(row.price) : null,
      discountPrice: row.discount_price ? parseFloat(row.discount_price) : null,
      stockQuantity: row.stock_quantity,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    return NextResponse.json({
      success: true,
      data: variants
    })
    
  } catch (error: any) {
    logger.error('Error getting product variants:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения вариантов продукта',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}