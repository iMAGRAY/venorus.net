import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    // Читаем последние записи из лога деплойментов
    const logPath = join(process.cwd(), 'logs', 'deploy.log')
    
    let lastDeployments: string[] = []
    try {
      const logContent = await readFile(logPath, 'utf-8')
      const lines = logContent.split('\n').filter(Boolean)
      lastDeployments = lines.slice(-10) // Последние 10 записей
    } catch (_error) {
      // Лог файл не существует или недоступен
    }
    
    // Проверяем статус Git репозитория
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    
    let gitInfo = {}
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD')
      const { stdout: commit } = await execAsync('git rev-parse --short HEAD')
      const { stdout: lastCommit } = await execAsync('git log -1 --pretty=format:"%s - %an (%cr)"')
      
      gitInfo = {
        branch: branch.trim(),
        commit: commit.trim(),
        lastCommit: lastCommit.trim()
      }
    } catch (_error) {
      gitInfo = { error: 'Unable to read git info' }
    }
    
    return NextResponse.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      deploymentLogs: lastDeployments,
      git: gitInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        webhookConfigured: !!process.env.GITHUB_WEBHOOK_SECRET
      }
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to read deployment status',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}