'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CacheOptions } from './types'

// Асинхронное получение кеша для избежания импорта Redis в клиенте
async function getCache() {
  if (typeof window === 'undefined') {
    // На сервере используем серверный кеш из отдельного файла
    const { getServerCache } = await import('./server-only')
    return await getServerCache()
  } else {
    // На клиенте используем клиентский кеш
    const { getClientCache } = await import('./client-only')
    return await getClientCache()
  }
}

/**
 * Хук для кеширования данных с автоматической инвалидацией
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & { enabled?: boolean } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { enabled = true, ...cacheOptions } = options
  
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const cache = await getCache()
      
      // Пытаемся получить из кеша
      const cached = await cache.serverCache.get<T>(key)
      if (cached !== null) {
        setData(cached)
        setLoading(false)
        return cached
      }

      // Если нет в кеше, загружаем
      const result = await fetcherRef.current()
      setData(result)

      // Сохраняем в кеш
      await cache.serverCache.set(key, result, cacheOptions)
      
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [key, enabled, cacheOptions])

  const invalidate = useCallback(async () => {
    const cache = await getCache()
    await cache.serverCache.delete(key)
    await fetchData()
  }, [key, fetchData])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const cache = await getCache()
      const result = await fetcherRef.current()
      setData(result)
      await cache.serverCache.set(key, result, cacheOptions)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [key, cacheOptions])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidate,
    refresh
  }
}

/**
 * Хук для инвалидации кеша по тегам
 */
export function useCacheInvalidation() {
  const invalidateByTags = useCallback(async (tags: string[]) => {
    const cache = await getCache()
    return cache.serverCache.invalidateByTags(tags)
  }, [])

  const invalidateProducts = useCallback(async () => {
    const cache = await getCache()
    return cache.serverCache.invalidateByTags(['products'])
  }, [])

  const invalidateCategories = useCallback(async () => {
    const cache = await getCache()
    return cache.serverCache.invalidateByTags(['categories'])
  }, [])

  const invalidateAll = useCallback(async () => {
    const cache = await getCache()
    return cache.serverCache.clear()
  }, [])

  return {
    invalidateByTags,
    invalidateProducts,
    invalidateCategories,
    invalidateAll
  }
}

/**
 * Хук для статистики кеша (для админки)
 */
export function useCacheStats() {
  const [stats, setStats] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)

  const refresh = useCallback(async () => {
    try {
      const cache = await getCache()
      if ('getStats' in cache.serverCache) {
        setStats((cache.serverCache as any).getStats())
      }
      if ('getMetrics' in cache.serverCache) {
        setMetrics((cache.serverCache as any).getMetrics())
      }
    } catch (error) {
      console.warn('Cache stats not available:', error)
    }
  }, [])

  useEffect(() => {
    refresh()
    
    // Обновляем статистику каждые 10 секунд
    const interval = setInterval(() => {
      refresh().catch(console.warn)
    }, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  return {
    stats,
    metrics,
    refresh
  }
}

/**
 * Хук для мутаций с автоматической инвалидацией кеша
 */
export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    invalidateTags?: string[]
    onSuccess?: (data: TData, variables: TVariables) => void
    onError?: (error: Error, variables: TVariables) => void
  } = {}
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(async (variables: TVariables) => {
    setLoading(true)
    setError(null)

    try {
      const result = await mutationFn(variables)
      
      // Инвалидируем кеш по тегам
      if (options.invalidateTags) {
        const cache = await getCache()
        await cache.serverCache.invalidateByTags(options.invalidateTags)
      }

      options.onSuccess?.(result, variables)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      options.onError?.(error, variables)
      throw error
    } finally {
      setLoading(false)
    }
  }, [mutationFn, options])

  return {
    mutate,
    loading,
    error
  }
}