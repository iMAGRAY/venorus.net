"use client"
import { SafeImage } from "@/components/safe-image"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/admin/admin-layout"
import { ProductFormModern } from "@/components/admin/product-form-modern"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ProductsFilters, { ProductAdminFilters } from "@/components/admin/products-filters"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Edit, Trash2, Download, ChevronLeft, ChevronRight, Shield, Package } from "lucide-react"
import { useAdminStore } from "@/lib/stores"
import type { Product } from "@/lib/api/types"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { useAuth } from "@/components/admin/auth-guard"

export default function ProductsAdmin() {
  const router = useRouter()
  const { authStatus: _authStatus, hasPermission } = useAuth()
  
  // Используем новый store с правильными селекторами
  const products = useAdminStore(state => state.products)
  const isLoading = useAdminStore(state => state.loading.products)
  const error = useAdminStore(state => state.errors.products)
  const isInitialized = useAdminStore(state => state.initialized.products)
  const updateProduct = useAdminStore(state => state.updateProduct)
  const deleteProduct = useAdminStore(state => state.deleteProduct)
  const initializeProducts = useAdminStore(state => state.initializeProducts)
  const refreshProducts = useAdminStore(state => state.refreshProducts)

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [adminFilters, setAdminFilters] = useState<ProductAdminFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const ROWS_PER_PAGE = 50

  // Проверяем права доступа
  const canViewProducts = hasPermission('products.view') || hasPermission('products.*') || hasPermission('*')
  const canCreateProducts = hasPermission('products.create') || hasPermission('products.*') || hasPermission('*')
  const canUpdateProducts = hasPermission('products.update') || hasPermission('products.*') || hasPermission('*')
  const canDeleteProducts = hasPermission('products.delete') || hasPermission('products.*') || hasPermission('*')

  // Простая инициализация данных без циклических вызовов
  useEffect(() => {
    if (!isInitialized && canViewProducts) {
      initializeProducts()
    }
  }, [isInitialized, canViewProducts, initializeProducts])

  // Сбрасываем страницу при изменении поиска
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Мемоизированная фильтрация для оптимизации
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const p = product as any // Type assertion для расширенных полей
      
      // search
      const searchMatch = searchQuery
        ? (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category_name || p.category || "").toLowerCase().includes(searchQuery.toLowerCase())
        : true

      if (!searchMatch) return false

      // manufacturer
      if (adminFilters.manufacturer) {
        const man = p.manufacturer_name || p.manufacturer
        if (man !== adminFilters.manufacturer) return false
      }

      // model line
      if (adminFilters.modelLine) {
        const ml = p.model_line_name || p.modelLine
        if (ml !== adminFilters.modelLine) return false
      }

      // category
      if (adminFilters.category) {
        const cat = p.category_name || p.category
        if (cat !== adminFilters.category) return false
      }

      // price
      if (adminFilters.priceFrom !== undefined) {
        const price = product.price || product.discount_price || 0
        if (price < adminFilters.priceFrom) return false
      }
      if (adminFilters.priceTo !== undefined) {
        const price = product.price || product.discount_price || 0
        if (price > adminFilters.priceTo) return false
      }

      return true
    })
  }, [products, searchQuery, adminFilters])

  // Мемоизированная пагинация
  const { pageCount, paginatedProducts } = useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(filteredProducts.length / ROWS_PER_PAGE))
    const paginatedProducts = filteredProducts.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE,
    )
    return { pageCount, paginatedProducts }
  }, [filteredProducts, currentPage])

  // Ранний возврат без прав — после хуков
  if (!canViewProducts) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Shield className="w-16 h-16 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Доступ запрещен</h2>
              <p className="text-gray-600 text-center">
                У вас нет прав для просмотра товаров
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    )
  }

  const handleSaveProduct = async (savedProduct: any) => {
    try {
      if (editingProduct) {
        await updateProduct(savedProduct.id, savedProduct)
      }

      setShowForm(false)
      setEditingProduct(undefined)
    } catch (error) {
      console.error('Error after saving product:', error)
      alert('Ошибка сохранения товара')
    }
  }

  const handleEditProduct = (product: Product) => {
    if (!canUpdateProducts) {
      alert('У вас нет прав для редактирования товаров')
      return
    }
    // Перенаправляем на отдельную страницу редактирования
    router.push(`/admin/products/${product.id}/edit`)
  }

  const handleDeleteProduct = async (productId: number) => {
    if (!canDeleteProducts) {
      alert('У вас нет прав для удаления товаров')
      return
    }

    if (confirm("Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.")) {
      try {
        await deleteProduct(productId)
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('Ошибка при удалении товара')
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingProduct(undefined)
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/products/export')
      if (!res.ok) {
        alert('Ошибка экспорта')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'products.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error', err)
      alert('Ошибка экспорта')
    }
  }

  if (showForm) {
    return (
      <AdminLayout>
        <ProductFormModern
          product={editingProduct}
          onSave={handleSaveProduct}
          onCancel={handleCancel}
        />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Товары</h1>
            <p className="text-slate-600 text-sm sm:text-base">Управление протезными изделиями</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-blue-200 text-blue-600 hover:bg-blue-50 h-10 sm:h-9"
            >
              <Download className="w-4 h-4 mr-2" />
              Экспорт
            </Button>

            {canCreateProducts && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white h-10 sm:h-9"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить товар
              </Button>
            )}
          </div>
        </div>

        {/* Фильтры */}
        <div className="mb-4 bg-white/60 backdrop-blur-sm border border-cyan-200/40 rounded-lg p-3 flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex flex-col gap-1 w-48">
            <label className="text-xs font-medium text-slate-600">Поиск</label>
            <div className="relative">
              <Input
                placeholder="Название / категория"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 h-9 text-xs bg-white/80"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600" />
            </div>
          </div>

          {/* Other filters */}
          <ProductsFilters products={products as any} value={adminFilters} onChange={setAdminFilters} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <CardTitle className="text-lg sm:text-xl">Все товары ({products.length})</CardTitle>
              {/* search removed */}
            </div>
          </CardHeader>
          <CardContent>
            {/* Состояние загрузки */}
            {isLoading && products.length === 0 && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-500">Загрузка товаров...</p>
              </div>
            )}

            {/* Состояние ошибки */}
            {error && (
              <div className="text-center py-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h3 className="text-red-800 font-medium">Ошибка загрузки</h3>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => refreshProducts()}
                  >
                    Повторить попытку
                  </Button>
                </div>
              </div>
            )}

            {/* Пустое состояние */}
            {!isLoading && !error && products.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-500">Товары не найдены</p>
                {canCreateProducts && (
                  <Button
                    onClick={() => setShowForm(true)}
                    className="mt-4 bg-blue-500 hover:bg-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первый товар
                  </Button>
                )}
              </div>
            )}

            {/* Отображение товаров */}
            {!isLoading && !error && products.length > 0 && (
              <>
                {/* Мобильная версия - карточки */}
                <div className="block lg:hidden space-y-4">
                  {paginatedProducts.map((product) => {
                    const p = product as any
                    return (
                    <Card key={product.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <SafeImage src={p.imageUrl || p.images?.[0] || PROSTHETIC_FALLBACK_IMAGE} alt={product.name} width={64} height={64} className="w-16 h-16 object-cover rounded-md border border-slate-200 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-medium text-sm leading-tight">{product.name}</h3>
                            <Badge
                              variant={p.inStock ? "default" : "destructive"}
                              className={`text-xs flex-shrink-0 ${
                                p.inStock ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                              }`}
                            >
                              {p.inStock ? 'Доступен на сайте' : 'Недоступен на сайте'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs flex-shrink-0 ${
                                p.stock_status === 'in_stock' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                p.stock_status === 'nearby_warehouse' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                p.stock_status === 'distant_warehouse' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                p.stock_status === 'on_order' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {p.stock_status === 'in_stock' && 'В наличии'}
                              {p.stock_status === 'nearby_warehouse' && 'Ближний склад'}
                              {p.stock_status === 'distant_warehouse' && 'Дальний склад'}
                              {p.stock_status === 'on_order' && 'Под заказ'}
                              {p.stock_status === 'out_of_stock' && 'Нет в наличии'}
                              {!p.stock_status && 'Статус склада неизвестен'}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {product.sku && (
                              <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
                                SKU: {product.sku}
                              </Badge>
                            )}
                            {p.article_number && (
                              <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
                                {p.article_number}
                              </Badge>
                            )}
                            {product.category && (
                              <Badge variant="outline" className="text-xs border-gray-200 text-gray-600">
                                {typeof product.category === 'string' ? product.category : p.category_name || 'Без категории'}
                              </Badge>
                            )}
                            {p.has_variants && typeof p.variants_count === 'number' && p.variants_count > 0 && (
                              <Badge variant="secondary" className="text-xs border-purple-200 text-purple-600">
                                {p.variants_count} вар.
                              </Badge>
                            )}
                          </div>

                          {product.price && (
                            <div className="mb-3">
                              <span className="font-medium text-slate-800 text-sm">
                                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.price)}
                              </span>
                              {product.discount_price && product.discount_price < product.price && (
                                <span className="text-green-600 text-xs ml-2">
                                  Скидка: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.discount_price)}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            {canUpdateProducts && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs flex-1"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Редактировать
                              </Button>
                            )}
                            {canDeleteProducts && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs flex-1"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Удалить
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                    )
                  })}
                </div>

                {/* Десктопная версия - таблица */}
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Фото</TableHead>
                        <TableHead>Название</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Артикул</TableHead>
                        <TableHead>Категория</TableHead>
                        <TableHead>Производитель</TableHead>
                        <TableHead>Модельный ряд</TableHead>
                        <TableHead>Цена</TableHead>
                        <TableHead>Наличие</TableHead>
                        <TableHead>Варианты</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((product) => {
                        const p = product as any
                        return (
                        <TableRow key={product.id}>
                          <TableCell className="w-16">
                            <SafeImage src={p.imageUrl || p.images?.[0] || PROSTHETIC_FALLBACK_IMAGE} alt={product.name} width={56} height={56} className="w-14 h-14 object-cover rounded-md border border-slate-200" />
                          </TableCell>
                          <TableCell className="font-medium max-w-[220px] truncate">{product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-200 text-blue-600">
                              {product.sku || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-200 text-blue-600">
                              {p.article_number || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-200 text-blue-600">
                              {typeof product.category === 'string' ? product.category : p.category_name || 'Без категории'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {p.manufacturer_name || product.manufacturer || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {p.model_line_name || p.modelLine || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {product.price ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-800">
                                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.price)}
                                  </span>
                                  {product.discount_price && product.discount_price < product.price && (
                                    <span className="text-green-600 text-xs">
                                      Скидка: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.discount_price)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={p.inStock ? "default" : "destructive"}
                                className={`text-xs ${
                                  p.inStock ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                                }`}
                              >
                                {p.inStock ? 'Доступен на сайте' : 'Недоступен на сайте'}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  p.stock_status === 'in_stock' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  p.stock_status === 'nearby_warehouse' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                  p.stock_status === 'distant_warehouse' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                  p.stock_status === 'on_order' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                  'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                {p.stock_status === 'in_stock' && 'В наличии'}
                                {p.stock_status === 'nearby_warehouse' && 'Ближний склад'}
                                {p.stock_status === 'distant_warehouse' && 'Дальний склад'}
                                {p.stock_status === 'on_order' && 'Под заказ'}
                                {p.stock_status === 'out_of_stock' && 'Нет в наличии'}
                                {!p.stock_status && 'Статус склада неизвестен'}
                              </Badge>
                              {product.stock_quantity && product.stock_quantity > 0 && (
                                <span className="text-xs text-gray-500">
                                  {product.stock_quantity} шт.
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {p.has_variants && typeof p.variants_count === 'number' && p.variants_count > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {p.variants_count} вар.
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">Нет вариантов</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <div className="flex space-x-2">
                                {canUpdateProducts && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditProduct(product)}
                                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Редактировать
                                  </Button>
                                )}
                                {canDeleteProducts && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Удалить
                                  </Button>
                                )}
                              </div>
                              {canUpdateProducts && (
                                                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/admin/products/${product.id}/variants`)}
                                    className="border-green-200 text-green-600 hover:bg-green-50 w-full"
                                  >
                                    <Package className="w-4 h-4 mr-1" />
                                    Варианты товара
                                  </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination controls */}
                {pageCount > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-slate-600">
                      Страница {currentPage} из {pageCount}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === pageCount}
                        onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
