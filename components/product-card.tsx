"use client"

import type React from "react"

import { SafeImage } from "@/components/safe-image"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Prosthetic } from "@/lib/data"
import { Package, Clock, ChevronLeft, ChevronRight, Eye, Layers, Grid3X3 } from "lucide-react"
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { useState } from "react"
import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import { InstantLink } from "@/components/instant-link"
import { useCart } from "@/lib/cart-context"
import { isProductOutOfStock, isProductAvailable, getActualPrice, formatProductName } from "@/lib/utils"
import { ProductTagsDisplay } from "@/components/product-tags-display"
import { useI18n } from "@/components/i18n-provider"

interface ProductCardProps {
  product: Prosthetic
  onQuickView: (product: Prosthetic) => void
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const { t } = useI18n()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const { addItem } = useCart()
  const { items } = useCart()


  const inCart = items.some((item) => item.id === product.id)

  // Приоритет: галерея изображений, затем главное изображение
  const images = product.images && product.images.length > 0
    ? product.images
    : (product.imageUrl ? [product.imageUrl] : [])

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="group relative">
      {/* Упрощённый чистый фон */}
      <div className="absolute inset-0 rounded-2xl"></div>

      <Card className="relative flex flex-col h-full min-h-[400px] sm:min-h-[500px] overflow-hidden bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">

