"use client"


interface CategoryGroup {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
  children?: CategoryGroup[]
}

interface CategorySidebarProps {
  hierarchicalCategories: CategoryGroup[]
  activeCategory: string
  activeCategoryId: number | null
  onCategoryChange: (category: string, categoryId?: number) => void
  HierarchicalCategoryItem: React.ComponentType<{ group: CategoryGroup }>
}

import { useI18n } from "@/components/i18n-provider"

export function CategorySidebar({
  hierarchicalCategories,
  activeCategory,
  activeCategoryId,
  onCategoryChange,
  HierarchicalCategoryItem
}: CategorySidebarProps) {
  const { t } = useI18n()
  return (
    <>
      {/* Кнопка "Все категории" */}
      <div className="mb-4">
        <button
          onClick={() => onCategoryChange("All")}
          className={`
            w-full text-left px-4 py-3 rounded-lg transition-all duration-300 font-medium border
            ${
              activeCategory === "All" || activeCategoryId === null
                ? "bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-200/30 border-blue-400"
                : "text-blue-700 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50 border-blue-200/40 hover:border-blue-300/60 hover:shadow-md"
            }
          `}
        >
          {t('common.allCategories')}
        </button>
      </div>

      {/* Иерархические категории */}
      <div className="space-y-2">
        {hierarchicalCategories.map((group) => (
          <HierarchicalCategoryItem key={group.id} group={group} />
        ))}
      </div>

      {/* Информация внизу */}
      {hierarchicalCategories.length === 0 && (
        <div className="text-center py-8 text-blue-600/70">
          <p className="text-sm font-medium">{t('category.emptyMenu')}</p>
          <p className="text-xs mt-2 text-blue-500/60">{t('category.chooseCategoryForFilters')}</p>
        </div>
      )}

      {/* Удалено уведомление о настройке меню в админ-панели по просьбе пользователя */}
    </>
  )
}