import { useState, useEffect } from 'react'

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

export function useAdminStore(): AdminStoreState {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [siteSettings, setSiteSettings] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const initializeData = async () => {
    setIsLoading(true)
    try {
      // Загружаем продукты
      const productsRes = await fetch('/api/products')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        if (productsData.success) {
          setProducts(productsData.data || [])
        }
      }

      // Загружаем категории
      const categoriesRes = await fetch('/api/categories')
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        if (categoriesData.success) {
          setCategories(categoriesData.data || [])
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const forceRefresh = () => {
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
