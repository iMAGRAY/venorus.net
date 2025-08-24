// Экспорты новой системы управления состоянием
export { useAdminStore, adminSelectors } from './admin-store'
export type { 
  AdminStore,
  AdminState,
  AdminActions,
  AdminSelectors,
  Product,
  Category,
  SiteSettings,
  LoadingState,
  ErrorState
} from './types'

// Утилиты для миграции со старой системы
import { useAdminStore } from './admin-store'

export const migrationHelpers = {
  // Мигрировать со старого useAdminStore
  migrateFromOldAdminStore: () => {
    const store = useAdminStore.getState()
    // Инициализируем все данные
    return store.initializeAll()
  },
  
  // Очистка старых кешей
  clearLegacyCaches: () => {
    // Очищаем старые глобальные переменные если они есть
    if (typeof window !== 'undefined') {
      // @ts-ignore - очищаем старые глобальные кеши
      window.globalCache = null
    }
  }
}