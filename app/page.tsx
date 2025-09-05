"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import Header from "@/components/header"
import HeroImage from "@/components/hero-image"
import { Footer } from "@/components/footer"
import { ProductGrid } from "@/components/product-grid"
import { CategorySidebar } from '@/components/category-sidebar'
import { SearchBar } from "@/components/search-bar"
import { SortDropdown } from "@/components/sort-dropdown"
import { ViewToggle } from "@/components/view-toggle"
import { ProductQuickView } from "@/components/product-quick-view"
import { Button } from "@/components/ui/button"
import { ChevronRight, Filter, Loader2, X, ChevronUp, ChevronDown } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { useAdminStore } from "@/lib/stores"
import logger from "@/lib/logger"
import { CatalogDownloadButtons } from "@/components/catalog-download-buttons"
import { useI18n } from "@/components/i18n-provider"

// Interfaces estrictas para tipado
interface CategoryGroup {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
  children?: CategoryGroup[]
}

interface Manufacturer {
  id: number
  name: string
  logo_url: string | null
}

interface _MenuSection {
  id: string
  name: string
  type: 'category' | 'manufacturer' | 'custom'
  data: CategoryGroup[] | Manufacturer[]
  is_visible: boolean
  sort_order: number
}

interface _Product {
  id: number
  name: string
  price: number
  image_url: string
  category_id: number
  manufacturer_id: number
  category?: string
  category_name?: string
}

const PRODUCTS_PER_PAGE = 12 // Cantidad de productos para cargar por vez

