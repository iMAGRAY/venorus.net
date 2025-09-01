import { v4 as uuidv4 } from 'uuid'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { logger } from '@/lib/logger'

export interface CartItem {
  productId: number
  variantId?: number | null
  name: string
  price: number
  quantity: number
  imageUrl?: string
  sku?: string
}

export interface Cart {
  id: string
  items: CartItem[]
  createdAt: Date
  updatedAt: Date
  total: number
}

// Fallback хранилище в памяти для случаев когда unified cache недоступен
const memoryFallback = new Map<string, Cart>()

// Конфигурация
const CART_TTL = 7 * 24 * 60 * 60 * 1000 // 7 дней в миллисекундах
const CART_PREFIX = 'cart:'
const CACHE_TIMEOUT = 5000 // 5 секунд таймаут

// Утилиты для работы с кешом
function getCartKey(cartId: string): string {
  return `${CART_PREFIX}${cartId}`
}

// Сериализация/десериализация с валидацией
function serializeCart(cart: Cart): string {
  const now = new Date()
  
  // Валидация cart объекта
  if (!cart || typeof cart !== 'object') {
    throw new Error('Invalid cart object')
  }
  
  return JSON.stringify({
    ...cart,
    items: Array.isArray(cart.items) ? cart.items : [],
    createdAt: (cart.createdAt instanceof Date ? cart.createdAt : now).toISOString(),
    updatedAt: (cart.updatedAt instanceof Date ? cart.updatedAt : now).toISOString(),
    total: typeof cart.total === 'number' ? cart.total : 0
  })
}

function deserializeCart(data: string): Cart {
  try {
    const parsed = JSON.parse(data)
    
    // Валидация десериализованных данных
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid cart data structure')
    }
    
    return {
      id: parsed.id || uuidv4(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
      updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
      total: typeof parsed.total === 'number' ? parsed.total : 0
    }
  } catch (error) {
    logger.error('Failed to deserialize cart data', { data, error })
    throw new Error('Cart data deserialization failed')
  }
}

// Проверка доступности unified cache с таймаутом
async function isCacheAvailable(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Cache timeout')), CACHE_TIMEOUT)
    )
    
    await Promise.race([
      unifiedCache.get('cache_test_' + Date.now()),
      timeoutPromise
    ])
    
    return true
  } catch (error) {
    logger.warn('Unified cache unavailable, using memory fallback', { error: error.message })
    return false
  }
}

// Очистка старых корзин с улучшенной обработкой ошибок
export async function cleanupOldCarts(): Promise<{ cleaned: number; errors: number }> {
  let cleaned = 0
  let errors = 0
  
  try {
    const isCacheUp = await isCacheAvailable()
    
    if (isCacheUp) {
      // Unified cache автоматически удалит просроченные ключи через TTL
      logger.debug('Unified cache handles TTL cleanup automatically')
      return { cleaned: 0, errors: 0 }
    }
    
    // Очистка memory fallback с безопасной обработкой
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 часа
    
    for (const [id, cart] of Array.from(memoryFallback.entries())) {
      try {
        // Проверяем валидность даты создания
        const createdAt = cart.createdAt instanceof Date ? cart.createdAt : new Date(cart.createdAt)
        
        if (isNaN(createdAt.getTime()) || now - createdAt.getTime() > maxAge) {
          memoryFallback.delete(id)
          cleaned++
        }
      } catch (cartError) {
        logger.warn('Invalid cart data during cleanup', { cartId: id, error: cartError.message })
        memoryFallback.delete(id)
        errors++
      }
    }
    
    if (cleaned > 0 || errors > 0) {
      logger.info('Cart cleanup completed', { cleaned, errors, remaining: memoryFallback.size })
    }
  } catch (error) {
    logger.error('Critical error during cart cleanup', { error: error.message })
    errors++
  }
  
  return { cleaned, errors }
}

