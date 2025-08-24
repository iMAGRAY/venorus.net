// Unified API system exports
import { apiClient } from './client'
export { apiClient, ApiClientClass } from './client'
export type {
  // Core types
  ApiResponse,
  HttpMethod,
  RequestOptions,
  ApiClientConfig,
  ApiMetrics,
  PendingRequest,
  RetryConfig,
  
  // Error types
  ApiError,
  NetworkError,
  TimeoutError,

  // Business types
  Product,
  ProductVariant,
  ProductCategory,
  ProductFilter,
  CharacteristicGroup,
  CharacteristicValue,
  ProductCharacteristic,
  VariantCharacteristic,
  Manufacturer,
  MediaFile,
  User,
  UserRole,
  Order,
  OrderItem,
  OrderStatus,
  SiteSettings,
  PaginationParams,
  TimestampFields
} from './types'

// API Helpers для быстрого использования
export const api = {
  // Products
  products: {
    list: (filters?: any) => apiClient.get('/api/products', { body: filters }),
    get: (id: number) => apiClient.get(`/api/products/${id}`),
    create: (data: any) => apiClient.post('/api/products', data),
    update: (id: number, data: any) => apiClient.put(`/api/products/${id}`, data),
    delete: (id: number) => apiClient.delete(`/api/products/${id}`)
  },

  // Categories
  categories: {
    list: () => apiClient.get('/api/categories'),
    get: (id: number) => apiClient.get(`/api/categories/${id}`),
    create: (data: any) => apiClient.post('/api/categories', data),
    update: (id: number, data: any) => apiClient.put(`/api/categories/${id}`, data),
    delete: (id: number) => apiClient.delete(`/api/categories/${id}`)
  },

  // Settings
  settings: {
    get: () => apiClient.get('/api/settings'),
    update: (data: any) => apiClient.put('/api/settings', data)
  },

  // Cache management
  cache: {
    clear: () => apiClient.post('/api/cache/clear'),
    stats: () => apiClient.get('/api/cache/stats')
  }
}