        <CardHeader className="p-0 relative overflow-hidden rounded-t-2xl">
          <div className="relative w-full aspect-square bg-slate-50">
            <SafeImage
              src={images[currentImageIndex] || PROSTHETIC_FALLBACK_IMAGE}
              alt={product.short_name || product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
            />

            {/* Лёгкая затемняющая маска при ховере */}
            <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Навигация по изображениям */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-blue-200/50 text-blue-700 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-blue-200/50 text-blue-700 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Индикаторы изображений */}
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        index === currentImageIndex
                          ? "bg-gradient-to-r from-sky-400 to-blue-400 scale-125"
                          : "bg-white/70 hover:bg-white/90 hover:scale-110"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Бейджи происхождения и доставки */}
            <div className="absolute top-3 left-3 flex gap-1">
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/90 border border-slate-200 text-slate-700 shadow-sm">🇷🇺 Hecho en Rusia</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/90 border border-slate-200 text-slate-700 shadow-sm hidden sm:inline">🇻🇪 Entrega</span>
            </div>

            {/* Кнопка быстрого просмотра */}
            <div className="absolute top-3 right-3">
              <button
                onClick={() => onQuickView(product)}
                className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-blue-200/50 text-blue-700 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:scale-110"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Статус наличия */}
            {isProductOutOfStock(product) && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 px-4 py-2 text-sm font-medium shadow-lg">
                  {t('product.outOfStock')}
                </Badge>
              </div>
            )}

          </div>
        </CardHeader>

        {/* Разделительная линия */}
        <div className="w-full h-px bg-slate-200"></div>

        <CardContent className="flex flex-col flex-grow p-1 sm:p-4 relative">
          {/* Заголовок */}
          <InstantLink href={`/products/${product.id}`} prefetch={true}>
            <CardTitle className="mb-1 sm:mb-2 text-sm md:text-lg font-semibold line-clamp-2 transition-all duration-200 cursor-pointer leading-tight text-slate-900 hover:text-slate-700">
              {formatProductName(product.short_name || product.name)}
            </CardTitle>
          </InstantLink>

          {/* Основные параметры - компактный вид на мобильных, расширенный на десктопе */}
          {(product.weight || product.batteryLife || product.modelLine || product.category) && (
            <>
              {/* Мобильный вид - как в режиме списка */}
              <div className="flex flex-wrap items-center gap-2 mb-1 text-xs sm:hidden">
                {product.weight && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Package className="w-3 h-3" />
                    <span>{product.weight}</span>
                  </div>
                )}
                {product.batteryLife && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-3 h-3" />
                    <span>{product.batteryLife}</span>
                  </div>
                )}
                {product.modelLine && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Layers className="w-3 h-3" />
                    <span>{product.modelLine}</span>
                  </div>
                )}
                {product.category && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Grid3X3 className="w-3 h-3" />
                    <span>{product.category}</span>
                  </div>
                )}
                {/* Отображение количества вариантов */}
                {product.has_variants && product.variants_count && product.variants_count > 0 && (
                  <Badge className="bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0.5">
                    <Layers className="w-2.5 h-2.5 mr-0.5" />
                    {product.variants_count + 1} var.
                  </Badge>
                )}
              </div>

              {/* Десктопный вид - как раньше */}
              <div className="hidden sm:flex flex-wrap items-center gap-3 mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                {product.weight && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{product.weight}</span>
                  </div>
                )}
                {product.batteryLife && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{product.batteryLife}</span>
                  </div>
                )}
                {product.modelLine && (
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-slate-700">{product.modelLine}</span>
                  </div>
                )}
                {product.category && (
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-700">{product.category}</span>
                  </div>
                )}
                {/* Отображение количества вариантов */}
                {product.has_variants && product.variants_count && product.variants_count > 0 && (
                  <Badge className="bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 border border-blue-200 text-xs px-2 py-1">
                    <Layers className="w-3 h-3 mr-1" />
                    {product.variants_count + 1} {(product.variants_count + 1) === 1 ? 'variante' : 'variantes'}
                  </Badge>
                )}
              </div>
            </>
          )}

          {/* Теги товара */}
          <ProductTagsDisplay 
            productId={parseInt(String(product.id))} 
            variant="compact" 
            maxTags={3}
            className="mb-2"
          />

          {/* Precio y estado del almacén */}
          <div className="space-y-1 sm:space-y-2">
            {/* Precio */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              {product.show_price === false || (!product.price && !product.discount_price) ? (
                <span className="text-base sm:text-xl font-bold text-slate-600">
                  {t('product.onRequest')}
                </span>
              ) : (product.price || product.discount_price) ? (
                product.discount_price && product.price && product.discount_price < product.price ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-base sm:text-xl font-bold text-slate-900 truncate">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0
                      }).format(product.discount_price)}
                    </span>
                    <span className="text-xs sm:text-sm line-through text-slate-400 truncate">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0
                      }).format(product.price)}
                    </span>
                  </div>
                ) : (
                  <span className="text-base sm:text-xl font-bold text-slate-900 truncate">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0
                    }).format((product.price || product.discount_price) ?? 0)}
                  </span>
                )
              ) : (
                <span className="text-base sm:text-xl font-bold text-slate-600">{t('product.onRequest')}</span>
              )}
            </div>

            {/* Статус склада */}

          </div>

        </CardContent>

        <CardFooter className="p-2 sm:p-3 pt-0">
          <div className="flex gap-2 w-full">
            {/* Кнопка "Подробнее" */}
            <InstantLink href={`/products/${product.id}`} className="flex-1" prefetch={true}>
              <Button
                disabled={false}
                size="sm"
                className={`w-full h-8 sm:h-9 text-xs font-medium rounded-lg transition-all duration-300 ${
                  isProductAvailable(product)
                    ? 'bg-gradient-to-r from-sky-400 to-sky-600 hover:from-sky-500 hover:to-sky-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200'
                }`}
              >
                {isProductAvailable(product) ? (
                  <span className="flex items-center gap-1 justify-center">
                    <Eye className="w-3 h-3" />
                    <span className="hidden sm:inline">{t('product.details')}</span>
                    <span className="sm:hidden">Ver</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 justify-center">
                    <CloseIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">{t('product.outOfStock')}</span>
                    <span className="sm:hidden">N/D</span>
                  </span>
                )}
              </Button>
            </InstantLink>

            {/* Кнопка добавления в заявку */}
            {isProductAvailable(product) && !inCart && (
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  addItem({
                    id: String(product.id),
                    name: product.name,
                    price: getActualPrice(product),
                    image_url: product.imageUrl || '',
                    category: product.category,
                    sku: product.sku || '',
                    article_number: product.article_number || '',
                    is_on_request: product.show_price === false || (!product.price && !product.discount_price),
                    show_price: product.show_price
                  })
                }}
                size="sm"
                className="flex-1 h-8 sm:h-9 bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 rounded-lg"
              >
                <span className="text-xs flex items-center gap-1 justify-center">
                  <AssignmentIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('product.addToCart')}</span>
                  <span className="sm:hidden">+</span>
                </span>
              </Button>
            )}
            
            {/* Кнопка "В заявке" */}
            {inCart && (
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  const btn = document.getElementById('cart-button') as HTMLButtonElement | null
                  btn?.click()
                }}
                size="sm"
                variant="outline"
                className="flex-1 h-8 sm:h-9 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors rounded-lg"
              >
                <span className="flex items-center gap-1 justify-center text-xs">
                  <CheckIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('product.inCart')}</span>
                  <span className="sm:hidden">✓</span>
                </span>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