// Получение или создание корзины с полной обработкой ошибок
export async function getOrCreateCart(cartId?: string): Promise<Cart> {
  try {
    // Безопасная очистка старых корзин
    await cleanupOldCarts().catch(cleanupError => {
      logger.warn('Cleanup failed during getOrCreateCart', cleanupError)
    })
    
    const isCacheUp = await isCacheAvailable()
    
    // Попытка получить существующую корзину
    if (cartId) {
      if (isCacheUp) {
        try {
          const cartData = await unifiedCache.get(getCartKey(cartId))
          if (cartData && typeof cartData === 'string') {
            const cart = deserializeCart(cartData)
            // Дублируем в память для fallback
            memoryFallback.set(cartId, cart)
            return cart
          }
        } catch (cacheError) {
          logger.warn('Failed to get cart from unified cache', { cartId, error: cacheError.message })
        }
      }
      
      // Fallback к памяти
      if (memoryFallback.has(cartId)) {
        const cart = memoryFallback.get(cartId)!
        return cart
      }
    }
    
    // Создаем новую корзину
    const newCartId = cartId || uuidv4()
    const newCart: Cart = {
      id: newCartId,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      total: 0
    }
    
    // Сохраняем новую корзину
    await saveCart(newCart)
    return newCart
    
  } catch (error) {
    logger.error('Error in getOrCreateCart', { cartId, error: error.message })
    
    // Аварийное создание корзины только в памяти
    const emergencyCartId = cartId || uuidv4()
    const emergencyCart: Cart = {
      id: emergencyCartId,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      total: 0
    }
    
    memoryFallback.set(emergencyCartId, emergencyCart)
    return emergencyCart
  }
}

// Получение корзины по ID
export async function getCart(cartId: string): Promise<Cart | undefined> {
  if (!cartId || typeof cartId !== 'string') {
    logger.warn('Invalid cartId provided to getCart', { cartId })
    return undefined
  }
  
  try {
    const isCacheUp = await isCacheAvailable()
    
    if (isCacheUp) {
      try {
        const cartData = await unifiedCache.get(getCartKey(cartId))
        if (cartData && typeof cartData === 'string') {
          const cart = deserializeCart(cartData)
          // Обновляем memory fallback
          memoryFallback.set(cartId, cart)
          return cart
        }
      } catch (cacheError) {
        logger.warn('Failed to get cart from unified cache', { cartId, error: cacheError.message })
      }
    }
    
    // Fallback к памяти
    return memoryFallback.get(cartId)
    
  } catch (error) {
    logger.error('Error getting cart', { cartId, error: error.message })
    return memoryFallback.get(cartId)
  }
}

// Проверка существования корзины
export async function hasCart(cartId: string): Promise<boolean> {
  try {
    const cart = await getCart(cartId)
    return cart !== undefined
  } catch (error) {
    logger.error('Error checking cart existence', { cartId, error: error.message })
    return false
  }
}

// Сохранение корзины с retry логикой
export async function saveCart(cart: Cart): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []
  let cacheSuccess = false
  let memorySuccess = false
  
  try {
    // Валидация корзины
    if (!cart || !cart.id) {
      throw new Error('Invalid cart object or missing ID')
    }
    
    cart.updatedAt = new Date()
    const isCacheUp = await isCacheAvailable()
    
    // Попытка сохранить в unified cache
    if (isCacheUp) {
      try {
        const serialized = serializeCart(cart)
        await unifiedCache.set(getCartKey(cart.id), serialized, { ttl: CART_TTL })
        cacheSuccess = true
        logger.debug('Cart saved to unified cache', { cartId: cart.id })
      } catch (cacheError) {
        errors.push(`Cache save failed: ${cacheError.message}`)
        logger.warn('Failed to save cart to unified cache', { cartId: cart.id, error: cacheError.message })
      }
    } else {
      errors.push('Unified cache unavailable')
    }
    
    // Всегда сохраняем в память как fallback
    try {
      memoryFallback.set(cart.id, { ...cart })
      memorySuccess = true
      logger.debug('Cart saved to memory fallback', { cartId: cart.id })
    } catch (memoryError) {
      errors.push(`Memory save failed: ${memoryError.message}`)
      logger.error('Failed to save cart to memory fallback', { cartId: cart.id, error: memoryError.message })
    }
    
    const success = cacheSuccess || memorySuccess
    if (!success) {
      logger.error('Complete cart save failure', { cartId: cart.id, errors })
    }
    
    return { success, errors }
    
  } catch (error) {
    const errorMsg = `Critical save error: ${error.message}`
    errors.push(errorMsg)
    logger.error('Critical error saving cart', { cartId: cart.id, error: error.message })
    
    // Последняя попытка сохранить хотя бы в память
    try {
      memoryFallback.set(cart.id, { ...cart })
      return { success: true, errors }
    } catch (finalError) {
      errors.push(`Final memory save failed: ${finalError.message}`)
      return { success: false, errors }
    }
  }
}

