import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit'

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const ip = getClientIP(request)
  
  // Применяем rate limiting для API endpoints
  if (url.pathname.startsWith('/api/')) {
    // Исключаем некоторые endpoints из общего rate limiting
    const excludedPaths = ['/api/health', '/api/admin/auth/login', '/api/cache/', '/api/products', '/api/categories', '/api/characteristics', '/api/manufacturers'] 
    
    // Исключения для test environment - localhost, development, или unknown IP
    const isTestEnvironment = process.env.NODE_ENV === 'development' || 
                              ip === 'unknown' || 
                              ip === '127.0.0.1' || 
                              ip === 'localhost' ||
                              process.env.DISABLE_RATE_LIMIT === 'true'
    
    if (!excludedPaths.some(path => url.pathname.startsWith(path)) && !isTestEnvironment) {
      const rateLimitResult = rateLimit(request, RATE_LIMITS.api)
      
      if (!rateLimitResult.allowed) {
        const resetTime = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
        
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Превышен лимит запросов. Попробуйте позже.',
            retryAfter: resetTime
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': resetTime.toString(),
              'X-RateLimit-Limit': RATE_LIMITS.api.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.resetTime!.toString()
            }
          }
        )
      }
    }
  }
  
  // Создаем response с security headers
  let response = NextResponse.next()
  
  // Оптимизированная обработка запросов на логотипы - объединяем все проверки
  const logoPathsMap = {
    '/logo.webp': '/Logo-main.webp',
    '/Logo.webp': '/Logo-main.webp',
    '/dark_logo.webp': '/Logo-main.webp',
    '/logo.svg': '/Logo-main.webp'
  } as const
  
  const logoRedirect = logoPathsMap[url.pathname as keyof typeof logoPathsMap]
  if (logoRedirect && request.method === 'GET') {
    response = NextResponse.rewrite(new URL(logoRedirect, request.url))
  }
  
  // Hero.png должен обслуживаться через nginx напрямую из public папки
  
  // Логируем 404 для изображений производителей и возвращаем заглушку
  if (url.pathname.startsWith('/images/manufacturers/') && request.method === 'GET') {
    // Возвращаем логотип по умолчанию для производителей
    response = NextResponse.rewrite(new URL('/Logo-main.webp', request.url))
  }
  
  // Оптимизированная защита от XSS и SQL injection - проверяем только опасные пути
  let hasXSSAttempt = false
  
  // Оптимизация: проверяем только API routes и пути с параметрами
  if (url.search && (url.pathname.startsWith('/api/') || url.searchParams.size > 0)) {
    // Компактные критичные паттерны для лучшей производительности
    const criticalPatterns = [
      /<script/gi, /javascript:/gi, /on\w+\s*=/gi, /<iframe/gi,
      /alert\s*\(/gi, /eval\s*\(/gi, /document\./gi, /window\./gi,
      /%3cscript/gi, /&lt;script/gi,
      /'.*or.*'.*=/gi, /'\s*;\s*(drop|delete|update|insert)/gi,
      /union.*select/gi, /--/gi, /\/\*/gi
    ]
    
    // Оптимизация: объединяем все параметры в одну строку для единственной проверки
    const allParams = Array.from(url.searchParams.values()).join(' ')
    
    try {
      const decodedParams = decodeURIComponent(allParams)
      hasXSSAttempt = criticalPatterns.some(pattern => pattern.test(decodedParams))
    } catch {
      // Если декодирование не удалось, считаем это подозрительным
      hasXSSAttempt = true
    }
  }
  
  // Если найден XSS паттерн, возвращаем 400 ошибку вместо продолжения
  if (hasXSSAttempt) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Malicious request detected',
        code: 'XSS_ATTEMPT'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )
  }
  
  // Проверяем паттерн callback в URL (часто используется для JSONP XSS)
  if (url.pathname.includes('callback=') || url.search.includes('callback=')) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Callback parameter not allowed',
        code: 'CALLBACK_BLOCKED'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      }
    )
  }

  // Проверяем опасные параметры редиректа
  const dangerousParams = ['callback', 'redirect', 'return_url', 'goto', 'next']
  
  for (const param of dangerousParams) {
    const value = url.searchParams.get(param)
    if (value) {
      // Валидируем URL параметры
      try {
        const redirectUrl = new URL(value, request.url)
        // Разрешаем только локальные редиректы
        if (redirectUrl.origin !== url.origin) {
          return new NextResponse(
            JSON.stringify({
              success: false,
              error: 'External redirects not allowed',
              code: 'INVALID_REDIRECT'
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY'
              }
            }
          )
        }
      } catch {
        // Если не валидный URL, блокируем запрос
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Invalid URL in parameters',
            code: 'INVALID_URL'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY'
            }
          }
        )
      }
    }
  }
  
  // Добавляем security headers для защиты от атак
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Добавляем HSTS header для принудительного HTTPS
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  
  // Временно отключён строгий CSP для устранения блокировок Next.js ресурсов
  // response.headers.set('Content-Security-Policy', 
  //   "default-src 'self'; " +
  //   "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
  //   "style-src 'self' 'unsafe-inline' https:; " +
  //   "img-src 'self' data: https: blob:; " +
  //   "font-src 'self' data: https:; " +
  //   "connect-src 'self' ws: wss: https:; " +
  //   "frame-ancestors 'none'; " +
  //   "base-uri 'self'; " +
  //   "form-action 'self';"
  // )
  
  return response
}

export const config = {
  matcher: [
    // Применяем middleware ко всем маршрутам для security headers
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}