#!/usr/bin/env node

/**
 * Скрипт для ручного запуска деплоя на сервере
 * Имитирует GitHub webhook для обновления сервера
 */

const https = require('https');
const crypto = require('crypto');

// Конфигурация сервера
const SERVER_HOST = 'venorus.com';
const WEBHOOK_PATH = '/api/webhook/github';
const WEBHOOK_SECRET = 'your-webhook-secret'; // Из кода webhook

// Создаем поддельный payload GitHub webhook
const mockPayload = {
  ref: 'refs/heads/main',
  head_commit: {
    id: '1234567890abcdef',
    message: 'feat: обновление российскими товарами - ручной деплой',
    author: {
      name: 'Claude Code',
      email: 'noreply@anthropic.com'
    }
  },
  repository: {
    name: 'venorus.com',
    full_name: 'user/venorus.com'
  }
};

function createSignature(payload, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function sendWebhook() {
  const payloadString = JSON.stringify(mockPayload);
  const signature = createSignature(payloadString, WEBHOOK_SECRET);
  
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
      'User-Agent': 'GitHub-Hookshot/12345'
    },
    rejectUnauthorized: false // Игнорируем SSL ошибки
  };

  console.log('🚀 Отправляем webhook на сервер...');
  console.log(`URL: https://${SERVER_HOST}${WEBHOOK_PATH}`);
  console.log(`Payload: ${payloadString.substring(0, 100)}...`);

  const req = https.request(options, (res) => {
    let data = '';
    
    console.log(`📊 Статус: ${res.statusCode}`);
    console.log(`📋 Заголовки:`, res.headers);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📥 Ответ сервера:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
        
        if (res.statusCode === 200) {
          console.log('✅ Webhook успешно отправлен!');
          console.log('⏳ Деплой запущен на сервере...');
        } else {
          console.log('❌ Ошибка webhook:', response);
        }
      } catch (e) {
        console.log('📄 Raw ответ:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Ошибка запроса:', error.message);
    
    // Пробуем альтернативный способ - прямое обращение к IP
    console.log('🔄 Пробуем обратиться по IP...');
    sendWebhookToIP();
  });

  req.write(payloadString);
  req.end();
}

function sendWebhookToIP() {
  const payloadString = JSON.stringify(mockPayload);
  const signature = createSignature(payloadString, WEBHOOK_SECRET);
  
  const options = {
    hostname: '109.73.195.215',
    port: 443,
    path: WEBHOOK_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payloadString.length,
      'X-Hub-Signature-256': signature,
      'X-GitHub-Event': 'push',
      'User-Agent': 'GitHub-Hookshot/12345',
      'Host': 'venorus.com'
    },
    rejectUnauthorized: false
  };

  console.log('🚀 Отправляем webhook по IP...');
  
  const req = https.request(options, (res) => {
    let data = '';
    
    console.log(`📊 Статус: ${res.statusCode}`);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📥 Ответ сервера:', data);
    });
  });

  req.on('error', (error) => {
    console.error('❌ Ошибка IP запроса:', error.message);
  });

  req.write(payloadString);
  req.end();
}

// Также попробуем GET запрос для проверки
function testWebhookEndpoint() {
  const options = {
    hostname: '109.73.195.215',
    port: 443,
    path: WEBHOOK_PATH,
    method: 'GET',
    headers: {
      'Host': 'venorus.com'
    },
    rejectUnauthorized: false
  };

  console.log('🔍 Тестируем webhook endpoint...');
  
  const req = https.request(options, (res) => {
    let data = '';
    
    console.log(`📊 GET Статус: ${res.statusCode}`);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📥 GET Ответ:', data);
      
      // После тестирования запускаем деплой
      setTimeout(sendWebhook, 1000);
    });
  });

  req.on('error', (error) => {
    console.error('❌ Ошибка тестирования:', error.message);
    // Все равно пробуем деплой
    setTimeout(sendWebhook, 1000);
  });

  req.end();
}

console.log('🇷🇺 MANUAL DEPLOY TRIGGER для venorus.com');
console.log('============================================');
console.log('Запускаем обновление сервера российскими товарами...');

// Начинаем с тестирования
testWebhookEndpoint();