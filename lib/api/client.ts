'use client'

import { 
  ApiResponse, 
  ApiClientConfig, 
  ApiMetrics, 
  ApiError, 
  NetworkError, 
  TimeoutError,
  RequestOptions,
  PendingRequest,
  RetryConfig
} from './types'

/**
 * Unified API Client с кешированием, метриками и дедупликацией
 */
export class ApiClient {
  private config: ApiClientConfig
  private metrics: ApiMetrics
  private pendingRequests = new Map<string, PendingRequest>()
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      defaultHeaders: {
        'Content-Type': 'application/json',
        ...config.defaultHeaders
      },
      enableCache: true,
      defaultCacheTTL: 5 * 60 * 1000, // 5 минут
      enableMetrics: true,
      enableDebug: false,
      ...config
    }

    this.metrics = {
      requests: { total: 0, success: 0, failed: 0, cached: 0 },
      timing: { average: 0, min: Infinity, max: 0 },
      errors: {},
      endpoints: {}
    }
  }

  /**
   * Выполнить HTTP запрос с полной обработкой ошибок
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now()
    const url = this.buildUrl(endpoint)
    const method = options.method || 'GET'
    const cacheKey = this.getCacheKey(method, url, options.body)

    this.updateMetrics('total')
    this.updateEndpointMetrics(endpoint, 'request')

    try {
      // Проверяем кеш для GET запросов
      if (method === 'GET' && this.config.enableCache && options.cache !== false) {
        const cached = this.getFromCache<ApiResponse<T>>(cacheKey)
        if (cached) {
          this.updateMetrics('cached')
          return cached
        }
      }

      // Дедупликация одинаковых запросов
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey)!.promise
      }

      // Создаем контроллер отмены
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), this.config.timeout)

      // Выполняем запрос с retry логикой
      const pendingRequest: PendingRequest<ApiResponse<T>> = {
        promise: this.executeWithRetry<T>(url, options, abortController.signal),
        timestamp: Date.now(),
        abortController
      }
      
      this.pendingRequests.set(cacheKey, pendingRequest)

      try {
        const result = await pendingRequest.promise
        
        // Сохраняем в кеш успешные GET запросы
        if (method === 'GET' && result.success && this.config.enableCache) {
          const ttl = options.cacheTTL || this.config.defaultCacheTTL
          this.setCache(cacheKey, result, ttl)
        }

        this.updateMetrics('success')
        this.updateTiming(Date.now() - startTime)
        
        return result
      } finally {
        clearTimeout(timeoutId)
        this.pendingRequests.delete(cacheKey)
      }

    } catch (error) {
      this.updateMetrics('failed')
      this.updateEndpointMetrics(endpoint, 'failure')
      
      const apiError = this.normalizeError(error, endpoint)
      this.trackError(apiError)
      
      if (this.config.enableDebug) {
        console.error('[API Client]', apiError)
      }
      
      throw apiError
    }
  }

  /**
   * Выполнение запроса с retry логикой
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestOptions,
    signal: AbortSignal
  ): Promise<ApiResponse<T>> {
    const retryConfig: RetryConfig = {
      maxRetries: options.retries ?? this.config.maxRetries,
      baseDelay: this.config.retryDelay,
      maxDelay: 30000,
      backoffFactor: 2,
      retryCondition: (error) => {
        if (error instanceof NetworkError) return true
        if (error instanceof ApiError) {
          return error.status >= 500 || error.status === 429
        }
        return false
      }
    }

    let lastError: Error
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        if (signal.aborted) {
          throw new TimeoutError('Request timeout', url)
        }

        const response = await fetch(url, {
          method: options.method || 'GET',
          headers: { ...this.config.defaultHeaders, ...options.headers },
          body: options.body ? JSON.stringify(options.body) : undefined,
          credentials: 'include',
          signal
        })

        if (!response.ok) {
          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            url,
            await this.safeResponseJson(response)
          )
        }

        const data = await response.json()
        return data as ApiResponse<T>

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Не retry если это последняя попытка или ошибка не подходит для retry
        if (attempt === retryConfig.maxRetries || !retryConfig.retryCondition(lastError)) {
          break
        }

        // Exponential backoff delay
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt),
          retryConfig.maxDelay
        )
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  /**
   * Convenience методы для HTTP операций
   */
  async get<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body: data })
  }

  async put<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body: data })
  }

  async patch<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body: data })
  }

  async delete<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  /**
   * Управление кешем
   */
  invalidateCache(pattern?: string) {
    if (!pattern) {
      this.cache.clear()
      return
    }

    const keys = Array.from(this.cache.keys())
    const regex = new RegExp(pattern)
    
    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })
  }

  clearCache() {
    this.cache.clear()
  }

  /**
   * Отмена всех pending запросов
   */
  cancelAllRequests(_reason = 'Cancelled by user') {
    this.pendingRequests.forEach(request => {
      request.abortController.abort()
    })
    this.pendingRequests.clear()
  }

  /**
   * Получение метрик
   */
  getMetrics(): ApiMetrics {
    return { ...this.metrics }
  }

  resetMetrics() {
    this.metrics = {
      requests: { total: 0, success: 0, failed: 0, cached: 0 },
      timing: { average: 0, min: Infinity, max: 0 },
      errors: {},
      endpoints: {}
    }
  }

  /**
   * Внутренние методы
   */
  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) return endpoint
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl.slice(0, -1) : this.config.baseUrl
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  private getCacheKey(method: string, url: string, body?: any): string {
    const bodyHash = body ? JSON.stringify(body) : ''
    return `${method}:${url}:${bodyHash}`
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  private setCache(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  private normalizeError(error: any, endpoint: string): Error {
    if (error instanceof ApiError || error instanceof NetworkError || error instanceof TimeoutError) {
      return error
    }

    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      return new TimeoutError('Request timeout', endpoint)
    }

    if (error.name === 'TypeError' || error.message?.includes('fetch')) {
      return new NetworkError('Network error', endpoint)
    }

    return new ApiError(error.message || 'Unknown error', 0, endpoint)
  }

  private async safeResponseJson(response: Response) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  private updateMetrics(type: keyof ApiMetrics['requests']) {
    this.metrics.requests[type]++
  }

  private updateEndpointMetrics(endpoint: string, type: 'request' | 'failure') {
    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        requests: 0,
        failures: 0,
        averageTime: 0
      }
    }

    if (type === 'request') {
      this.metrics.endpoints[endpoint].requests++
    } else {
      this.metrics.endpoints[endpoint].failures++
    }
  }

  private updateTiming(duration: number) {
    const timing = this.metrics.timing
    timing.min = Math.min(timing.min, duration)
    timing.max = Math.max(timing.max, duration)
    
    // Обновляем среднее время
    const total = this.metrics.requests.success + this.metrics.requests.failed
    timing.average = ((timing.average * (total - 1)) + duration) / total
  }

  private trackError(error: Error) {
    const errorType = error.constructor.name
    this.metrics.errors[errorType] = (this.metrics.errors[errorType] || 0) + 1
  }
}

// Singleton instance для глобального использования
export const apiClient = new ApiClient()

// Export для тестирования
export { ApiClient as ApiClientClass }