import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/lib/logger'

const execAsync = promisify(exec)

// Simple restart API with basic authentication
const RESTART_TOKEN = process.env.RESTART_TOKEN || 'restart-secret-2024'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token !== RESTART_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    logger.info('🔄 Manual restart requested...')
    
    // Выполняем команды перезапуска
    const commands = [
      'git pull origin main',
      'npm install --production',
      'npm run build',
      'pm2 restart venorus || pkill -f "next start" && nohup npm start > /dev/null 2>&1 &'
    ]
    
    for (const command of commands) {
      try {
        logger.info(`Executing: ${command}`)
        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          timeout: 120000 // 2 минуты на каждую команду
        })
        
        if (stderr) {
          logger.warn(`STDERR for ${command}: ${stderr}`)
        }
        logger.info(`SUCCESS: ${command}`)
      } catch (error) {
        logger.error(`Failed command: ${command}`, error)
        return NextResponse.json({
          error: `Command failed: ${command}`,
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
    
    logger.info('✅ Manual restart completed successfully')
    
    return NextResponse.json({ 
      message: 'Restart completed successfully',
      timestamp: new Date().toISOString(),
      commands: commands.length
    })
    
  } catch (error) {
    logger.error('❌ Restart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Restart API Endpoint',
    status: 'active',
    usage: 'POST with Authorization: Bearer <token>',
    timestamp: new Date().toISOString()
  })
}