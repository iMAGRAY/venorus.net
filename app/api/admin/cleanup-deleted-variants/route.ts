import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database/db-connection';
import { requireAuth, hasPermission } from '@/lib/auth/database-auth';
import { invalidateRelated } from '@/lib/cache/cache-utils';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    logger.info('Starting cleanup of deleted variants');

    // 1. Проверяем сколько вариантов имеют is_deleted = true, но is_active = true
    const checkResult = await executeQuery(`
      SELECT COUNT(*) as count
      FROM product_variants
      WHERE is_deleted = true AND is_active = true
    `);
    
    const problemCount = parseInt(checkResult.rows[0].count);
    logger.info(`Found ${problemCount} problematic variants`);
    
    const report: any = {
      problemVariantsFound: problemCount,
      examples: [],
      fixed: 0,
      success: false
    };
    
    if (problemCount > 0) {
      // 2. Получаем примеры проблемных вариантов
      const examplesResult = await executeQuery(`
        SELECT pv.id, pv.name, pv.sku, p.name as product_name
        FROM product_variants pv
        JOIN products p ON pv.master_id = p.id
        WHERE pv.is_deleted = true AND pv.is_active = true
        LIMIT 5
      `);
      
      report.examples = examplesResult.rows;
      
      // 3. Исправляем проблему - устанавливаем is_active = false для всех удаленных вариантов
      const updateResult = await executeQuery(`
        UPDATE product_variants
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE is_deleted = true AND is_active = true
      `);
      
      report.fixed = updateResult.rowCount;
      logger.info(`Fixed ${report.fixed} variants`);
    }
    
    // 4. Очищаем кеш
    try {
      await invalidateRelated([
        'medsip:products:*',
        'products:*',
        'product:*',
        'products-fast:*',
        'products-full:*',
        'products-detailed:*',
        'products-basic:*',
        'variants:*',
        'product-variants:*'
      ]);
      report.cacheCleared = true;
    } catch (cacheError) {
      logger.error('Failed to clear cache:', cacheError);
      report.cacheCleared = false;
      report.cacheError = cacheError.message;
    }
    
    // 5. Получаем итоговую статистику
    const statsResult = await executeQuery(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true AND is_deleted = false) as active_variants,
        COUNT(*) FILTER (WHERE is_active = false OR is_deleted = true) as inactive_variants,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted_variants,
        COUNT(*) as total_variants
      FROM product_variants
    `);
    
    report.statistics = statsResult.rows[0];
    report.success = true;
    
    logger.info('Cleanup completed successfully', report);
    
    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      report
    });
    
  } catch (error) {
    logger.error('Failed to cleanup deleted variants:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup deleted variants',
        details: error.message
      },
      { status: 500 }
    );
  }
}