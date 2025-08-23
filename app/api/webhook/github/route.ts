import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/lib/logger'

const execAsync = promisify(exec)

// GitHub webhook secret for security
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret'

function verifySignature(payload: string, signature: string): boolean {
  if (!signature) return false
  
  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')
  
  const receivedSignature = signature.replace('sha256=', '')
  
  return expectedSignature === receivedSignature
}

async function deployUpdate(): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    logger.info('🚀 Starting automatic deployment...')
    
    // Выполняем скрипт автоматического обновления
    const { stdout, stderr } = await execAsync('npm run deploy:auto', {
      cwd: process.cwd(),
      timeout: 300000 // 5 минут timeout
    })
    
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
    logger.info('✅ Deployment completed successfully')
    logger.info(output)
    
    return { success: true, output }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('❌ Deployment failed:', errorMessage)
    
    return { 
      success: false, 
      output: '', 
      error: errorMessage 
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-hub-signature-256') || ''
    
    // Проверяем подпись для безопасности
    if (!verifySignature(payload, signature)) {
      logger.warn('❌ Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' }, 
        { status: 401 }
      )
    }
    
    const data = JSON.parse(payload)
    
    // Обрабатываем только push события в main/master ветку
    if (data.ref === 'refs/heads/main' || data.ref === 'refs/heads/master') {
      logger.info('📦 Push to main branch detected, starting deployment...')
      logger.info(`Commit: ${data.head_commit?.message || 'Unknown'}`)
      logger.info(`Author: ${data.head_commit?.author?.name || 'Unknown'}`)
      
      // Запускаем деплойment асинхронно
      deployUpdate().then(result => {
        if (result.success) {
          logger.info('🎉 Auto-deployment completed successfully')
        } else {
          logger.error('💥 Auto-deployment failed:', result.error)
        }
      })
      
      return NextResponse.json({ 
        message: 'Deployment started',
        commit: data.head_commit?.id?.substring(0, 7) || 'unknown',
        branch: data.ref
      })
    }
    
    // Игнорируем push в другие ветки
    return NextResponse.json({ 
      message: 'Ignored - not main branch',
      branch: data.ref
    })
    
  } catch (error) {
    logger.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'GitHub Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}