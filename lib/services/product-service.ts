import type {
  ProductFormData,
  ProductCategory,
  ProductManufacturer,
  ProductModelLine,
  ProductCharacteristic
} from '@/lib/types/product-form'
import { apiClient } from '@/lib/unified-api-client'

export class ProductService {
  private static instance: ProductService
  private api = apiClient

  constructor() {
    // API client уже инициализирован как singleton
  }

  static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService()
    }
    return ProductService.instance
  }

  // Загрузка данных продукта
  async loadProduct(id: string): Promise<any> {
    try {
      const result = await this.api.get(`/products/${id}`)
      return result.success ? result.data : null
    } catch (error) {
      console.error('Error loading product:', error)
      throw error
    }
  }

  // Сохранение основных данных продукта
  async saveProduct(productData: ProductFormData): Promise<string> {
    try {
      const isUpdate = !!productData.id

      let result
      if (isUpdate) {
        // Увеличиваем таймаут для обновления продукта до 30 секунд
        result = await this.api.put(`/products/${productData.id}`, productData, {
          timeout: 30_000, // 30 секунд
          retries: 2
        })
      } else {
        result = await this.api.post('/products', productData, {
          timeout: 30_000, // 30 секунд
          retries: 2
        })
      }

      if (!result.success) {
        console.error('❌ Product save failed:', result.error)
        throw new Error(result.error || 'Save failed')
      }
      return result.data.id
    } catch (error) {
      console.error('❌ Error saving product:', error)

      // Предоставляем более детальную информацию об ошибке
      if (error.name === 'AbortError') {
        throw new Error('Операция прервана по таймауту. Попробуйте еще раз.')
      } else if (error.message?.includes('net::ERR_CONNECTION_RESET')) {
        throw new Error('Соединение с сервером прервано. Проверьте подключение к интернету.')
      } else if ((error as any).status === 400 || error.message?.includes('HTTP 400')) {
        // Ошибки валидации данных - передаем сообщение как есть
        throw new Error(error.message || 'Ошибка валидации данных');
      } else if ((error as any).status === 409 || error.message?.includes('HTTP 409')) {
        // Ошибки конфликта данных - передаем детальное сообщение
        const suggestion = (error as any).suggestion;
        const existingProduct = (error as any).existingProduct;

        let errorMessage = error.message || 'Конфликт данных';
        if (suggestion) {
          errorMessage += `\n\nРекомендация: ${suggestion}`;
        }
        if (existingProduct) {
          errorMessage += `\n\nСуществующий продукт: ${existingProduct.name} (ID: ${existingProduct.id}) у производителя "${existingProduct.manufacturer}"`;
        }

        throw new Error(errorMessage);
      } else if (error.message?.includes('HTTP 500')) {
        throw new Error('Внутренняя ошибка сервера. Попробуйте позже.')
      }

      throw error
    }
  }

  // Загрузка изображений продукта
  async loadProductImages(productId: string): Promise<string[]> {
    try {
      const result = await this.api.get(`/products/${productId}/images`)
      return result.success ? result.data : []
    } catch (error) {
      console.error('Error loading product images:', error)
      return []
    }
  }

  // Сохранение изображений продукта
  async saveProductImages(productId: string, _images: string[]): Promise<void> {
    try {
      const result = await this.api.put(`/products/${productId}/images`, { images: _images })
      if (!result.success) throw new Error(result.error || 'Images save failed')
    } catch (error) {
      console.error('Error saving product images:', error)
      throw error
    }
  }

  // Загрузка характеристик продукта
  async loadCharacteristics(productId: string): Promise<any[]> {
    try {
      const result = await this.api.get(`/products/${productId}/characteristics-simple`)

      if (!result.success) {
        return []
      }

      // API возвращает сложную структуру, нужно извлечь характеристики
      const data = result.data

      // Если есть selected_characteristics, извлекаем их
      if (data.selected_characteristics && Array.isArray(data.selected_characteristics)) {
        const characteristics: ProductCharacteristic[] = []

        data.selected_characteristics.forEach((group: any) => {
          if (group.characteristics && Array.isArray(group.characteristics)) {
            group.characteristics.forEach((char: any) => {
              characteristics.push({
                value_id: char.value_id,
                value_name: char.value_name,
                group_id: group.group_id || char.group_id,
                group_name: group.group_name,
                additional_value: char.additional_value || '',
                color_hex: char.color_hex
              } as any)
            })
          }
        })

        return characteristics
      }

      // Если data уже является массивом характеристик
      if (Array.isArray(data)) {
        return data
      }

      return []
    } catch (error) {
      console.error('Error loading characteristics:', error)
      return []
    }
  }

  // Сохранение характеристик продукта
  async saveCharacteristics(productId: string, _characteristics: any[]): Promise<void> {
    try {
      const result = await this.api.post(`/products/${productId}/characteristics-simple`, { characteristics: _characteristics })
      if (!result.success) throw new Error(result.error || 'Characteristics save failed')
    } catch (error) {
      console.error('Error saving characteristics:', error)
      throw error
    }
  }

  // Загрузка конфигурируемых характеристик продукта
  async loadConfigurableCharacteristics(productId: string): Promise<any[]> {
    try {
      const result = await this.api.get(`/products/${productId}/configurable-characteristics`)
      if (result.success && result.data) {
        return result.data.configurable_characteristics || []
      }
      return []
    } catch (error) {
      console.error('Error loading configurable characteristics:', error)
      return []
    }
  }

  // Сохранение конфигурируемых характеристик продукта
  async saveConfigurableCharacteristics(productId: string, _configurableCharacteristics: any[]): Promise<void> {
    try {
      const result = await this.api.post(`/products/${productId}/configurable-characteristics`, { configurableCharacteristics: _configurableCharacteristics })
      if (!result.success) throw new Error(result.error || 'Configurable characteristics save failed')
    } catch (error) {
      console.error('Error saving configurable characteristics:', error)
      throw error
    }
  }

  // Загрузка всех таблиц подбора для продукта
  async loadProductSelectionTables(productId: string): Promise<any> {
    try {
      const result = await this.api.get(`/products/${productId}/selection-tables`)
      return result.success ? result.data : {}
    } catch (error) {
      console.error('Error loading product selection tables:', error)
      return {}
    }
  }

  // Сохранение таблиц подбора для продукта
  async saveProductSelectionTables(productId: string, tables: any): Promise<void> {
    try {
      const result = await this.api.put(`/products/${productId}/selection-tables`, { tables })
      if (!result.success) throw new Error(result.error || 'Product selection tables save failed')
    } catch (error) {
      console.error('Error saving product selection tables:', error)
      throw error
    }
  }

  // Загрузка таблиц подбора для новых товаров (legacy - использует основной endpoint)
  async loadNewProductSelectionTables(productId: string): Promise<any> {
    return this.loadProductSelectionTables(productId)
  }

  // Сохранение таблиц подбора для новых товаров (legacy - использует основной endpoint)
  async saveNewProductSelectionTables(productId: string, tables: any): Promise<void> {
    return this.saveProductSelectionTables(productId, tables)
  }

  // Загрузка таблиц подбора для существующих товаров (legacy - использует основной endpoint)
  async loadExistingProductSelectionTables(productId: string): Promise<any> {
    return this.loadProductSelectionTables(productId)
  }

  // Сохранение таблиц подбора для существующих товаров (legacy - использует основной endpoint)
  async saveExistingProductSelectionTables(productId: string, tables: any): Promise<void> {
    return this.saveProductSelectionTables(productId, tables)
  }

  // Получение или создание варианта продукта
  async getOrCreateProductVariant(productId: string): Promise<any> {
    try {
      const result = await this.api.post(`/products/${productId}/variant`, {})
      return result.success ? result.data : null
    } catch (error) {
      console.error('Error getting or creating product variant:', error)
      throw error
    }
  }

  // Загрузка справочных данных
  async loadReferenceData(): Promise<{
    categories: ProductCategory[]
    manufacturers: ProductManufacturer[]
    modelLines: ProductModelLine[]
  }> {
    try {
      const [categories, manufacturers, modelLines] = await Promise.all([
        this.api.get('/categories'),
        this.api.get('/manufacturers'),
        this.api.get('/model-lines')
      ])

      return {
        categories: categories.success ? categories.data : [],
        manufacturers: manufacturers.success ? manufacturers.data : [],
        modelLines: modelLines.success ? modelLines.data : []
      }
    } catch (error) {
      console.error('Error loading reference data:', error)
      return { categories: [], manufacturers: [], modelLines: [] }
    }
  }

  // Пакетные операции
  async batchUpdateProducts(updates: Array<{ id: string; data: Partial<ProductFormData> }>): Promise<void> {
    try {
      const requests = updates.map(update =>
        () => this.api.put(`/products/${update.id}`, update.data)
      )
      await this.api.batch(requests)
    } catch (error) {
      console.error('Error in batch update:', error)
      throw error
    }
  }

  // Удаление продукта
  async deleteProduct(productId: string): Promise<void> {
    try {
      const result = await this.api.delete(`/products/${productId}`)
      if (!result.success) throw new Error(result.error || 'Delete failed')
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }

  // Загрузка списка продуктов с фильтрами
  async loadProducts(filters?: {
    category?: string
    manufacturer?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ products: any[]; total: number; page: number; limit: number }> {
    try {
      const queryParams = new URLSearchParams()
      if (filters?.category) queryParams.append('category', filters.category)
      if (filters?.manufacturer) queryParams.append('manufacturer', filters.manufacturer)
      if (filters?.search) queryParams.append('search', filters.search)
      if (filters?.page) queryParams.append('page', filters.page.toString())
      if (filters?.limit) queryParams.append('limit', filters.limit.toString())

      const result = await this.api.get(`/products?${queryParams.toString()}`)
      return result.success ? result.data : { products: [], total: 0, page: 1, limit: 20 }
    } catch (error) {
      console.error('Error loading products:', error)
      return { products: [], total: 0, page: 1, limit: 20 }
    }
  }
}