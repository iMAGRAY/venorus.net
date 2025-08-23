import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/database/db-connection'

// PUT - обновить секцию
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const { name, description, capacity, row_number, shelf_number, zone_id } = body

    // Валидация
    if (!name || !capacity || !row_number || !shelf_number || !zone_id) {
      return NextResponse.json(
        { success: false, error: 'Все поля обязательны' },
        { status: 400 }
      )
    }

    // Use shared pool instead of creating new connection

    try {
      // Проверяем, существует ли зона
      const zoneCheck = await pool.query(`
        SELECT id FROM warehouse_zones
        WHERE id = $1 AND is_active = true
      `, [zone_id])

      if (zoneCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Зона не найдена' },
          { status: 404 }
        )
      }

      const result = await pool.query(`
        UPDATE warehouse_sections
        SET
          name = $2,
          description = $3,
          capacity = $4,
          row_number = $5,
          shelf_number = $6,
          zone_id = $7,
          updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [id, name, description || '', capacity, row_number, shelf_number, zone_id])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Секция не найдена' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0]
      })
    } finally {
      // No need to release with shared pool
    }
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления секции' },
      { status: 500 }
    )
  }
}

// DELETE - удалить секцию (мягкое удаление)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id } = resolvedParams

    // Use shared pool instead of creating new connection

    try {
      // Проверяем, есть ли товары в секции
      const inventoryCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM warehouse_inventory
        WHERE section_id = $1 AND status != 'discontinued'
      `, [id])

      if (parseInt(inventoryCheck.rows[0].count) > 0) {
        return NextResponse.json(
          { success: false, error: 'Нельзя удалить секцию с товарами' },
          { status: 400 }
        )
      }

      const result = await pool.query(`
        UPDATE warehouse_sections
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [id])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Секция не найдена' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Секция успешно удалена'
      })
    } finally {
      // No need to release with shared pool
    }
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления секции' },
      { status: 500 }
    )
  }
}