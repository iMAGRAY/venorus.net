"use client"

// Простой клиентский кеш в памяти
const clientApiCache = new Map<string, { data: any; expires: number }>()

// Утилиты для работы с клиентским кешем
const cacheUtils = {
  get: (key: string) => {
    const cached = clientApiCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    if (cached) {
      clientApiCache.delete(key) // Удаляем истекший кеш
    }
    return null
  },

  set: (key: string, _data: any, ttl: number = 300000) => { // 5 минут по умолчанию
    clientApiCache.set(key, {
      data: _data,
      expires: Date.now() + ttl
    })
  },

  delete: (key: string) => {
    clientApiCache.delete(key)
  },

  clear: () => {
    clientApiCache.clear()
  },

  getStats: () => {
    let validEntries = 0
    let expiredEntries = 0
    const now = Date.now()

    for (const [_key, value] of clientApiCache.entries()) {
      if (value.expires > now) {
        validEntries++
      } else {
        expiredEntries++
      }
    }

    return {
      total: clientApiCache.size,
      valid: validEntries,
      expired: expiredEntries,
      hitRate: validEntries / (validEntries + expiredEntries) || 0
    }
  }
}

// Интерфейс для кеширования запросов
interface CacheOptions {
  enabled?: boolean
  ttl?: number
  key?: string
  skipCache?: boolean
}

// API client for making requests to backend with advanced caching
export class ApiClient {
  private static instance: ApiClient
  private baseUrl: string
  private pendingRequests = new Map<string, Promise<any>>()

