import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/database/db-connection';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    // Сначала получаем информацию о производителе
    const manufacturerResult = await pool.query(
      'SELECT * FROM manufacturers WHERE id = $1',
      [resolvedParams.id]
    );

    if (manufacturerResult.rows.length === 0) {
      // No need to release with shared pool
      return NextResponse.json(
        { success: false, error: 'Производитель не найден' },
        { status: 404 }
      );
    }

    // Получаем модельные ряды производителя
    const modelLinesResult = await pool.query(`
      SELECT
        ml.*,
        m.name as manufacturer_name,
        COUNT(p.id) as products_count
      FROM model_series ml
      LEFT JOIN manufacturers m ON ml.manufacturer_id = m.id
      LEFT JOIN products p ON ml.id = p.series_id
      WHERE ml.manufacturer_id = $1
      GROUP BY ml.id, m.name
      ORDER BY ml.name
    `, [resolvedParams.id]);

    // No need to release with shared pool

    return NextResponse.json({
      success: true,
      data: {
        manufacturer: manufacturerResult.rows[0],
        modelLines: modelLinesResult.rows
      }
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Ошибка получения данных' },
      { status: 500 }
    );
  }
}