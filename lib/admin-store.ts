import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  category_id: number
  manufacturer_id: number
  category?: string
  category_name?: string
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
          setProducts(globalCache.products)
        }
      }

      // Загружаем категории
      const categoriesRes = await fetch('/api/categories')
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        if (categoriesData.success) {
          globalCache.categories = categoriesData.data || []
          setCategories(globalCache.categories)
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

  return {
    products,
    categories,
    siteSettings,
    isLoading,
    initializeData,
    forceRefresh
  }
}

export const adminStore = { getSettings: () => ({}) };
