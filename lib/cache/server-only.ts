// Серверный кеш только для API routes
// НЕ ИМПОРТИРОВАТЬ В КЛИЕНТСКОМ КОДЕ!

export const getServerCache = async () => {
  if (typeof window !== 'undefined') {
    throw new Error('ServerCache should not be used on client side')
  }
  const { UnifiedCacheManager, unifiedCache } = await import('./unified-cache')
  return { UnifiedCacheManager, serverCache: unifiedCache }
}