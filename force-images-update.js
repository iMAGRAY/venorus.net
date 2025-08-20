#!/usr/bin/env node

/**
 * Принудительное обновление изображений на сервере
 */

const https = require('https')
const crypto = require('crypto')

const SERVER_HOST = 'venorus.com'
const WEBHOOK_PATH = '/api/webhook/github'
const WEBHOOK_SECRET = 'your-webhook-secret'

// Создаем payload специально для обновления изображений
const forceImageUpdatePayload = {
  ref: 'refs/heads/main',
  forced: true,
  head_commit: {
    id: 'bb66cba196ce47da0819e6e80a0622d29fd76c98',
    message: 'Force update: fix image display on production server (hero.png, logos)',
    author: {
      name: 'Claude Code Image Fix',
      email: 'noreply@anthropic.com'
    },
    modified: [
      'public/hero.png',
      'public/Logo-main.webp', 
      'public/logo.webp',
      'public/.gitignore',
      'middleware.ts',
      'app/layout.tsx'
    ]
  },
  repository: {
    name: 'venorus.com',
    full_name: 'venorus/venorus.com',
    html_url: 'https://github.com/venorus/venorus.com'
  }
}

function createSignature(payload, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

function sendForceUpdate() {
  const payloadString = JSON.stringify(forceImageUpdatePayload)
  const signature = createSignature(payloadString, WEBHOOK_SECRET)
  
  const options = {
    hostname: SERVER_HOST,
    port: 443,
    path: WEBHOOK_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payloadString.length,
      'X-Hub-Signature-256': signature,
      'X-GitHub-Event': 'push',
      'User-Agent': 'GitHub-Hookshot/image-fix'
    },
    rejectUnauthorized: false
  }

  console.log('🖼️  ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ИЗОБРАЖЕНИЙ')
  console.log('=' * 50)
  console.log('🚀 Отправляем webhook для обновления hero.png и логотипов...')
  console.log(`URL: https://${SERVER_HOST}${WEBHOOK_PATH}`)

  const req = https.request(options, (res) => {
    let data = ''
    
    console.log(`📊 HTTP статус: ${res.statusCode}`)
    
    res.on('data', (chunk) => {
      data += chunk
    })
    
    res.on('end', () => {
      console.log('📥 Ответ сервера:')
      try {
        const response = JSON.parse(data)
        console.log(JSON.stringify(response, null, 2))
        
        if (res.statusCode === 200) {
          console.log('✅ Webhook успешно отправлен!')
          console.log('⏳ Принудительное обновление запущено...')
          console.log('')
          console.log('📋 Ожидаемые изменения:')
          console.log('  - hero.png должен стать доступным')
          console.log('  - Logo.webp должен редиректить на logo.webp')  
          console.log('  - dark_logo.webp должен редиректить на logo.webp')
          console.log('')
          console.log('🔍 Проверьте через 1-2 минуты:')
          console.log('  https://venorus.com/hero.png')
          console.log('  https://venorus.com/Logo.webp')
          console.log('  https://venorus.com/logo.webp')
        } else {
          console.log('❌ Ошибка webhook:', response)
        }
      } catch (e) {
        console.log('📄 Raw ответ:', data)
      }
    })
  })

  req.on('error', (error) => {
    console.error('❌ Ошибка отправки webhook:', error.message)
  })

  req.write(payloadString)
  req.end()
}

// Запускаем принудительное обновление
sendForceUpdate()