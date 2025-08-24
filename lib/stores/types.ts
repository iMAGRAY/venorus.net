// Импортируем типы из API системы
import type { 
  Product as ApiProduct, 
  ProductCategory, 
  SiteSettings 
} from '@/lib/api/types'

// Переэкспортируем с алиасом
export type { SiteSettings }
export type Category = ProductCategory

// UI-специфичные extensions для обратной совместимости
export interface ProductUIExtensions {
  imageUrl?: string
  images?: string[]
  inStock?: boolean
  stock_status?: string
  category?: string | ProductCategory
  category_name?: string
  manufacturer?: string
  manufacturer_name?: string
  modelLine?: string
  model_line_name?: string
  article_number?: string
  has_variants?: boolean
  variants_count?: number
  [key: string]: any
}

// Расширенный тип Product для UI компонентов
export type Product = ApiProduct & ProductUIExtensions


// Состояния загрузки для каждого ресурса
export interface LoadingState {
  products: boolean
  categories: boolean
  settings: boolean
}

export interface ErrorState {
  products: string | null
  categories: string | null
  settings: string | null
}

// Состояние админ панели
export interface AdminState {
  // Данные
  products: Product[]
  categories: Category[]
  settings: SiteSettings
  
  // Состояние UI
  loading: LoadingState
  errors: ErrorState
  lastFetch: {
    products: number | null
    categories: number | null
    settings: number | null
  }
  
  // Флаги инициализации
  initialized: {
    products: boolean
    categories: boolean
    settings: boolean
  }
}

// Экшены для мутаций
export interface AdminActions {
  // Инициализация данных
  initializeProducts: () => Promise<void>
  initializeCategories: () => Promise<void>
  initializeSettings: () => Promise<void>
  initializeAll: () => Promise<void>
  
  // Обновление данных
  refreshProducts: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshAll: () => Promise<void>
  
  // CRUD операции для продуктов
  createProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>
  updateProduct: (id: number, updates: Partial<Product & ProductUIExtensions>) => Promise<Product>
  deleteProduct: (id: number) => Promise<void>
  
  // CRUD операции для категорий
  createCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => Promise<Category>
  updateCategory: (id: number, updates: Partial<Category>) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  
  // Настройки
  updateSettings: (settings: Partial<SiteSettings>) => Promise<void>
  
  // Сброс состояния
  reset: () => void
  clearErrors: () => void
}

// Селекторы для оптимизации ререндеров
export interface AdminSelectors {
  // Селекторы продуктов
  getProduct: (id: number) => Product | undefined
  getProductsByCategory: (categoryId: number) => Product[]
  getProductsByManufacturer: (manufacturerId: number) => Product[]
  searchProducts: (query: string) => Product[]
  
  // Селекторы категорий
  getCategory: (id: number) => Category | undefined
  getRootCategories: () => Category[]
  getCategoryChildren: (id: number) => Category[]
  getCategoryPath: (id: number) => Category[]
  
  // Селекторы состояния
  isLoading: (resource?: keyof LoadingState) => boolean
  hasError: (resource?: keyof ErrorState) => boolean
  isInitialized: (resource?: keyof AdminState['initialized']) => boolean
  
  // Статистика
  getProductsCount: () => number
  getCategoriesCount: () => number
  getActiveProductsCount: () => number
  
  // Обратная совместимость
  getAdaptedProducts: () => any[] // Возвращает Product[] в формате Prosthetic[]
}

// Полный тип store
export type AdminStore = AdminState & AdminActions & AdminSelectors