import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/lib/logger'

const execAsync = promisify(exec)

// Токен для безопасности полной очистки
const CLEAN_DEPLOY_TOKEN = process.env.CLEAN_DEPLOY_TOKEN || 'clean-deploy-secret-2024'

async function performCleanDeploy(): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    logger.info('🧹 Starting full clean deployment...')
    
    // Выполняем скрипт полной очистки и переразвертывания
    const { stdout, stderr } = await execAsync('node scripts/deploy/clean-deploy.js', {
      cwd: process.cwd(),
      timeout: 600000 // 10 минут максимум
    })
    
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
    logger.info('✅ Clean deployment completed successfully')
    logger.info(output)
    
    return { success: true, output }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('❌ Clean deployment failed:', errorMessage)
    
    return { 
      success: false, 
      output: '', 
      error: errorMessage 
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token !== CLEAN_DEPLOY_TOKEN) {
      logger.warn('❌ Unauthorized clean deploy attempt')
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    logger.info('🧹 Clean deployment requested with valid token')
    
    // Запускаем полную очистку и развертывание асинхронно
    performCleanDeploy().then(result => {
      if (result.success) {
        logger.info('🎉 Clean deployment completed successfully')
      } else {
        logger.error('💥 Clean deployment failed:', result.error)
      }
    })
    
    return NextResponse.json({ 
      message: 'Clean deployment started',
      timestamp: new Date().toISOString(),
      warning: 'This will completely wipe and redeploy the application'
    })
    
  } catch (error) {
    logger.error('❌ Clean deploy API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Clean Deploy API Endpoint',
    status: 'active',
    usage: 'POST with Authorization: Bearer <token>',
    warning: 'This will completely wipe and redeploy the application',
    timestamp: new Date().toISOString()
  })
}