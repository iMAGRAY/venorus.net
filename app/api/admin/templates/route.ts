import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasPermission } from '@/lib/auth/database-auth'
import { pool } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { 
  validateTemplateInput, 
  sanitizeTemplateData,
  validateCharacteristicsSize,
  type Characteristics 
} from '@/lib/validation/template-validators'

interface Template {
  id: number
  name: string
  description?: string
  characteristics: Characteristics
  created_at: Date
  updated_at: Date
  is_favorite?: boolean
}

// GET - получить все шаблоны
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'templates.read') &&
        !hasPermission(session.user, 'templates.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Проверяем кеш
    const cacheKey = `templates:all:${session.user.username}`
    const cached = await unifiedCache.get<Template[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ templates: cached })
    }

    // Use imported pool instance
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        characteristics,
        is_favorite,
        created_at,
        updated_at
      FROM form_templates
      ORDER BY updated_at DESC
    `)

    const templates = result.rows

    // Кешируем результат
    await unifiedCache.set(cacheKey, templates, { ttl: 600000 }) // 10 минут

    logger.info('Templates retrieved', {
      count: templates.length,
      user: session.user.username
    })

    return NextResponse.json({ templates })

  } catch (error) {
    logger.error('Failed to get templates', error)
    return NextResponse.json(
      { error: 'Failed to retrieve templates' },
      { status: 500 }
    )
  }
}

// POST - создать новый шаблон
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'templates.create') &&
        !hasPermission(session.user, 'templates.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse request body safely
    let requestData
    try {
      requestData = await request.json()
    } catch (error) {
      logger.error('Invalid JSON in request body', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, description, characteristics } = requestData

    // Comprehensive input validation
    const validationResult = validateTemplateInput(name, description, characteristics)
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedData = sanitizeTemplateData(name, description)

    // Database operation with error handling
    let result
    try {
      result = await pool.query(`
        INSERT INTO form_templates (name, description, characteristics)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, characteristics, is_favorite, created_at, updated_at
      `, [
        sanitizedData.name, 
        sanitizedData.description, 
        JSON.stringify(characteristics)
      ])
    } catch (error) {
      logger.error('Database insert failed for template', { name: sanitizedData.name, error })
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    // Check if insertion was successful
    if (!result.rows || result.rows.length === 0) {
      logger.error('Template creation failed: no rows returned', { name: sanitizedData.name })
      return NextResponse.json(
        { error: 'Failed to create template: database operation failed' },
        { status: 500 }
      )
    }

    const newTemplate = result.rows[0]

    // Инвалидируем кеш
    try {
      await unifiedCache.delete(`templates:all:${session.user.username}`)
    } catch (cacheError) {
      logger.warn('Failed to invalidate template cache', cacheError)
      // Don't fail the request due to cache issues
    }

    logger.info('Template created successfully', {
      templateId: newTemplate.id,
      name: sanitizedData.name,
      user: session.user.username
    })

    return NextResponse.json({
      template: newTemplate,
      message: 'Template created successfully'
    }, { status: 201 })

  } catch (error) {
    logger.error('Failed to create template', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

// PUT - обновить шаблон
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'templates.update') &&
        !hasPermission(session.user, 'templates.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let id, name, description, characteristics
    try {
      ({ id, name, description, characteristics } = await request.json())
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (!id || !name || !characteristics) {
      return NextResponse.json(
        { error: 'ID, name and characteristics are required' },
        { status: 400 }
      )
    }

    // Validate input types and content
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { error: 'ID must be a positive integer' },
        { status: 400 }
      )
    }
    
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name must be a non-empty string' },
        { status: 400 }
      )
    }
    
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string or null' },
        { status: 400 }
      )
    }
    
    if (typeof characteristics !== 'object' || characteristics === null || Array.isArray(characteristics)) {
      return NextResponse.json(
        { error: 'Characteristics must be a valid object' },
        { status: 400 }
      )
    }

    // Comprehensive input validation
    const validationResult = validateTemplateInput(name, description, characteristics)
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedData = sanitizeTemplateData(name, description)

    // Safe JSON serialization (already validated above)
    const serializedCharacteristics = JSON.stringify(characteristics)

    // Execute update query with comprehensive error handling
    let result
    try {
      result = await pool.query(`
        UPDATE form_templates
        SET
          name = $1,
          description = $2,
          characteristics = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, description, characteristics, created_at, updated_at
      `, [
        sanitizedData.name, 
        sanitizedData.description, 
        JSON.stringify(characteristics), 
        numericId
      ])
    } catch (error) {
      logger.error('Database update failed for template', { templateId: numericId, error })
      return NextResponse.json(
        { error: 'Database operation failed' },
        { status: 500 }
      )
    }

    // Check if template was found and updated
    if (result.rows.length === 0 || result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const updatedTemplate = result.rows[0]

    // Инвалидируем кеш
    await unifiedCache.delete(`templates:all:${session.user.username}`)
    await unifiedCache.delete(`template:${id}`)

    logger.info('Template updated', {
      templateId: id,
      name,
      user: session.user.username
    })

    return NextResponse.json({
      template: updatedTemplate,
      message: 'Template updated successfully'
    })

  } catch (error) {
    logger.error('Failed to update template', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE - удалить шаблон
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'templates.delete') &&
        !hasPermission(session.user, 'templates.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Use imported pool instance
    const result = await pool.query(`
      DELETE FROM form_templates
      WHERE id = $1
      RETURNING name
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    const deletedTemplate = result.rows[0]

    // Инвалидируем кеш
    await unifiedCache.delete(`templates:all:${session.user.username}`)
    await unifiedCache.delete(`template:${id}`)

    logger.info('Template deleted', {
      templateId: id,
      name: deletedTemplate.name,
      user: session.user.username
    })

    return NextResponse.json({
      message: 'Template deleted successfully'
    })

  } catch (error) {
    logger.error('Failed to delete template', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}