// Удаление корзины
export async function deleteCart(cartId: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []
  let cacheDeleted = false
  let memoryDeleted = false
  
  try {
    const isCacheUp = await isCacheAvailable()
    
    if (isCacheUp) {
      try {
        await unifiedCache.delete(getCartKey(cartId))
        cacheDeleted = true
        logger.debug('Cart deleted from unified cache', { cartId })
      } catch (cacheError) {
        errors.push(`Cache delete failed: ${cacheError.message}`)
        logger.warn('Failed to delete cart from unified cache', { cartId, error: cacheError.message })
      }
    }
    
    // Удаляем из памяти
    memoryDeleted = memoryFallback.delete(cartId)
    
    const success = cacheDeleted || memoryDeleted
    logger.info('Cart deletion completed', { cartId, cacheDeleted, memoryDeleted, success })
    
    return { success, errors }
    
  } catch (error) {
    errors.push(`Delete error: ${error.message}`)
    logger.error('Error deleting cart', { cartId, error: error.message })
    
    // Попытка удалить хотя бы из памяти
    const memoryDeleted = memoryFallback.delete(cartId)
    return { success: memoryDeleted, errors }
  }
}

// Пересчет итоговой суммы
export function recalculateTotal(cart: Cart): void {
  if (!cart || typeof cart !== 'object') {
    logger.warn('Invalid cart object for recalculation')
    return
  }
  
  // Убеждаемся что items массив
  if (!Array.isArray(cart.items)) {
    cart.items = []
  }
  
  cart.total = cart.items.reduce((sum, item) => {
    const price = typeof item.price === 'number' ? item.price : 0
    const quantity = typeof item.quantity === 'number' ? item.quantity : 0
    return sum + (price * quantity)
  }, 0)
  
  cart.updatedAt = new Date()
}

// Добавление товара в корзину
export async function addItemToCart(cart: Cart, item: CartItem): Promise<{ success: boolean; errors: string[] }> {
  try {
    // Валидация входных данных
    if (!cart || !item || typeof item.productId !== 'number') {
      throw new Error('Invalid cart or item data')
    }
    
    // Убеждаемся что items массив
    if (!Array.isArray(cart.items)) {
      cart.items = []
    }
    
    // Проверяем, есть ли уже этот товар в корзине
    const existingItem = cart.items.find(existing => 
      existing.productId === item.productId && existing.variantId === item.variantId
    )
    
    if (existingItem) {
      // Увеличиваем количество
      existingItem.quantity += (item.quantity || 1)
    } else {
      // Добавляем новый товар
      cart.items.push({ ...item })
    }
    
    recalculateTotal(cart)
    const saveResult = await saveCart(cart)
    
    logger.info('Item added to cart', { cartId: cart.id, productId: item.productId, success: saveResult.success })
    return saveResult
    
  } catch (error) {
    const errorMsg = `Failed to add item to cart: ${error.message}`
    logger.error(errorMsg, { cartId: cart.id, item })
    return { success: false, errors: [errorMsg] }
  }
}

// Обновление количества товара в корзине
export async function updateCartItemQuantity(
  cart: Cart, 
  productId: number, 
  variantId: number | null, 
  quantity: number
): Promise<{ success: boolean; found: boolean; errors: string[] }> {
  try {
    const item = cart.items.find(item => 
      item.productId === productId && item.variantId === variantId
    )
    
    if (!item) {
      return { success: false, found: false, errors: ['Item not found in cart'] }
    }
    
    if (quantity <= 0) {
      // Удаляем товар из корзины
      cart.items = cart.items.filter(item => 
        !(item.productId === productId && item.variantId === variantId)
      )
    } else {
      // Обновляем количество
      item.quantity = quantity
    }
    
    recalculateTotal(cart)
    const saveResult = await saveCart(cart)
    
    return { ...saveResult, found: true }
    
  } catch (error) {
    const errorMsg = `Failed to update cart item quantity: ${error.message}`
    logger.error(errorMsg, { cartId: cart.id, productId, variantId, quantity })
    return { success: false, found: false, errors: [errorMsg] }
  }
}

