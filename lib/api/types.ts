// Основные типы для API v3

// ============== Базовые типы ==============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    duration?: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TimestampFields {
  created_at: string;
  updated_at: string;
}

// ============== Продукты ==============
export interface Product extends TimestampFields {
  id: number;
  name: string;
  slug?: string; // Не обязательное, генерируется из name
  sku?: string;
  description?: string;
  category_id: number;
  manufacturer_id?: number;
  model_line_id?: number;
  series_id?: number;
  price?: number;
  discount_price?: number;
  stock_quantity: number;
  stock_status?: string;
  in_stock?: boolean;
  is_deleted: boolean;
  show_price: boolean;
  is_bestseller?: boolean; // Оставляем как опциональное для будущего использования
  image_url?: string; // Соответствует полю БД
  article_number?: string;
  weight?: string;
  battery_life?: string;
  warranty?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  specs_cache?: Record<string, any>;
  
  // Связанные данные (опционально загружаются)
  category?: ProductCategory;
  manufacturer?: Manufacturer;
  variants?: ProductVariant[];
  characteristics?: ProductCharacteristic[];
  images?: MediaFile[];
}

export interface ProductVariant extends TimestampFields {
  id: number;
  master_id: number;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  price?: number;
  discount_price?: number;
  cost_price?: number;
  stock_quantity: number;
  reserved_quantity: number;
  min_stock_level?: number;
  max_stock_level?: number;
  stock_status?: string;
  attributes: Record<string, any>;
  primary_image_url?: string;
  images?: string[];
  videos?: string[];
  documents?: string[];
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_bestseller: boolean;
  is_recommended?: boolean;
  is_deleted: boolean;
  show_price: boolean;
  sort_order: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  warranty_months?: number;
  battery_life_hours?: number;
  custom_fields?: Record<string, any>;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  category_id?: number;
  short_name?: string;
  
  // Legacy product_sizes fields для backward compatibility
  size_name?: string;
  size_value?: string;
  dimensions?: Record<string, any>;
  specifications?: Record<string, any>;
  
  // Связанные данные
  characteristics?: VariantCharacteristic[];
}

// ============== Категории ==============
export interface ProductCategory extends TimestampFields {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  image_url?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
  type: 'category' | 'subcategory' | 'group';
  
  // Связанные данные
  parent?: ProductCategory;
  children?: ProductCategory[];
  products_count?: number;
}

// ============== Характеристики ==============
export interface CharacteristicGroup extends TimestampFields {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  is_section: boolean;
  is_active: boolean;
  sort_order: number;
  
  // Связанные данные
  values?: CharacteristicValue[];
  children?: CharacteristicGroup[];
}

export interface CharacteristicValue extends TimestampFields {
  id: number;
  group_id: number;
  value: string;
  description?: string;
  color_hex?: string;
  is_active: boolean;
  sort_order: number;
}

export interface ProductCharacteristic {
  id: number;
  product_id: number;
  value_id: number;
  additional_value?: string;
  
  // Связанные данные для отображения
  group_name?: string;
  value_name?: string;
  color_hex?: string;
}

export interface VariantCharacteristic {
  id: number;
  variant_id: number;
  value_id: number;
  additional_value?: string;
  
  // Связанные данные для отображения
  group_name?: string;
  value_name?: string;
  color_hex?: string;
}

// Алиас для задачи TODO 23
export interface VariantCharacteristics {
  id: number;
  variant_id: number;
  value_id: number;
  additional_value?: string;
  // связанные данные
  group_name?: string;
  value_name?: string;
  color_hex?: string;
}

// ============== Производители ==============
export interface Manufacturer extends TimestampFields {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  country?: string;
  is_active: boolean;
  sort_order: number;
}

// ============== Медиафайлы ==============
export interface MediaFile extends TimestampFields {
  id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  file_hash: string;
  width?: number;
  height?: number;
  alt_text?: string;
  title?: string;
  is_active: boolean;
  upload_count: number;
}

// ============== Пользователи ==============
export interface User extends TimestampFields {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id: number;
  is_active: boolean;
  last_login?: string;
  
  // Связанные данные
  role?: UserRole;
}

export interface UserRole extends TimestampFields {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  is_active: boolean;
}

// ============== Заказы ==============
export interface Order extends TimestampFields {
  id: number;
  order_number: string;
  user_id?: number;
  status: OrderStatus;
  total_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  payment_method?: string;
  shipping_method?: string;
  notes?: string;
  
  // Связанные данные
  items?: OrderItem[];
  user?: User;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number;
  variant_id?: number;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

// ============== Legacy Compatibility ==============
// Legacy support для backward compatibility
export type ProductSize = ProductVariant; // Deprecated, use ProductVariant

// ============== Фильтры ==============
export interface ProductFilter {
  category_id?: number;
  manufacturer_id?: number;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  characteristics?: Record<number, number[]>; // group_id -> value_ids[]
  search?: string;
}

// ============== Настройки сайта ==============

// Дополнительные контакты
export interface AdditionalContact {
  id: string;
  type: "phone" | "email" | "address" | "website" | "other";
  label: string;
  value: string;
  isActive: boolean;
}

export interface SiteSettings {
  id: number;
  siteName: string;
  siteDescription?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  socialMedia?: Record<string, string>;
  additionalContacts?: AdditionalContact[];
  createdAt?: string;
  updatedAt: string;
}

// ============== API CLIENT TYPES ==============

// HTTP методы
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Опции для запросов
export interface RequestOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  cache?: boolean
  cacheTTL?: number
  cacheTags?: string[]
}

// Конфигурация API клиента
export interface ApiClientConfig {
  baseUrl: string
  timeout: number
  maxRetries: number
  retryDelay: number
  defaultHeaders: Record<string, string>
  enableCache: boolean
  defaultCacheTTL: number
  enableMetrics: boolean
  enableDebug: boolean
}

// Метрики API
export interface ApiMetrics {
  requests: {
    total: number
    success: number
    failed: number
    cached: number
  }
  timing: {
    average: number
    min: number
    max: number
  }
  errors: Record<string, number>
  endpoints: Record<string, {
    requests: number
    failures: number
    averageTime: number
  }>
}

// Ошибки API
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NetworkError extends Error {
  constructor(message: string, public endpoint: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public endpoint: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

// Типы для дедупликации запросов
export interface PendingRequest<T = any> {
  promise: Promise<T>
  timestamp: number
  abortController: AbortController
}

// Интерфейс для retry логики
export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryCondition: (error: Error) => boolean
}