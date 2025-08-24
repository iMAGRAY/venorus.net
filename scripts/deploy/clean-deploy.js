#!/usr/bin/env node

const { exec } = require('child_process')
const fs = require('fs').promises
const path = require('path')

// Логирование деплойментов
const DEPLOY_LOG_FILE = path.join(process.cwd(), 'logs', 'deploy.log')

async function log(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  
  try {
    await fs.mkdir(path.dirname(DEPLOY_LOG_FILE), { recursive: true })
    await fs.appendFile(DEPLOY_LOG_FILE, logMessage)
  } catch (error) {
    console.error('Failed to write log:', error.message)
  }
  
  console.log(message)
}

function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

async function runCommand(command, description, timeout = 120000) {
  await log(`🔄 ${description}...`)
  try {
    const { stdout, stderr } = await execAsync(command, { 
      cwd: process.cwd(),
      timeout
    })
    
    if (stdout) await log(`✅ ${description} completed`)
    if (stderr) await log(`⚠️ ${description} stderr: ${stderr}`)
    
    return { success: true, stdout, stderr }
  } catch (error) {
    await log(`❌ ${description} failed: ${error.message}`)
    throw error
  }
}

async function cleanDeploy() {
  try {
    await log('🚀 ===== STARTING CLEAN DEPLOYMENT =====')
    
    // 1. Остановка всех процессов
    await runCommand('node scripts/kill-port.js 3000', 'Stopping processes on port 3000')
    await runCommand('node scripts/kill-port.js 3010', 'Stopping processes on port 3010')
    
    // 2. Полная очистка проекта
    await log('🧹 ===== CLEANING PROJECT =====')
    await runCommand('rm -rf .next', 'Removing .next directory')
    await runCommand('rm -rf node_modules', 'Removing node_modules directory') 
    await runCommand('rm -rf out', 'Removing out directory')
    await runCommand('rm -rf .turbo', 'Removing .turbo cache')
    await runCommand('rm -f package-lock.json', 'Removing package-lock.json')
    
    // 3. Полный git reset
    await log('📡 ===== RESETTING TO LATEST CODE =====')
    await runCommand('git fetch origin', 'Fetching latest changes from origin')
    await runCommand('git reset --hard origin/main', 'Hard reset to origin/main')
    await runCommand('git clean -fd', 'Cleaning untracked files')
    
    // 4. Свежая установка зависимостей
    await log('📦 ===== FRESH INSTALL =====')
    await runCommand('npm cache clean --force', 'Cleaning npm cache', 60000)
    await runCommand('npm install --no-optional --no-audit', 'Installing dependencies', 300000) // 5 минут
    
    // 5. Сборка проекта
    await log('🔨 ===== BUILDING PROJECT =====')
    await runCommand('npm run build', 'Building project', 300000) // 5 минут
    
    // 6. Запуск на порту 3010
    await log('🚀 ===== STARTING SERVER =====')
    await runCommand('PORT=3010 nohup npm start > /dev/null 2>&1 &', 'Starting production server')
    
    await log('🎉 ===== CLEAN DEPLOYMENT COMPLETED SUCCESSFULLY =====')
    
    return { success: true }
  } catch (error) {
    await log(`💥 ===== DEPLOYMENT FAILED: ${error.message} =====`)
    return { success: false, error: error.message }
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  cleanDeploy()
    .then(result => {
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { cleanDeploy }