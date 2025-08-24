#!/usr/bin/env node

/**
 * Скрипт для полной очистки и переразвертывания сайта
 * ВНИМАНИЕ: Это полностью удалит и пересоздаст весь сайт!
 */

const https = require('https')

// Конфигурация
const CLEAN_DEPLOY_URL = 'https://venorus.net/api/deploy/clean'
const CLEAN_DEPLOY_TOKEN = 'clean-deploy-secret-2024'

// Настройки запроса
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLEAN_DEPLOY_TOKEN}`,
    'User-Agent': 'Clean-Deploy-Trigger/1.0'
  }
}

console.log('🧹 ===== ЗАПУСК ПОЛНОЙ ОЧИСТКИ И ПЕРЕРАЗВЕРТЫВАНИЯ =====')
console.log(`URL: ${CLEAN_DEPLOY_URL}`)
console.log('⚠️  ВНИМАНИЕ: Это полностью удалит текущий сайт и создаст новый!')
console.log('📦 Будет развернута наша оптимизированная версия с исправлениями')

// Отправляем запрос на полную очистку
const req = https.request(CLEAN_DEPLOY_URL, options, (res) => {
  console.log(`\n✅ Ответ получен: ${res.statusCode} ${res.statusMessage}`)
  
  let data = ''
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data)
      console.log('📦 Ответ сервера:', JSON.stringify(response, null, 2))
      
      if (res.statusCode === 200) {
        console.log('🎉 Полная очистка и переразвертывание запущены!')
        console.log('⏳ Это займет 5-10 минут. Сайт будет временно недоступен.')
        console.log('🔄 Проверяйте статус через несколько минут')
      } else {
        console.log('❌ Ошибка при запуске очистки')
      }
    } catch (e) {
      console.log('📄 Ответ сервера (raw):', data)
    }
  })
})

req.on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message)
})

// Отправляем запрос
req.end()

console.log('⏳ Отправляем запрос на полную очистку...')