export default function HomePage() {
  const { t } = useI18n()
  logger.debug('HomePage рендерится')
  
  const allProducts = useAdminStore(state => state.products)
  const adminCategories = useAdminStore(state => state.categories)  
  const siteSettings = useAdminStore(state => state.settings)
  const isLoading = useAdminStore(state => state.loading.products || state.loading.categories || state.loading.settings)
  const isInitialized = useAdminStore(state => state.initialized.products && state.initialized.categories && state.initialized.settings)
  const initializeAll = useAdminStore(state => state.initializeAll)
  
  // Productos adaptados memoizados para estabilidad
  const adaptedProducts = useAdminStore(state => state.getAdaptedProducts())

  // Initialize data on mount
  useEffect(() => {
    logger.log("HomePage: useEffect triggered, allProducts.length:", allProducts.length)
    logger.log("HomePage: isLoading:", isLoading)

    // Always try to initialize data if we don't have products
    if (!isInitialized && !isLoading) {
      logger.log("HomePage: Not initialized, initializing data...")
      initializeAll()
    } else {
      logger.log("HomePage: Products already loaded:", allProducts.length)
    }
  }, [initializeAll, allProducts.length, isLoading, isInitialized])

  // Debug log for products
  useEffect(() => {
    logger.log("HomePage: Products updated:", allProducts.length)
    if (allProducts.length > 0) {
      logger.log("Ejemplos de productos, sus categorías y características:",
        allProducts.slice(0, 3).map(p => ({
          name: p.name,
          category: p.category,
          category_id: p.category_id,
          category_name: p.category_name,
          specificationsCount: p.specifications?.length || 0,
          sampleSpecs: p.specifications?.slice(0, 2) || []
        }))
      )
    }
    logger.log("HomePage: Categories:", adminCategories.length)
  }, [allProducts, adminCategories])

  // Función para desplazarse al catálogo
  const scrollToCatalog = () => {
    const catalogSection = document.getElementById('products')
    if (catalogSection) {
      catalogSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  }

  // Cargamos categorías de productos para el catálogo
  const [_specGroups, _setSpecGroups] = useState<any[]>([])
  const [catalogMenuItems, setCatalogMenuItems] = useState<any[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set()) // Para mostrar/ocultar subcategorías

  // Función para alternar expansión de categoría
  const toggleCategoryExpansion = useCallback((categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }, [])

  // Función de carga de características para filtrado
  const loadFilterCharacteristics = useCallback(async (categoryId?: number | null) => {
    logger.debug('loadFilterCharacteristics вызвана с categoryId:', categoryId)
    
    // Cancelamos la solicitud anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Creamos nuevo AbortController
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    setIsLoadingCharacteristics(true)
    try {
      logger.log('Загрузка характеристик для фильтрации...', { categoryId })

      // Si se selecciona categoría, usamos nueva API
      const url = categoryId 
        ? `/api/characteristics/by-category?category_id=${categoryId}&include_children=true`
        : '/api/characteristics'
        
      const response = await fetch(url, { signal: abortController.signal })
      
      if (!response.ok) {
        logger.error('❌ HTTP ошибка при загрузке характеристик:', {
          status: response.status,
          statusText: response.statusText,
          url
        })
      }
      
      const result = await response.json()
      
      logger.debug('📊 API ответ:', {
        url,
        success: result.success,
        sectionsCount: result.data?.sections?.length,
        firstSection: result.data?.sections?.[0],
        rawData: result.data
      })

      if (result.success && result.data) {
        // Primero recopilamos todos los grupos con información de secciones
        const allGroups = result.data.sections?.flatMap((section: any) =>
          section.groups?.map((group: any) => ({
            id: group.group_id,
            name: group.group_name,
            sectionName: section.section_name,
            values: group.values || []
          })) || []
        ) || []
        
        logger.debug('allGroups после обработки:', {
          count: allGroups.length,
          sample: allGroups.slice(0, 3)
        })

        // Encontramos nombres de grupos duplicados
        const groupNameCounts = allGroups.reduce((acc: any, group: any) => {
          acc[group.name] = (acc[group.name] || 0) + 1
          return acc
        }, {})

        // Convertimos al formato final, agregando prefijo de sección solo para duplicados
        const flatCharacteristics = allGroups.map((group: any) => ({
          id: group.id,
          name: groupNameCounts[group.name] > 1 
            ? `${group.sectionName} - ${group.name}` 
            : group.name,
          originalName: group.name, // Guardamos el nombre original para filtrado
          values: group.values
        }))

        logger.debug('flatCharacteristics после преобразования:', {
          count: flatCharacteristics.length,
          sample: flatCharacteristics.slice(0, 3),
          groupNameCounts
        })

        logger.log(`Получено характеристик для фильтрации: ${flatCharacteristics.length}`)
        if (flatCharacteristics.length > 0) {
          logger.log(`Примеры характеристик фильтра:`,
            flatCharacteristics.slice(0, 3).map((char: any) => ({
              name: char.name,
              valuesCount: char.values?.length || 0,
              sampleValues: char.values?.slice(0, 3)?.map((v: any) => v.value) || []
            }))
          )
        }
        // Verificamos que la solicitud no fue cancelada antes de actualizar estado
        if (!abortController.signal.aborted) {
          setAvailableCharacteristics(flatCharacteristics)
          logger.debug('Установлены характеристики:', flatCharacteristics.length, flatCharacteristics)
        }
      } else {
        if (!abortController.signal.aborted) {
          logger.error('❌ Ошибка загрузки характеристик:', result.error)
          setAvailableCharacteristics([])
        }
      }
    } catch (error: any) {
      // Ignoramos AbortError - es cancelación normal de solicitud
      if (error.name === 'AbortError') {
        logger.debug('🚫 Запрос характеристик отменен')
        return
      }
      logger.error('❌ Ошибка загрузки характеристик для фильтрации:', error)
    } finally {
      // Verificamos que es nuestra solicitud actual antes de resetear estado
      if (abortControllerRef.current === abortController) {
        setIsLoadingCharacteristics(false)
        abortControllerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true;
    
    // Limpiamos características al montar
    logger.debug('🧹 Очищаем характеристики при монтировании')
    setAvailableCharacteristics([])

    const loadCategories = async () => {
      try {
        logger.log('Загрузка категорий товаров...')

        const response = await fetch('/api/categories')
        const result = await response.json()

        if (!isMounted) return;

        // Verificamos nuevo formato API con success y data
        if (result.success && result.data && Array.isArray(result.data)) {
          logger.log(`Получено категорий: ${result.data.length}`)

          // Convertimos categorías al formato para menú
          const transformCategories = (categories: any[]): any[] => {
            return categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              parent_id: cat.parent_id,
              children: cat.children ? transformCategories(cat.children) : [],
              is_visible: true,
              sort_order: cat.display_order || 0
            }))
          }

          const transformedCategories = transformCategories(result.data)
          setCatalogMenuItems(transformedCategories)
          _setSpecGroups(transformedCategories)
          
          // Expandimos automáticamente categorías con hijos para visibilidad de jerarquía
          const categoriesWithChildren = new Set<number>()
          transformedCategories.forEach((cat: any) => {
            if (cat.children && cat.children.length > 0) {
              categoriesWithChildren.add(cat.id)
            }
          })
          setExpandedCategories(categoriesWithChildren)

          logger.log(`Структура категорий:`)
          transformedCategories.forEach((item: any, index: number) => {
            logger.log(`   ${index + 1}. ${item.name} (ID: ${item.id})`)
            if (item.children && item.children.length > 0) {
              item.children.forEach((child: any) => {
                logger.log(`      └─ ${child.name} (ID: ${child.id})`)
              })
            }
          })

          // Creamos lista plana de todos los nombres de categorías para comparar con productos
          const flatCategoryNames: string[] = []
          const extractNames = (categories: any[]) => {
            categories.forEach(cat => {
              flatCategoryNames.push(cat.name)
              if (cat.children && cat.children.length > 0) {
                extractNames(cat.children)
              }
            })
          }
          extractNames(transformedCategories)
          logger.log(`📂 Все названия категорий:`, flatCategoryNames)

        } else {
          logger.error('❌ Ошибка загрузки категорий:', result.error || 'Неожиданный формат данных')
        }
      } catch (error) {
        logger.error('❌ Ошибка загрузки категорий товаров:', error)
      }
    }

    const loadData = async () => {
      await Promise.all([
        loadCategories()
        // No cargamos características inmediatamente, solo al seleccionar categoría
      ])
    }

    loadData()

    return () => {
      isMounted = false;
    }
  }, [])

  // Memoizamos categorías jerárquicas
  const hierarchicalCategories = useMemo(() => {
    // Los datos de API categories ya son jerárquicos
    return catalogMenuItems
  }, [catalogMenuItems])

  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]) // Products for display
  const [_currentPage, _setCurrentPage] = useState(1) // Current "page" for infinite scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false) // Loading additional products
  const [hasMore, setHasMore] = useState(true) // Are there more products to load
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("name-asc")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sidebarMode, setSidebarMode] = useState<"categories" | "filters">("categories")

  // Estado para filtros
  const [appliedFilters, setAppliedFilters] = useState<{
    categories: string[];
    characteristics: Record<string, string[]>;
  }>({
    categories: [],
    characteristics: {} // Format: { "Weight": ["1.2 kg"], "Warranty": ["3 years"] }
  })

  // State for characteristics filters
  const [availableCharacteristics, setAvailableCharacteristics] = useState<any[]>(() => {
    logger.debug('Initializing availableCharacteristics: empty array')
    return []
  })
  const [isLoadingCharacteristics, setIsLoadingCharacteristics] = useState(false)
  
  // Log availableCharacteristics changes
  useEffect(() => {
    logger.debug('availableCharacteristics changed:', availableCharacteristics.length, availableCharacteristics)
  }, [availableCharacteristics])

  const handleCategoryChange = useCallback((categoryName: string, categoryId?: number) => {
    logger.debug('handleCategoryChange called:', { categoryName, categoryId })
    logger.log(`Category changed to: "${categoryName}" (ID: ${categoryId})`)
    setActiveCategory(categoryName)
    setActiveCategoryId(categoryId || null)
    setIsFilterDrawerOpen(false)
    setIsCategoryDrawerOpen(false)
    
    // Clear characteristics filters when changing category
    setAppliedFilters(prev => ({ ...prev, characteristics: {} }))
    
    // Load characteristics for new category
    if (categoryName === "All" || categoryName === "All categories") {
      logger.debug('Loading all characteristics')
      loadFilterCharacteristics(null)
    } else if (categoryId) {
      logger.debug('Загружаем характеристики для категории:', categoryId)
      loadFilterCharacteristics(categoryId)
    } else {
      logger.debug('Нет categoryId для категории "' + categoryName + '", очищаем характеристики')
      setAvailableCharacteristics([])
    }
  }, [loadFilterCharacteristics])

  // Memoizamos componente para mostrar categorías jerárquicas
  const HierarchicalCategoryItem = useCallback(({ group, level = 0 }: { group: any, level?: number }) => {
    const hasChildren = group.children && group.children.length > 0
    const isExpanded = expandedCategories.has(group.id)

    return (
      <div className={`${level > 0 ? 'ml-4' : ''}`} key={group.id}>
        <div className="flex items-center">
          {/* Botón de expansión para categorías con elementos hijos */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleCategoryExpansion(group.id)
              }}
              className="mr-2 p-1 hover:bg-slate-200 rounded transition-colors"
            >
              {isExpanded ? (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}

          {/* Sangría para elementos sin elementos hijos */}
          {!hasChildren && level > 0 && (
            <div className="w-6 mr-2"></div>
          )}

          {/* Botón de categoría */}
          <button
            onClick={() => {
              logger.debug('Категория нажата:', { name: group.name, id: group.id })
              handleCategoryChange(group.name, group.id)
            }}
            className={`
              flex-1 text-left px-3 py-2 rounded-md transition-all duration-200 mb-1
              ${level === 0 ? 'font-medium' : level === 1 ? 'text-sm' : 'text-xs'}
              ${
                activeCategoryId === group.id
                  ? level === 0 ? "bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-200/30" :
                    level === 1 ? "bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md shadow-blue-200/20" :
                    level === 2 ? "bg-gradient-to-r from-sky-300 to-blue-400 text-white shadow-sm shadow-blue-200/10" :
                    "bg-gradient-to-r from-sky-200 to-blue-200 text-slate-700 shadow-sm"
                  : "text-slate-700 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50 hover:text-blue-700"
              }
            `}
            style={{
              paddingLeft: `${0.75 + level * 0.5}rem`
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                {group.name}
              </span>
            </div>
          </button>
        </div>

        {/* Categorías hijas - RECURSIVAMENTE */}
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {group.children.map((child: any) => (
              <HierarchicalCategoryItem
                key={child.id}
                group={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }, [activeCategoryId, handleCategoryChange, expandedCategories, toggleCategoryExpansion])

  // Manejador de cambios de filtros de características
  const handleCharacteristicFilterChange = useCallback((charName: string, value: string, checked: boolean) => {
    setAppliedFilters(prev => {
      const newCharacteristics = { ...prev.characteristics }

      if (!newCharacteristics[charName]) {
        newCharacteristics[charName] = []
      }

      if (checked) {
        if (!newCharacteristics[charName].includes(value)) {
          newCharacteristics[charName] = [...newCharacteristics[charName], value]
        }
      } else {
        newCharacteristics[charName] = newCharacteristics[charName].filter(v => v !== value)
        if (newCharacteristics[charName].length === 0) {
          delete newCharacteristics[charName]
        }
      }

      return {
        ...prev,
        characteristics: newCharacteristics
      }
    })
  }, [])

  // Función de limpieza de todos los filtros de características
  const clearCharacteristicFilters = useCallback(() => {
    setAppliedFilters(prev => ({
      ...prev,
      characteristics: {}
    }))
  }, [])

  // Componente de menú completo de categorías - solo categorías sin filtros
  const CategorySidebarComponent = useCallback(() => (
    <CategorySidebar
      hierarchicalCategories={hierarchicalCategories}
      activeCategory={activeCategory}
      activeCategoryId={activeCategoryId}
      onCategoryChange={handleCategoryChange}
      HierarchicalCategoryItem={HierarchicalCategoryItem}
    />
  ), [hierarchicalCategories, activeCategory, handleCategoryChange, HierarchicalCategoryItem, activeCategoryId])

  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const filteredProductsRef = useRef<any[]>([])  // Ref для актуального filteredProducts
  const hasMoreRef = useRef<boolean>(true)       // Ref для hasMore состояния
  const isLoadingMoreRef = useRef<boolean>(false)  // Ref для isLoadingMore состояния
  const abortControllerRef = useRef<AbortController | null>(null)  // AbortController для API запросов

  // Initialize filtered products
  useEffect(() => {
    setFilteredProducts(allProducts)
    filteredProductsRef.current = allProducts  // Sincronizamos ref
  }, [allProducts])

  // Memoizamos función de búsqueda de grupos y sus hijos por ID
  const findGroupAndChildrenById = useCallback((groups: any[], groupId: number): number[] => {
    const result: number[] = []

    for (const group of groups) {
      if (group.id === groupId) {
        result.push(group.id)
        // Agregamos todos los grupos hijos recursivamente
        const addChildren = (children: any[]) => {
          for (const child of children) {
            result.push(child.id)
            if (child.children && child.children.length > 0) {
              addChildren(child.children)
            }
          }
        }
        if (group.children && group.children.length > 0) {
          addChildren(group.children)
        }
        return result // Devolvemos inmediatamente, ya que ID es único
      }

      if (group.children && group.children.length > 0) {
        const childResult = findGroupAndChildrenById(group.children, groupId)
        if (childResult.length > 0) {
          return childResult // Si encontramos en hijos, devolvemos resultado
        }
      }
    }

    return result
  }, [])

  // Memoized filtered and sorted products
  const processedProducts = useMemo(() => {
    let tempProducts = [...allProducts]

    // Apply search
    if (searchQuery.trim()) {
      tempProducts = tempProducts.filter((product) =>
        (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply category filter - working with real product categories
    // Show all products if no category selected or "all" selected
    if (activeCategoryId && activeCategory !== "all") {
      const relevantCategoryIds = findGroupAndChildrenById(hierarchicalCategories, activeCategoryId)

      logger.log(`Фильтрация по категории: "${activeCategory}" (ID: ${activeCategoryId})`)
      logger.log(`Найденные ID категорий для фильтрации:`, relevantCategoryIds)
      logger.log(`Всего товаров до фильтрации: ${tempProducts.length}`)

      if (tempProducts.length > 0) {
        logger.log(`Примеры категорий товаров:`, tempProducts.slice(0, 5).map(p => ({ 
          name: p.name, 
          category: p.category,
          category_id: p.category_id 
        })))
      }

      tempProducts = tempProducts.filter((product) =>
        product.category_id && relevantCategoryIds.includes(Number(product.category_id))
      )

      logger.log(`Товаров после фильтрации: ${tempProducts.length}`)
    }

    // Apply advanced filters
    if (appliedFilters.categories && appliedFilters.categories.length > 0) {
      tempProducts = tempProducts.filter((p) => p.category && appliedFilters.categories.includes(typeof p.category === 'string' ? p.category : p.category.name))
    }

    // Apply characteristics filters
    if (appliedFilters.characteristics && Object.keys(appliedFilters.characteristics).length > 0) {
      logger.log(`Фильтрация по характеристикам:`, appliedFilters.characteristics)
      logger.log(`Товаров до фильтрации по характеристикам: ${tempProducts.length}`)

      if (tempProducts.length > 0) {
        logger.log(`Примеры характеристик товаров:`, tempProducts.slice(0, 3).map(p => ({
          name: p.name,
          specifications: p.specifications?.slice(0, 3) || []
        })))
      }

      tempProducts = tempProducts.filter((product) => {
        // El producto debe coincidir con TODAS las características seleccionadas
        return Object.entries(appliedFilters.characteristics).every(([charKey, selectedValues]: [string, any]) => {
          if (!selectedValues || selectedValues.length === 0) return true

          // Extraemos ID de grupo y nombre de la clave
          const [groupId, charName] = charKey.split(':')
          
          // Buscamos característica en producto por ID de grupo
          const hasCharacteristic = product.specifications?.some((spec: any) =>
            spec.group_id?.toString() === groupId && selectedValues.includes(spec.spec_value)
          )

          logger.log(`Товар "${product.name}" имеет характеристику "${charName}" (группа ${groupId}):`, hasCharacteristic)
          return hasCharacteristic
        })
      })

      logger.log(`Товаров после фильтрации по характеристикам: ${tempProducts.length}`)
    }

    // Apply sorting
    switch (sortBy) {
      case "name-asc":
        tempProducts.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "name-desc":
        tempProducts.sort((a, b) => b.name.localeCompare(a.name))
        break

      case "newest":
        tempProducts.sort((a, b) => Number.parseInt(String(b.id)) - Number.parseInt(String(a.id)))
        break
      default:
        break
    }

    return tempProducts
  }, [searchQuery, activeCategory, activeCategoryId, appliedFilters, sortBy, allProducts, hierarchicalCategories, findGroupAndChildrenById])

  // Actualizamos productos filtrados y reseteamos paginación al cambiar filtros
  useEffect(() => {
    // Deduplicación de productos por ID
    const seenIds = new Set()
    const uniqueProducts = processedProducts.filter(product => {
      if (seenIds.has(product.id)) {
        return false
      }
      seenIds.add(product.id)
      return true
    })
    
    setFilteredProducts(uniqueProducts)
    filteredProductsRef.current = uniqueProducts  // Sincronizamos ref
    _setCurrentPage(1)
    setHasMore(true)
    hasMoreRef.current = true

    // Mostramos primera porción de productos
    const initialProducts = uniqueProducts.slice(0, PRODUCTS_PER_PAGE)
    setDisplayedProducts(initialProducts)
    const newHasMore = uniqueProducts.length > PRODUCTS_PER_PAGE
    setHasMore(newHasMore)
    hasMoreRef.current = newHasMore
  }, [processedProducts])

  // Función de carga de productos adicionales
  const loadMoreProducts = useCallback(() => {
    // Verificamos estado actual a través de refs
    if (isLoadingMoreRef.current || !hasMoreRef.current) return
    
    setIsLoadingMore(true)
    isLoadingMoreRef.current = true

    // Simulamos pequeño retraso para suavidad
    setTimeout(() => {
      _setCurrentPage(prevPage => {
        const nextPage = prevPage + 1
        const startIndex = (nextPage - 1) * PRODUCTS_PER_PAGE
        const endIndex = startIndex + PRODUCTS_PER_PAGE
        
        // Используем ref для получения актуальных данных
        const currentFiltered = filteredProductsRef.current || []
        const newProducts = currentFiltered.slice(startIndex, endIndex)

        if (newProducts.length > 0) {
          setDisplayedProducts(prev => {
            // Дедупликация по ID для предотвращения дублированных ключей React
            const existingIds = new Set(prev.map(p => p.id))
            const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id))
            return [...prev, ...uniqueNewProducts]
          })
          const newHasMore = endIndex < currentFiltered.length
          setHasMore(newHasMore)
          hasMoreRef.current = newHasMore
          return nextPage
        } else {
          setHasMore(false)
          hasMoreRef.current = false
          return prevPage
        }
      })
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }, 300)
  }, [])

  // Intersection Observer для автоматической подгрузки
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          loadMoreProducts()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px', // Начинаем загрузку за 100px до достижения элемента
      }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMoreProducts])


  const handleQuickView = useCallback((product: any) => {
    setQuickViewProduct(product)
  }, [])

  const handleProductChange = useCallback((newProduct: any) => {
    setQuickViewProduct(newProduct)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleSort = useCallback((value: string) => {
    setSortBy(value)
  }, [])

  const handleViewChange = useCallback((newView: "grid" | "list") => {
    setView(newView)
  }, [])

  // Состояние для мобильного фильтра
  const [mobileExpandedCharGroups, setMobileExpandedCharGroups] = useState<Set<string>>(new Set());
  const [desktopExpandedCharGroups, setDesktopExpandedCharGroups] = useState<Set<string>>(new Set());

  const toggleMobileCharGroup = useCallback((charName: string) => {
    setMobileExpandedCharGroups((prev) => {
      // Создаем новый Set с копией значений из предыдущего
      const newSet = new Set([...prev]);
      if (newSet.has(charName)) {
        newSet.delete(charName);
      } else {
        newSet.add(charName);
      }
      return newSet;
    });
  }, []);

  const toggleDesktopCharGroup = useCallback((charName: string) => {
    setDesktopExpandedCharGroups((prev) => {
      const newSet = new Set([...prev]);
      if (newSet.has(charName)) {
        newSet.delete(charName);
      } else {
        newSet.add(charName);
      }
      return newSet;
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen notion-page">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center notion-fade-in">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4 text-slate-500" />
            <p className="notion-text-small">{t('common.loading')}</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen notion-page">
      <Header />
      <main className="flex-grow">
        {/* Hero Section - современный минималистичный дизайн */}
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          {/* Фоновое изображение */}
          <div className="absolute inset-0">
            <HeroImage />
          </div>

          <div className="container relative z-10 mx-auto px-4 lg:px-6">
            <div className="max-w-4xl relative">
              {/* Local backdrop for text readability */}
              <div className="absolute -inset-6 sm:-inset-8 lg:-inset-10 bg-gradient-to-r from-background/90 via-background/80 to-background/40 backdrop-blur-sm rounded-3xl -z-10" />
              
              {/* Логотип */}
              <div className="mb-8 flex justify-start">
                <div className="relative">
                  <Image
                    src="/Logo-main.webp"
                    alt="Venorus Logo"
                    width={240}
                    height={96}
                    priority
                    className="h-20 sm:h-24 lg:h-32 w-auto drop-shadow-lg"
                  />
                </div>
              </div>


              {/* Заголовок */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                <span className="text-foreground drop-shadow-lg">{t('common.products')}</span>
                <br />
                <span className="text-primary drop-shadow-lg">
                  {t('hero.forVenezuela')}
                </span>
                <br />
                <span className="text-foreground/80 drop-shadow-lg">{t('hero.qualityTraditions')}</span>
              </h1>

              {/* Описание */}
              <p className="text-lg text-foreground/70 leading-relaxed mb-8 max-w-2xl drop-shadow">
                {(siteSettings as any)?.heroSubtitle && (siteSettings as any)?.heroSubtitle.trim() !== "Subtítulo de prueba"
                  ? (siteSettings as any).heroSubtitle
                  : t('hero.defaultSubtitle')}
              </p>

              {/* Кнопка */}
              <Button
                onClick={scrollToCatalog}
                size="lg"
                className="h-12 px-8"
              >
                {t('hero.seeProducts')}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>


        {/* Products Section */}
        <section id="products" className="py-16">
          <div className="container mx-auto px-4 lg:px-6">
            {/* Заголовок секции */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm font-medium text-primary">{t('hero.catalogTitle')}</span>
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Venorus Catalog 2025
              </h2>

              {/* Кнопки скачать каталог */}
              <CatalogDownloadButtons />
            </div>

            {/* Search and Controls */}
            <div className="bg-card rounded-xl border p-6 mb-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <SearchBar onSearch={handleSearch} />
                  <SortDropdown onSort={handleSort} currentSort={sortBy} />
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <ViewToggle view={view} onViewChange={handleViewChange} />
                  <div className="lg:hidden flex gap-2">
                    {/* Кнопка Категории */}
                    <Drawer open={isCategoryDrawerOpen} onOpenChange={setIsCategoryDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={activeCategory !== "All" && activeCategory !== "Todas las categorías" ? "border-primary bg-primary/5" : ""}
                        >
                          <ChevronRight className="w-4 h-4 mr-2" />
                          <span>{t('hero.categories')}</span>
                          {activeCategory !== "All" && activeCategory !== "All categories" && (
                            <span className="ml-1 px-1.5 py-0.5 text-2xs bg-primary text-primary-foreground rounded-full">1</span>
                          )}
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[80vh]">
                        <DrawerHeader className="pb-2">
                          <DrawerTitle className="text-xl font-semibold">
                            {t('hero.categories')}
                          </DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 overflow-y-auto">
                          <CategorySidebarComponent />
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Кнопка Фильтры */}
                    <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={Object.keys(appliedFilters.characteristics).length > 0 ? "border-primary bg-primary/5" : ""}
                        >
                          <Filter className="w-4 h-4 mr-2" />
                          <span>{t('hero.filters')}</span>
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-2xs bg-primary text-primary-foreground rounded-full">
                              {Object.values(appliedFilters.characteristics).flat().length}
                            </span>
                          )}
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[80vh]">
                        <DrawerHeader className="pb-2">
                          <DrawerTitle className="text-xl font-semibold">
                            {t('hero.filters')}
                          </DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 overflow-y-auto">
                          <div className="space-y-4">
                            {/* Активные фильтры */}
                            {Object.keys(appliedFilters.characteristics).length > 0 && (
                                <div className="bg-muted rounded-lg p-3 border">
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium">{t('hero.activeFilters')}</h4>
                                    <button
                                      onClick={clearCharacteristicFilters}
                                      className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-md bg-background hover:bg-accent transition-colors"
                                    >
                                      {t('hero.clearAll')}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(appliedFilters.characteristics).map(([charName, values]) =>
                                      values.map((value) => (
                                        <button
                                          key={`${charName}-${value}`}
                                          onClick={() => handleCharacteristicFilterChange(charName, value, false)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                                        >
                                          {charName}: {value}
                                          <X className="w-3 h-3" />
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Список характеристик */}
                              {isLoadingCharacteristics ? (
                                <div className="space-y-4">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className="border rounded-lg p-3 bg-card animate-pulse">
                                      <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                                      <div className="h-3 bg-muted rounded w-full mb-1"></div>
                                      <div className="h-3 bg-muted rounded w-3/4"></div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                availableCharacteristics.map((characteristic) => (
                                  <div key={characteristic.name} className="border border-sky-200/30 rounded-lg p-3 bg-white/50">
                                    <button
                                      onClick={() => toggleMobileCharGroup(characteristic.name)}
                                      className="flex items-center justify-between w-full text-left mb-2"
                                    >
                                      <h4 className="text-sm font-medium text-slate-700">{characteristic.name}</h4>
                                    {mobileExpandedCharGroups.has(characteristic.name) ?
                                        <ChevronUp className="w-4 h-4 text-sky-600" /> :
                                        <ChevronDown className="w-4 h-4 text-sky-600" />
                                      }
                                    </button>

                                    {mobileExpandedCharGroups.has(characteristic.name) && (
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {(characteristic.values || []).map((valueObj: any, index: number) => (
                                          <label
                                            key={`${characteristic.name}-${index}`}
                                            className="flex items-center gap-2 text-sm cursor-pointer hover:text-sky-700 transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value) || false}
                                              onChange={(e) => handleCharacteristicFilterChange(characteristic.name, valueObj.value, e.target.checked)}
                                              className="h-4 w-4 text-sky-600 border-sky-300 rounded focus:ring-sky-500 focus:ring-1"
                                            />
                                            <span className="flex-1">{valueObj.value}</span>
                                            <span className="text-sky-500/70 bg-sky-100/40 px-1.5 py-0.5 rounded text-xs">
                                              {valueObj.productCount}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                          </div>

                          {/* Кнопка применения фильтров */}
                          <div className="mt-6 flex justify-end">
                            <Button
                              onClick={() => setIsFilterDrawerOpen(false)}
                              className="bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white"
                            >
                              {t('common.apply')}
                            </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </div>
                </div>
              </div>
              
              {/* Активные фильтры для мобильной версии */}
              {(activeCategory !== "All" && activeCategory !== "Todas las categorías" || Object.keys(appliedFilters.characteristics).length > 0) && (
                <div className="lg:hidden mt-3 space-y-2">
                  {/* Выбранная категория */}
                  {activeCategory !== "All" && activeCategory !== "All categories" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-600 font-medium">Categoría:</span>
                      <button
                        onClick={() => handleCategoryChange("All")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 transition-colors"
                      >
                        {activeCategory}
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  
                  {/* Выбранные характеристики */}
                  {Object.keys(appliedFilters.characteristics).length > 0 && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs text-slate-600 font-medium">{t('hero.filters')}:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(appliedFilters.characteristics).slice(0, 3).map(([charKey, values]: [string, any]) => {
                          // Извлекаем название характеристики из ключа
                          const charName = charKey.includes(':') ? charKey.split(':')[1] : charKey;
                          return values.slice(0, 1).map((value: string) => (
                            <button
                              key={`${charKey}-${value}`}
                              onClick={() => handleCharacteristicFilterChange(charKey, value, false)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 transition-colors"
                            >
                              {charName}: {value}
                              <X className="w-2.5 h-2.5" />
                            </button>
                          ));
                        })}
                        {Object.values(appliedFilters.characteristics).flat().length > 3 && (
                          <button
                            onClick={() => setIsFilterDrawerOpen(true)}
                            className="inline-flex items-center px-2 py-0.5 text-xs bg-sky-50 text-sky-600 rounded-full hover:bg-sky-100 transition-colors"
                          >
                            +{Object.values(appliedFilters.characteristics).flat().length - 3} еще
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-6 xl:gap-8">
              {/* Desktop Sidebar - российская цветовая схема */}
              <div className="hidden lg:block lg:w-64 xl:w-72 2xl:w-80 3xl:w-96 lg:flex-shrink-0">
                <div className="sticky top-6">
                  <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-sky-200/35 shadow-lg shadow-sky-100/15 overflow-hidden">
                    <div className="bg-gradient-to-r from-sky-100/40 to-blue-100/40 p-6 border-b border-sky-200/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-700 bg-clip-text text-transparent">
                          {sidebarMode === 'categories' ? t('hero.categories') : t('hero.filters')}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSidebarMode('categories')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                            sidebarMode === 'categories'
                              ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-200/30'
                              : 'bg-white/50 text-sky-700 hover:bg-sky-50 border border-sky-200/40'
                          }`}
                        >
                          {t('hero.categories')}
                        </button>
                        <button
                          onClick={() => setSidebarMode('filters')}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                            sidebarMode === 'filters'
                              ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-200/30'
                              : 'bg-white/50 text-sky-700 hover:bg-sky-50 border border-sky-200/40'
                          }`}
                        >
                          <Filter className="w-4 h-4" />
                          {t('hero.filters')}
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs bg-white/30 rounded-full">
                              {Object.values(appliedFilters.characteristics).flat().length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      {sidebarMode === 'categories' ? (
                        <CategorySidebarComponent />
                      ) : (
                        <div className="space-y-4">
                          {/* Активные фильтры */}
                          {Object.keys(appliedFilters.characteristics).length > 0 && (
                            <div className="bg-sky-50/40 rounded-lg p-3 border border-sky-200/30">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-medium text-slate-700">{t('hero.activeFilters')}</h4>
                                <button
                                  onClick={clearCharacteristicFilters}
                                  className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-1 rounded-full bg-sky-100/50 hover:bg-sky-200/50 transition-all duration-200"
                                >
                                  Очистить все
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(appliedFilters.characteristics).map(([charName, values]) =>
                                  values.map((value) => (
                                    <button
                                      key={`${charName}-${value}`}
                                      onClick={() => handleCharacteristicFilterChange(charName, value, false)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 transition-colors"
                                    >
                                      {charName}: {value}
                                      <X className="w-3 h-3" />
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* Список характеристик */}
                          {isLoadingCharacteristics ? (
                            <div className="space-y-4">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="border border-sky-200/30 rounded-lg p-3 bg-white/50 animate-pulse">
                                  <div className="h-4 bg-sky-100/50 rounded w-24 mb-2"></div>
                                  <div className="h-3 bg-sky-50/50 rounded w-full mb-1"></div>
                                  <div className="h-3 bg-sky-50/50 rounded w-3/4"></div>
                                </div>
                              ))}
                            </div>
                          ) : availableCharacteristics.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-8">
                              {t('category.chooseCategoryForFilters')}
                            </div>
                          ) : (
                            availableCharacteristics.map((characteristic) => (
                              <div key={characteristic.name} className="border border-sky-200/30 rounded-lg p-3 bg-white/50">
                                <button
                                  onClick={() => toggleDesktopCharGroup(characteristic.name)}
                                  className="flex items-center justify-between w-full text-left mb-2"
                                >
                                  <h4 className="text-sm font-medium text-slate-700">{characteristic.name}</h4>
                                  {desktopExpandedCharGroups.has(characteristic.name) ?
                                    <ChevronUp className="w-4 h-4 text-sky-600" /> :
                                    <ChevronDown className="w-4 h-4 text-sky-600" />
                                  }
                                </button>

                                {desktopExpandedCharGroups.has(characteristic.name) && (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {(characteristic.values || []).map((valueObj: any, index: number) => (
                                      <label
                                        key={`${characteristic.name}-${index}`}
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-sky-700 transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={appliedFilters.characteristics[characteristic.name]?.includes(valueObj.value) || false}
                                          onChange={(e) => handleCharacteristicFilterChange(characteristic.name, valueObj.value, e.target.checked)}
                                          className="h-3 w-3 text-sky-600 border-sky-300 rounded focus:ring-sky-500 focus:ring-1"
                                        />
                                        <span className="flex-1 truncate">{valueObj.value}</span>
                                        {valueObj.product_count && (
                                          <span className="text-sky-500/70 bg-sky-100/40 px-1.5 py-0.5 rounded text-xs">
                                            {valueObj.product_count}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Grid с российской цветовой схемой */}
              <div className="flex-1 min-w-0">

                <div className="bg-white/45 backdrop-blur-sm rounded-2xl border border-sky-200/25 p-6 shadow-sm">
                  <ProductGrid
                    products={displayedProducts}
                    view={view}
                    onQuickView={handleQuickView}
                    isLoading={isLoading || (allProducts.length === 0 && !filteredProducts.length)}
                  />
                </div>

                {/* Infinite Scroll Trigger - российская цветовая схема */}
                <div ref={loadMoreRef} className="mt-8">
                  {isLoadingMore && (
                    <div className="text-center py-8">
                      <div className="bg-white/65 backdrop-blur-lg rounded-2xl border border-sky-200/35 p-6 shadow-lg shadow-sky-100/15 max-w-sm mx-auto">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-sky-500" />
                        <p className="text-sky-700 font-medium">{t('hero.loadingMore')}</p>
                      </div>
                    </div>
                  )}

                  {!hasMore && filteredProducts.length > 0 && (
                    <div className="text-center py-8">
                      <div className="bg-gradient-to-r from-sky-50 to-blue-50 backdrop-blur-lg rounded-2xl border border-sky-200/35 p-6 shadow-lg shadow-sky-100/15 max-w-sm mx-auto">
                        <p className="text-sky-700 font-medium">{t('hero.allLoaded')}</p>
                        <div className="w-16 h-1 bg-gradient-to-r from-sky-400 to-blue-500 rounded-full mx-auto mt-3"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick View Modal */}
        <ProductQuickView
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onProductChange={handleProductChange}
          allProducts={adaptedProducts}
        />

        <Footer />
      </main>
    </div>
  )
}
