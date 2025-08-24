'use client'
import { clientCache } from './client-cache'

// Клиентская версия кеш системы
export async function getClientCache() {
  // Проверяем, что мы действительно на клиенте
  if (typeof window === 'undefined') {
    throw new Error('ClientCache should not be used on server side')
  }
  
  return {
    serverCache: clientCache
  }
}