// Удаление товара из корзины
export async function removeCartItem(
  cart: Cart, 
  productId: number, 
  variantId?: number | null
): Promise<{ success: boolean; removed: boolean; errors: string[] }> {
  try {
    const initialLength = cart.items.length
    
    cart.items = cart.items.filter(item => 
      !(item.productId === productId && 
        (variantId === undefined || item.variantId === variantId))
    )
    
    const removed = cart.items.length !== initialLength
    
    if (removed) {
      recalculateTotal(cart)
      const saveResult = await saveCart(cart)
      return { ...saveResult, removed: true }
    }
    
    return { success: true, removed: false, errors: [] }
    
  } catch (error) {
    const errorMsg = `Failed to remove cart item: ${error.message}`
    logger.error(errorMsg, { cartId: cart.id, productId, variantId })
    return { success: false, removed: false, errors: [errorMsg] }
  }
}

// Очистка корзины
export async function clearCart(cart: Cart): Promise<{ success: boolean; errors: string[] }> {
  try {
    cart.items = []
    recalculateTotal(cart)
    const saveResult = await saveCart(cart)
    
    logger.info('Cart cleared', { cartId: cart.id, success: saveResult.success })
    return saveResult
    
  } catch (error) {
    const errorMsg = `Failed to clear cart: ${error.message}`
    logger.error(errorMsg, { cartId: cart.id })
    return { success: false, errors: [errorMsg] }
  }
}

// Получение статистики корзины
export function getCartStats(cart: Cart): { itemCount: number; total: number; valid: boolean } {
  try {
    // Убеждаемся что cart и items валидны
    const items = Array.isArray(cart?.items) ? cart.items : []
    
    return {
      itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
      total: typeof cart?.total === 'number' ? cart.total : 0,
      valid: true
    }
  } catch (error) {
    logger.warn('Error calculating cart stats', { cartId: cart?.id, error: error.message })
    return {
      itemCount: 0,
      total: 0,
      valid: false
    }
  }
}

// Получение всех корзин для администрирования (оптимизированная версия)
export async function getAllCarts(): Promise<Cart[]> {
  try {
    const isCacheUp = await isCacheAvailable()
    const carts: Cart[] = []
    const seenIds = new Set<string>()
    
    if (isCacheUp) {
      try {
        // Получаем ключи корзин из unified cache
        const keys = await unifiedCache.getKeysByPattern(`${CART_PREFIX}*`)
        
        for (const key of keys) {
          try {
            const cartData = await unifiedCache.get(key)
            if (cartData && typeof cartData === 'string') {
              const cart = deserializeCart(cartData)
              if (cart.id && !seenIds.has(cart.id)) {
                carts.push(cart)
                seenIds.add(cart.id)
              }
            }
          } catch (cartError) {
            logger.warn('Failed to deserialize cart from cache', { key, error: cartError.message })
          }
        }
      } catch (cacheError) {
        logger.warn('Failed to get carts from unified cache', { error: cacheError.message })
      }
    }
    
    // Добавляем корзины из памяти (если есть уникальные)
    for (const cart of memoryFallback.values()) {
      if (cart.id && !seenIds.has(cart.id)) {
        carts.push(cart)
        seenIds.add(cart.id)
      }
    }
    
    logger.debug('Retrieved all carts', { count: carts.length, cacheAvailable: isCacheUp })
    return carts
    
  } catch (error) {
    logger.error('Error getting all carts', { error: error.message })
    return Array.from(memoryFallback.values())
  }
}

// Статистика хранилища корзин
export async function getCartStorageStats(): Promise<{
  cacheAvailable: boolean
  cacheCartCount: number
  memoryCartCount: number
  totalCarts: number
  errors: string[]
}> {
  const errors: string[] = []
  
  try {
    const isCacheUp = await isCacheAvailable()
    let cacheCartCount = 0
    
    if (isCacheUp) {
      try {
        const keys = await unifiedCache.getKeysByPattern(`${CART_PREFIX}*`)
        cacheCartCount = keys.length
      } catch (cacheError) {
        errors.push(`Failed to count cache carts: ${cacheError.message}`)
      }
    }
    
    const memoryCartCount = memoryFallback.size
    
    return {
      cacheAvailable: isCacheUp,
      cacheCartCount,
      memoryCartCount,
      totalCarts: Math.max(cacheCartCount, memoryCartCount), // Учитываем дублирование
      errors
    }
    
  } catch (error) {
    errors.push(`Stats error: ${error.message}`)
    logger.error('Error getting cart storage stats', { error: error.message })
    
    return {
      cacheAvailable: false,
      cacheCartCount: 0,
      memoryCartCount: memoryFallback.size,
      totalCarts: memoryFallback.size,
      errors
    }
  }
}