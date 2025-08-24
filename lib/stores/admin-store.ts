'use client'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { AdminStore, Product, Category, SiteSettings } from './types'
import type { Prosthetic } from '@/lib/data'
import { CACHE_TAGS } from '../cache/types'
import { logger } from '../logger'
import { ApiClient } from '../api-client'

// Кеш для мемоизации адаптированных продуктов
let adaptedProductsCache: {
  products: Product[]
  categories: Category[]
  result: Prosthetic[]
} | null = null

// Константы для кеш ключей
const CACHE_KEYS = {
  PRODUCTS: 'admin:products',
  CATEGORIES: 'admin:categories', 
  SETTINGS: 'admin:settings'
} as const

// Асинхронное получение кеша для избежания импорта Redis в клиенте
async function getCache() {
  if (typeof window === 'undefined') {
    // На сервере используем серверный кеш из отдельного файла
    const { getServerCache } = await import('../cache/server-only')
    const { serverCache } = await getServerCache()
    return serverCache
  } else {
    // На клиенте используем клиентскую версию
    const { unifiedCache } = await import('../cache')
    return unifiedCache
  }
}

// Единый API клиент с кешированием и retry логикой  
const apiClient = ApiClient.getInstance()

// API методы используют единый клиент
const adminApi = {
  async fetchProducts(): Promise<Product[]> {
    const result = await apiClient.getProducts({ detailed: true })
    return result.success ? result.data : []
  },

  async fetchCategories(): Promise<Category[]> {
    const result = await apiClient.getCategories()
    return result.success ? result.data : []
  },

  async fetchSettings(): Promise<SiteSettings> {
    const result = await apiClient.getSiteSettings()
    return result.success ? result.data : result
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  },

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  },

  async deleteProduct(id: number): Promise<void> {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  },

  async createCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  },

  async updateCategory(id: number, updates: Partial<Category>): Promise<Category> {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  },

  async deleteCategory(id: number): Promise<void> {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  },

  async updateSettings(settings: Partial<SiteSettings>): Promise<void> {
    const response = await fetch('/api/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  }
}

// Начальное состояние
const initialState = {
  // Данные
  products: [],
  categories: [],
  settings: {
    id: 0,
    siteName: '',
    updatedAt: ''
  } as SiteSettings,
  
  // Состояние загрузки
  loading: {
    products: false,
    categories: false,
    settings: false
  },
  
  // Ошибки
  errors: {
    products: null,
    categories: null,
    settings: null
  },
  
  // Время последнего обновления
  lastFetch: {
    products: null,
    categories: null,
    settings: null
  },
  
  // Флаги инициализации
  initialized: {
    products: false,
    categories: false,
    settings: false
  }
}

// Адаптер для преобразования Product[] в Prosthetic[] для обратной совместимости
function adaptProductsToProsthetics(products: Product[], categories: Category[]): Prosthetic[] {
  const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]))
  
  return products.map(product => ({
    id: product.id,
    name: product.name,
    category: typeof product.category_id === 'number' ? categoryMap.get(product.category_id) : undefined,
    category_name: typeof product.category_id === 'number' ? categoryMap.get(product.category_id) : undefined,
    manufacturer: product.manufacturer_name,
    manufacturer_name: product.manufacturer_name,
    price: product.price,
    discount_price: product.discount_price,
    imageUrl: product.main_image_url,
    image_url: product.main_image_url,
    images: product.image_urls,
    inStock: product.stock_quantity > 0,
    stock_quantity: product.stock_quantity,
    sku: product.sku,
    description: product.description,
    category_id: product.category_id
  } as Prosthetic))
}