  constructor() {
    // Определяем правильный baseUrl в зависимости от окружения
    if (typeof window !== 'undefined') {
      // В браузере - используем текущий origin
      this.baseUrl = `${window.location.origin}/api`
    } else {
      // На сервере - используем относительный путь
      this.baseUrl = "/api"
    }

  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  private async request(endpoint: string, options: RequestInit = {}, cacheOptions: CacheOptions = {}): Promise<any> {
    const {
      enabled = true,
      ttl,
      key,
      skipCache = false
    } = cacheOptions

    // Добавляем логирование для PUT запросов к selection-tables
    if (options.method === 'PUT' && endpoint.includes('selection-tables')) {
      try {
        const _body = JSON.parse(options.body as string)
        console.debug('Selection tables PUT request:', { endpoint, body: _body })
      } catch (error) {
        console.error('Failed to parse selection-tables request body:', error)
      }
    }

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Отключаем кеш для:
    // 1. Всех мутирующих операций (POST, PUT, DELETE, PATCH)
    // 2. Всех админских роутов
    // 3. Роутов с параметром nocache
    const normalizedMethod = (options.method || 'GET').toUpperCase()
    const isMutatingOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(normalizedMethod)
    const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    const hasNoCacheParam = endpoint.includes('nocache=true')
    
    const shouldCache = enabled && !skipCache && !isMutatingOperation && !isAdminRoute && !hasNoCacheParam
    const cacheKey = key || `${endpoint}-${JSON.stringify(options)}`

    // Проверяем кеш
    if (shouldCache && !skipCache) {
      const cached = cacheUtils.get(cacheKey)
      if (cached) {

        return cached
      }
    }

    // Проверяем pending запросы (дедупликация)
    if (this.pendingRequests.has(cacheKey)) {

      return this.pendingRequests.get(cacheKey)!
    }

    const requestPromise = this.executeRequestWithRetry(endpoint, options)

    // Сохраняем pending запрос
    this.pendingRequests.set(cacheKey, requestPromise)

    try {
      const response = await requestPromise

      // Кешируем успешный ответ
      if (shouldCache && response) {
        cacheUtils.set(cacheKey, response, ttl)

      }

      // АВТОМАТИЧЕСКАЯ ОЧИСТКА КЕША ПОСЛЕ МУТАЦИЙ
      if (isMutatingOperation && response) {
        console.log(`[CACHE] Mutation detected (${normalizedMethod}), clearing related caches for: ${endpoint}`)
        
        // Извлекаем основные сущности из endpoint для очистки
        const patterns: string[] = []
        
        // Продукты
        if (endpoint.includes('/products')) {
          patterns.push('products')
          this.clearProductsCache()
        }
        
        // Категории
        if (endpoint.includes('/categories')) {
          patterns.push('categories')
          cacheUtils.delete('categories')
          cacheUtils.delete('site-settings') // Может содержать информацию о категориях
        }
        
        // Характеристики
        if (endpoint.includes('/characteristics') || endpoint.includes('/characteristic-')) {
          patterns.push('characteristics', 'characteristic-groups', 'characteristic-templates')
        }
        
        // Медиа
        if (endpoint.includes('/media')) {
          patterns.push('media')
        }
        
        // Производители
        if (endpoint.includes('/manufacturers')) {
          patterns.push('manufacturers')
        }
        
        // Настройки сайта
        if (endpoint.includes('/site-settings')) {
          cacheUtils.delete('site-settings')
        }
        
        // Очищаем все найденные паттерны из кеша
        for (const pattern of patterns) {
          for (const key of clientApiCache.keys()) {
            if (key.includes(pattern)) {
              cacheUtils.delete(key)
              console.log(`[CACHE] Cleared cache key: ${key}`)
            }
          }
        }
        
        // Для критичных операций очищаем весь кеш
        if (endpoint.includes('/products') || endpoint.includes('/categories')) {
          const stats = cacheUtils.getStats()
          console.log(`[CACHE] Critical mutation - clearing entire cache (${stats.total} entries)`)
          cacheUtils.clear()
        }
      }

      return response
    } catch (error) {
      console.error(`❌ API Error: ${endpoint}`, error)
      throw error
    } finally {
      // Убираем из pending
      this.pendingRequests.delete(cacheKey)
    }
  }

  private async executeRequestWithRetry(endpoint: string, options: RequestInit = {}, maxRetries: number = 3): Promise<any> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

        // Для первого запроса добавляем небольшую задержку чтобы дать серверу время
        if (attempt === 1 && endpoint !== '/test') {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const result = await this.executeRequest(endpoint, options)

        if (attempt > 1) {

        }

        return result
      } catch (error: any) {
        lastError = error

        console.warn(`⚠️ API Request attempt ${attempt}/${maxRetries} failed: ${endpoint}`, {
          error: error.message,
          willRetry: attempt < maxRetries
        })

        // Ретраим network errors и 429 Too Many Requests
        const shouldRetry = error.message.includes('Failed to fetch') || 
                          error.name === 'AbortError' || 
                          (error.status === 429)
        
        if (!shouldRetry) {
          throw error
        }

        if (attempt < maxRetries) {
          // Для 429 ошибок используем Retry-After заголовок, иначе экспоненциальную задержку
          let delay
          if (error.status === 429 && error.retryAfter) {
            delay = Math.min(error.retryAfter * 1000, 30000) // макс 30 сек
          } else {
            delay = Math.min(500 * Math.pow(2, attempt - 1), 2000) // 500ms, 1000ms, 2000ms
          }

          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    console.error(`💥 API Request failed after ${maxRetries} attempts: ${endpoint}`)
    throw lastError
  }

  private async executeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const startTime = Date.now()
    const fullUrl = `${this.baseUrl}${endpoint}`

    try {
      // Создаем AbortController для таймаута вручную для лучшей совместимости
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ Request timeout after 15s: ${fullUrl}`)
        controller.abort()
      }, 15000) // 15 секунд

      const fetchOptions: RequestInit = {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: options.signal || controller.signal,
        ...options,
      }

      // Добавляем mode только для браузера
      if (typeof window !== 'undefined') {
        fetchOptions.mode = 'same-origin'
        // Используем 'include' только для same-origin запросов к API
        if (fullUrl.startsWith(window.location.origin) || fullUrl.startsWith('/api')) {
          fetchOptions.credentials = 'include'
        } else {
          fetchOptions.credentials = 'same-origin'
        }
      }

      // Тестируем сначала простой запрос без всех опций для диагностики

      const response = await fetch(fullUrl, fetchOptions)

      clearTimeout(timeoutId) // Очищаем таймаут если запрос успешен


      const responseTime = Date.now() - startTime

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`🚨 HTTP Error ${response.status} (${responseTime}ms):`, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: fullUrl
        })
        
        // Создаем расширенную ошибку для 429 статуса
        const error = new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        ;(error as any).status = response.status
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          ;(error as any).retryAfter = retryAfter ? parseInt(retryAfter, 10) : null
        }
        
        throw error
      }

      const data = await response.json()

      // Логируем производительность
      if (responseTime > 1000) {
        console.warn(`⚠️ Slow API request: ${endpoint} took ${responseTime}ms`)
      } else {

      }

      return data
    } catch (error: any) {
      const responseTime = Date.now() - startTime

      // Еще более детальная диагностика ошибок
      console.error(`💥 API Request Failed (${responseTime}ms):`, {
        url: fullUrl,
        endpoint: endpoint,
        baseUrl: this.baseUrl,
        error: error.message,
        errorType: error.constructor.name,
        errorName: error.name,
        isAbortError: error.name === 'AbortError',
        isNetworkError: error.message.includes('Failed to fetch'),
        isTypeError: error instanceof TypeError,
        windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A',
        fetchAvailable: typeof fetch !== 'undefined',
        navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'N/A',
        stack: error.stack,
        // Добавляем информацию о браузере
        browserInfo: typeof window !== 'undefined' ? {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          port: window.location.port,
          origin: window.location.origin
        } : 'N/A'
      })

      // Пробуем fallback подход для диагностики
      if (error.message.includes('Failed to fetch') && typeof window !== 'undefined') {

        try {
          const _simpleFetch = await fetch(fullUrl)

        } catch (fallbackError: any) {
          console.error('❌ Fallback fetch also failed:', {
            error: fallbackError.message,
            type: fallbackError.constructor.name
          })
        }
      }

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: ${endpoint} took more than 15 seconds`)
      }

      throw error
    }
  }

  // Site Settings
  async getSiteSettings(options: { forceRefresh?: boolean } = {}) {
    const { forceRefresh = false } = options
    
    let endpoint = "/site-settings"
    if (forceRefresh) {
      endpoint += `?nocache=true&_t=${Date.now()}`
    }
    
    return this.request(endpoint, {}, {
      ttl: 10 * 60 * 1000, // кешируем на 10 минут
      key: 'site-settings',
      skipCache: forceRefresh
    })
  }

  async updateSiteSettings(settings: any) {
    try {
      // Try PUT first
      const result = await this.request("/site-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })

      // Очищаем кеш после обновления
      cacheUtils.delete('site-settings')

      return result
    } catch (_error) {

      // If PUT fails, try POST as fallback
      const result = await this.request("/site-settings", {
        method: "POST",
        body: JSON.stringify(settings),
      })

      // Очищаем кеш после обновления
      cacheUtils.delete('site-settings')

      return result
    }
  }

  // Categories
  async getCategories(options: { forceRefresh?: boolean } = {}) {
    const { forceRefresh = false } = options
    
    let endpoint = "/categories"
    if (forceRefresh) {
      // Добавляем cache-busting параметры для форсирования свежих данных
      endpoint += `?nocache=true&_t=${Date.now()}`
    }
    
    return this.request(endpoint, {}, {
      ttl: 5 * 60 * 1000, // кешируем на 5 минут
      key: 'categories',
      skipCache: forceRefresh // Пропускаем локальный кеш если нужны свежие данные
    })
  }

  async createCategory(category: any) {
    const result = await this.request("/categories", {
      method: "POST",
      body: JSON.stringify(category),
    })

    // Очищаем кеш категорий после создания
    cacheUtils.delete('categories')

    return result
  }

  async updateCategory(id: string, category: any) {
    const result = await this.request(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(category),
    })

    // Очищаем кеш категорий после обновления
    cacheUtils.delete('categories')

    return result
  }

  async deleteCategory(id: string) {
    const result = await this.request(`/categories/${id}`, {
      method: "DELETE",
    })

    // Очищаем кеш категорий после удаления
    cacheUtils.delete('categories')

    return result
  }

  // Features
  async getFeatures() {
    return this.request("/features")
  }

  async createFeature(feature: any) {
    return this.request("/features", {
      method: "POST",
      body: JSON.stringify(feature),
    })
  }

  async updateFeature(id: string, feature: any) {
    return this.request(`/features/${id}`, {
      method: "PUT",
      body: JSON.stringify(feature),
    })
  }

  async deleteFeature(id: string) {
    return this.request(`/features/${id}`, {
      method: "DELETE",
    })
  }

  // Products
  async getProducts(options: { fast?: boolean; limit?: number; detailed?: boolean; forceRefresh?: boolean } = {}) {
    const { fast = false, limit, detailed = false, forceRefresh = false } = options

    let endpoint = "/products"
    const params = new URLSearchParams()

    if (fast) params.append("fast", "true")
    if (limit) params.append("limit", limit.toString())
    if (detailed) params.append("detailed", "true")
    
    // Cache-busting параметры для форсированного обновления
    if (forceRefresh) {
      params.append("nocache", "true")
      params.append("_t", Date.now().toString())
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    return this.request(endpoint, {}, {
      ttl: fast ? 1 * 60 * 1000 : 3 * 60 * 1000, // fast: 1 мин, обычный: 3 мин
      key: `products-${fast ? 'fast' : 'full'}-${limit || 'all'}-${detailed ? 'detailed' : 'basic'}`,
      skipCache: forceRefresh // Пропускаем локальный кеш если нужны свежие данные
    })
  }

  async createProduct(product: any) {
    const result = await this.request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    })

    // Очищаем кеш продуктов после создания
    this.clearProductsCache()

    // Принудительно очищаем все кеши связанные с продуктами
    this.clearCache()


    return result
  }

  async updateProduct(id: string, product: any) {
    const result = await this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    })

    // Очищаем кеш продуктов после обновления
    this.clearProductsCache()

    return result
  }

  async deleteProduct(id: string) {
    try {
      const result = await this.request(`/products/${id}`, {
        method: "DELETE",
      })

      // Очищаем кеш продуктов после удаления
      this.clearProductsCache()

      // Принудительно очищаем все кеши связанные с продуктами
      this.clearCache()


      return result
    } catch (error) {
      console.error('❌ Error in deleteProduct:', error)

      // Если продукт уже удален, считаем это успехом
      if (error.message && error.message.includes('Product not found')) {

        return { success: true, message: 'Product was already deleted' }
      }

      throw error
    }
  }

  // Media
  async getMedia(options: { limit?: number; fast?: boolean; continuationToken?: string } = {}) {
    const { limit, fast = false, continuationToken } = options

    let endpoint = "/media"
    const params = new URLSearchParams()

    if (limit) params.append("limit", limit.toString())
    if (fast) params.append("fast", "true")
    if (continuationToken) params.append("continuationToken", continuationToken)

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    return this.request(endpoint, {}, {
      ttl: 2 * 60 * 1000, // кешируем на 2 минуты
      key: `media-${limit || 'all'}-${fast ? 'fast' : 'full'}-${continuationToken || 'first'}`
    })
  }

  // Utility methods
  private clearProductsCache() {
    // Удаляем все ключи кеша связанные с продуктами
    for (const key of clientApiCache.keys()) {
      if (key.includes('products')) {
        cacheUtils.delete(key)
      }
    }
  }

  // Принудительное обновление списка продуктов
  async refreshProducts() {
    try {
      const result = await this.request('/products/refresh', {
        method: 'POST',
      })

      // Очищаем локальный кэш
      this.clearProductsCache()
      this.clearCache()

      return result
    } catch (error) {
      console.error('❌ Error refreshing products:', error)
      throw error
    }
  }

  clearCache() {

    cacheUtils.clear()

  }

  getCacheStats() {
    return cacheUtils.getStats()
  }
}

// Экспортируем singleton instance
export const apiClient = ApiClient.getInstance()
