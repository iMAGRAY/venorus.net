import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: number
  name: string
  price: number
  discount_price?: number
  image_url: string
  imageUrl?: string
  images?: string[]
  inStock?: boolean
  stock_status?: string
  sku?: string
  weight?: string
  created_at?: string
  updated_at?: string
  category_id: number
  manufacturer_id: number
  category?: string
  category_name?: string
  manufacturer?: string
  manufacturer_name?: string
  modelLine?: string
  model_line_name?: string
  [key: string]: any
}

interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
  children?: Category[]
}

interface AdminStoreState {
  products: Product[]
  categories: Category[]
  siteSettings: any
  isLoading: boolean
  initializeData: () => void
  forceRefresh: () => void
  updateProduct: (id: string, product: any) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  updateCategory: (id: string, category: any) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  updateSiteSettings: (settings: any) => Promise<void>
  loadSiteSettings: () => Promise<void>
}

// Глобальный кеш для предотвращения повторных запросов
let globalCache = {
  products: null as Product[] | null,
  categories: null as Category[] | null,
  isLoading: false,
  hasInitialized: false
}

export function useAdminStore(): AdminStoreState {
  const [products, setProducts] = useState<Product[]>(globalCache.products || [])
  const [categories, setCategories] = useState<Category[]>(globalCache.categories || [])
  const [siteSettings, setSiteSettings] = useState({})
  const [isLoading, setIsLoading] = useState(globalCache.isLoading)

  // Синхронизируем локальное состояние с глобальным кешем
  useEffect(() => {
    if (globalCache.products) {
      setProducts(globalCache.products)
    }
    if (globalCache.categories) {
      setCategories(globalCache.categories)
    }
    setIsLoading(globalCache.isLoading)
  }, [])

  const initializeData = useCallback(async () => {
    // Предотвращаем повторные запросы
    if (globalCache.isLoading || globalCache.hasInitialized) {
      return
    }

    globalCache.isLoading = true
    setIsLoading(true)
    
    try {
      // Загружаем продукты
      const productsRes = await fetch('/api/products')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        if (productsData.success) {
          globalCache.products = productsData.data || []
          setProducts(globalCache.products || [])
        }
      }

      // Загружаем категории
      const categoriesRes = await fetch('/api/categories')
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        if (categoriesData.success) {
          globalCache.categories = categoriesData.data || []
          setCategories(globalCache.categories || [])
        }
      }
      
      globalCache.hasInitialized = true
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      globalCache.isLoading = false
      setIsLoading(false)
    }
  }, [])

  const forceRefresh = () => {
    // Сбрасываем кеш для принудительного обновления
    globalCache.hasInitialized = false
    globalCache.isLoading = false
    initializeData()
  }

  const updateProduct = async (id: string, product: any) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      })
      if (!response.ok) throw new Error('Failed to update product')
      forceRefresh()
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete product')
      forceRefresh()
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }

  const updateSiteSettings = async (settings: any) => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (!response.ok) throw new Error('Failed to update settings')
      setSiteSettings(settings)
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  const loadSiteSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) throw new Error('Failed to load settings')
      const settings = await response.json()
      setSiteSettings(settings)
    } catch (error) {
      console.error('Error loading settings:', error)
      throw error
    }
  }

  const updateCategory = async (id: string, category: any) => {
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      })
      if (!response.ok) throw new Error('Failed to update category')
      forceRefresh()
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete category')
      forceRefresh()
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  }

  return {
    products,
    categories,
    siteSettings,
    isLoading,
    initializeData,
    forceRefresh,
    updateProduct,
    deleteProduct,
    updateCategory,
    deleteCategory,
    updateSiteSettings,
    loadSiteSettings
  }
}

// TODO: Implement real adminStore.getSettings
// export const adminStore = { getSettings: () => ({}) };