export const useAdminStore = create<AdminStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // === ИНИЦИАЛИЗАЦИЯ ===
      
      initializeProducts: async () => {
        if (get().initialized.products && get().products.length > 0) {
          return // Уже инициализирован
        }

        set((state) => {
          state.loading.products = true
          state.errors.products = null
        })

        try {
          // Пытаемся получить из кеша
          const cache = await getCache()
          let products = await cache.get<Product[]>(CACHE_KEYS.PRODUCTS)
          
          if (!products) {
            // Загружаем с сервера
            products = await adminApi.fetchProducts()
            
            // Сохраняем в кеш
            await cache.set(CACHE_KEYS.PRODUCTS, products, {
              ttl: 5 * 60 * 1000, // 5 минут
              tags: [CACHE_TAGS.PRODUCTS]
            })
          }

          set((state) => {
            state.products = products!
            state.loading.products = false
            state.initialized.products = true
            state.lastFetch.products = Date.now()
          })
          
          adaptedProductsCache = null // Сброс кеша при обновлении продуктов

          logger.info('Products initialized', { count: products.length })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.products = false
            state.errors.products = message
          })
          logger.error('Failed to initialize products:', error)
          throw error
        }
      },

      initializeCategories: async () => {
        if (get().initialized.categories && get().categories.length > 0) {
          return
        }

        set((state) => {
          state.loading.categories = true
          state.errors.categories = null
        })

        try {
          const cache = await getCache()
          let categories = await cache.get<Category[]>(CACHE_KEYS.CATEGORIES)
          
          if (!categories) {
            categories = await adminApi.fetchCategories()
            
            await cache.set(CACHE_KEYS.CATEGORIES, categories, {
              ttl: 10 * 60 * 1000, // 10 минут (категории меняются реже)
              tags: [CACHE_TAGS.CATEGORIES]
            })
          }

          set((state) => {
            state.categories = categories!
            state.loading.categories = false
            state.initialized.categories = true
            state.lastFetch.categories = Date.now()
          })
          
          adaptedProductsCache = null // Сброс кеша при обновлении категорий

          logger.info('Categories initialized', { count: categories.length })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.categories = false
            state.errors.categories = message
          })
          logger.error('Failed to initialize categories:', error)
          throw error
        }
      },

      initializeSettings: async () => {
        if (get().initialized.settings) {
          return
        }

        set((state) => {
          state.loading.settings = true
          state.errors.settings = null
        })

        try {
          const cache = await getCache()
          let settings = await cache.get<SiteSettings>(CACHE_KEYS.SETTINGS)
          
          if (!settings) {
            settings = await adminApi.fetchSettings()
            
            await cache.set(CACHE_KEYS.SETTINGS, settings, {
              ttl: 15 * 60 * 1000, // 15 минут
              tags: [CACHE_TAGS.SETTINGS]
            })
          }

          set((state) => {
            state.settings = settings!
            state.loading.settings = false
            state.initialized.settings = true
            state.lastFetch.settings = Date.now()
          })

          logger.info('Settings initialized')
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.settings = false
            state.errors.settings = message
          })
          logger.error('Failed to initialize settings:', error)
          throw error
        }
      },

      initializeAll: async () => {
        await Promise.allSettled([
          get().initializeProducts(),
          get().initializeCategories(),
          get().initializeSettings()
        ])
      },

      // === ОБНОВЛЕНИЕ ДАННЫХ ===

      refreshProducts: async () => {
        set((state) => {
          state.loading.products = true
          state.errors.products = null
        })

        try {
          const products = await adminApi.fetchProducts()
          const cache = await getCache()
          
          await cache.set(CACHE_KEYS.PRODUCTS, products, {
            ttl: 5 * 60 * 1000,
            tags: [CACHE_TAGS.PRODUCTS]
          })

          set((state) => {
            state.products = products
            state.loading.products = false
            state.lastFetch.products = Date.now()
          })

          logger.info('Products refreshed', { count: products.length })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.products = false
            state.errors.products = message
          })
          throw error
        }
      },

      refreshCategories: async () => {
        set((state) => {
          state.loading.categories = true
          state.errors.categories = null
        })

        try {
          const categories = await adminApi.fetchCategories()
          const cache = await getCache()
          
          await cache.set(CACHE_KEYS.CATEGORIES, categories, {
            ttl: 10 * 60 * 1000,
            tags: [CACHE_TAGS.CATEGORIES]
          })

          set((state) => {
            state.categories = categories
            state.loading.categories = false
            state.lastFetch.categories = Date.now()
          })

          logger.info('Categories refreshed', { count: categories.length })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.categories = false
            state.errors.categories = message
          })
          throw error
        }
      },

      refreshSettings: async () => {
        set((state) => {
          state.loading.settings = true
          state.errors.settings = null
        })

        try {
          const settings = await adminApi.fetchSettings()
          const cache = await getCache()
          
          await cache.set(CACHE_KEYS.SETTINGS, settings, {
            ttl: 15 * 60 * 1000,
            tags: [CACHE_TAGS.SETTINGS]
          })

          set((state) => {
            state.settings = settings
            state.loading.settings = false
            state.lastFetch.settings = Date.now()
          })

          logger.info('Settings refreshed')
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          set((state) => {
            state.loading.settings = false
            state.errors.settings = message
          })
          throw error
        }
      },

      refreshAll: async () => {
        await Promise.allSettled([
          get().refreshProducts(),
          get().refreshCategories(),
          get().refreshSettings()
        ])
      },

      // === CRUD ПРОДУКТЫ ===

      createProduct: async (productData) => {
        set((state) => {
          state.loading.products = true
        })

        try {
          const newProduct = await adminApi.createProduct(productData)
          
          set((state) => {
            state.products.push(newProduct)
            state.loading.products = false
          })

          // Инвалидируем кеш продуктов
          const cache = await getCache()
          await cache.invalidateByTags([CACHE_TAGS.PRODUCTS])

          logger.info('Product created', { id: newProduct.id, name: newProduct.name })
          return newProduct
        } catch (error) {
          set((state) => {
            state.loading.products = false
          })
          throw error
        }
      },

      updateProduct: async (id, updates) => {
        set((state) => {
          state.loading.products = true
        })

        try {
          const updatedProduct = await adminApi.updateProduct(id, updates)
          
          set((state) => {
            const index = state.products.findIndex(p => p.id === id)
            if (index !== -1) {
              state.products[index] = updatedProduct
            }
            state.loading.products = false
          })

          // Инвалидируем кеш продуктов и конкретного продукта
          const cache = await getCache()
          await cache.invalidateByTags([
            CACHE_TAGS.PRODUCTS,
            CACHE_TAGS.PRODUCT(id.toString())
          ])

          logger.info('Product updated', { id, updates: Object.keys(updates) })
          return updatedProduct
        } catch (error) {
          set((state) => {
            state.loading.products = false
          })
          throw error
        }
      },

      deleteProduct: async (id) => {
        set((state) => {
          state.loading.products = true
        })

        try {
          await adminApi.deleteProduct(id)
          
          set((state) => {
            state.products = state.products.filter(p => p.id !== id)
            state.loading.products = false
          })

          // Инвалидируем кеш
          const cache = await getCache()
          await cache.invalidateByTags([
            CACHE_TAGS.PRODUCTS,
            CACHE_TAGS.PRODUCT(id.toString())
          ])

          logger.info('Product deleted', { id })
        } catch (error) {
          set((state) => {
            state.loading.products = false
          })
          throw error
        }
      },

      // === CRUD КАТЕГОРИИ ===

      createCategory: async (categoryData) => {
        set((state) => {
          state.loading.categories = true
        })

        try {
          const newCategory = await adminApi.createCategory(categoryData)
          
          set((state) => {
            state.categories.push(newCategory)
            state.loading.categories = false
          })

          const cache = await getCache()
          await cache.invalidateByTags([CACHE_TAGS.CATEGORIES])

          logger.info('Category created', { id: newCategory.id, name: newCategory.name })
          return newCategory
        } catch (error) {
          set((state) => {
            state.loading.categories = false
          })
          throw error
        }
      },

      updateCategory: async (id, updates) => {
        set((state) => {
          state.loading.categories = true
        })

        try {
          const updatedCategory = await adminApi.updateCategory(id, updates)
          
          set((state) => {
            const index = state.categories.findIndex(c => c.id === id)
            if (index !== -1) {
              state.categories[index] = updatedCategory
            }
            state.loading.categories = false
          })

          const cache = await getCache()
          await cache.invalidateByTags([
            CACHE_TAGS.CATEGORIES,
            CACHE_TAGS.CATEGORY(id.toString())
          ])

          logger.info('Category updated', { id, updates: Object.keys(updates) })
          return updatedCategory
        } catch (error) {
          set((state) => {
            state.loading.categories = false
          })
          throw error
        }
      },

      deleteCategory: async (id) => {
        set((state) => {
          state.loading.categories = true
        })

        try {
          await adminApi.deleteCategory(id)
          
          set((state) => {
            state.categories = state.categories.filter(c => c.id !== id)
            state.loading.categories = false
          })

          const cache = await getCache()
          await cache.invalidateByTags([
            CACHE_TAGS.CATEGORIES,
            CACHE_TAGS.CATEGORY(id.toString())
          ])

          logger.info('Category deleted', { id })
        } catch (error) {
          set((state) => {
            state.loading.categories = false
          })
          throw error
        }
      },

      // === НАСТРОЙКИ ===

      updateSettings: async (newSettings) => {
        set((state) => {
          state.loading.settings = true
        })

        try {
          await adminApi.updateSettings(newSettings)
          
          set((state) => {
            Object.assign(state.settings, newSettings)
            state.loading.settings = false
          })

          const cache = await getCache()
          await cache.invalidateByTags([CACHE_TAGS.SETTINGS])

          logger.info('Settings updated', { keys: Object.keys(newSettings) })
        } catch (error) {
          set((state) => {
            state.loading.settings = false
          })
          throw error
        }
      },

      // === СЕЛЕКТОРЫ ===

      getProduct: (id) => {
        return get().products.find(p => p.id === id)
      },

      getProductsByCategory: (categoryId) => {
        return get().products.filter((p: any) => p.category_id === categoryId)
      },

      getProductsByManufacturer: (manufacturerId) => {
        return get().products.filter((p: any) => p.manufacturer_id === manufacturerId)
      },

      searchProducts: (query) => {
        const lowerQuery = query.toLowerCase()
        return get().products.filter((p: any) => 
          p.name.toLowerCase().includes(lowerQuery) ||
          p.sku?.toLowerCase().includes(lowerQuery) ||
          p.category_name?.toLowerCase().includes(lowerQuery) ||
          p.manufacturer_name?.toLowerCase().includes(lowerQuery)
        )
      },

      getCategory: (id) => {
        return get().categories.find(c => c.id === id)
      },

      getRootCategories: () => {
        return get().categories.filter((c: Category) => c.parent_id === null)
      },

      getCategoryChildren: (id) => {
        return get().categories.filter((c: Category) => c.parent_id === id)
      },

      getCategoryPath: (id) => {
        const categories = get().categories
        const path: Category[] = []
        let current = categories.find(c => c.id === id)
        
        while (current) {
          path.unshift(current)
          current = current.parent_id ? categories.find(c => c.id === current!.parent_id) : undefined
        }
        
        return path
      },

      isLoading: (resource) => {
        const loading = get().loading
        if (resource) {
          return loading[resource]
        }
        return Object.values(loading).some(Boolean)
      },

      hasError: (resource) => {
        const errors = get().errors
        if (resource) {
          return errors[resource] !== null
        }
        return Object.values(errors).some(e => e !== null)
      },

      isInitialized: (resource) => {
        const initialized = get().initialized
        if (resource) {
          return initialized[resource]
        }
        return Object.values(initialized).every(Boolean)
      },

      getProductsCount: () => {
        return get().products.length
      },

      getCategoriesCount: () => {
        return get().categories.length
      },

      getActiveProductsCount: () => {
        return get().products.filter((p: any) => p.inStock !== false).length
      },
      
      // Обратная совместимость: адаптирует Product[] в Prosthetic[] с мемоизацией
      getAdaptedProducts: () => {
        const state = get()
        
        // Проверяем, нужно ли пересчитывать
        if (adaptedProductsCache && 
            adaptedProductsCache.products === state.products &&
            adaptedProductsCache.categories === state.categories) {
          return adaptedProductsCache.result
        }
        
        // Пересчитываем и кешируем
        const result = adaptProductsToProsthetics(state.products, state.categories)
        adaptedProductsCache = {
          products: state.products,
          categories: state.categories,
          result
        }
        
        return result
      },

      // === УТИЛИТЫ ===

      reset: () => {
        adaptedProductsCache = null // Сброс кеша
        set(() => ({ ...initialState }))
      },

      clearErrors: () => {
        set((state) => {
          state.errors = {
            products: null,
            categories: null,
            settings: null
          }
        })
      }
    }))
  )
)

// Селекторы для оптимизации (избегают лишних ререндеров)
export const adminSelectors = {
  products: (state: AdminStore) => state.products,
  categories: (state: AdminStore) => state.categories,
  settings: (state: AdminStore) => state.settings,
  isProductsLoading: (state: AdminStore) => state.loading.products,
  isCategoriesLoading: (state: AdminStore) => state.loading.categories,
  isSettingsLoading: (state: AdminStore) => state.loading.settings,
  productsError: (state: AdminStore) => state.errors.products,
  categoriesError: (state: AdminStore) => state.errors.categories,
  settingsError: (state: AdminStore) => state.errors.settings,
  isInitialized: (state: AdminStore) => state.isInitialized()
}