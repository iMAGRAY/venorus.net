"use client"

import type React from "react"
import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Prosthetic } from "@/lib/data"
import { Eye } from "lucide-react"
import { InstantLink } from "@/components/instant-link"
import { getProductImageSrc } from "@/lib/product-image-utils"
import { useCart } from "@/lib/cart-context"
import { getActualPrice } from "@/lib/utils"
import Link from "next/link"
import { ProductTagsDisplay } from "@/components/product-tags-display"
import { useI18n } from "@/components/i18n-provider"

interface ProductCardSimpleProps {
  product: Prosthetic & {
    variants?: Array<{
      id: number
      price?: number
      discountPrice?: number
      isAvailable: boolean
    }>
  }
  onQuickView: (product: Prosthetic) => void
  className?: string
}

export function ProductCardSimple({ product, onQuickView, className = "" }: ProductCardSimpleProps) {
  const { t } = useI18n()
  const { addItem } = useCart()
  const { items } = useCart()

  const inCart = items.some((item) => item.id === product.id)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    addItem({
      id: String(product.id),
      name: product.name,
      price: getActualPrice(product),
      image_url: getProductImageSrc(product),
      category: product.category_name || product.category || '',
      sku: product.sku || '',
      article_number: product.article_number || '',
      is_on_request: product.show_price === false || (!product.price && !product.discount_price),
      show_price: product.show_price
    })
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onQuickView(product)
  }

  const handleQuickViewTouch = (e: React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onQuickView(product)
  }

  return (
    <div className={`group relative ${className}`}>
      {/* Чистый фон без ярких градиентов */}
      <div className="absolute inset-0 rounded-xl"></div>

      <div className="relative flex flex-col h-full min-h-[350px] overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">

        {/* Изображение */}
        <div className="relative w-full aspect-square bg-slate-50 overflow-hidden">
          <SafeImage
            src={getProductImageSrc(product)}
                            alt={product.short_name || product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
          />

          {/* Лёгкая маска при ховере */}
          <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />


          {/* Кнопка быстрого просмотра */}
          <div className="absolute top-3 right-3">
            <button
              onClick={handleQuickView}
              onTouchEnd={handleQuickViewTouch}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-blue-200/50 text-blue-700 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:scale-110 touch-manipulation"
              aria-label="Быстрый просмотр"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Статус наличия - скрыто, так как все товары доступны для заказа */}
          {/* {isProductOutOfStock(product) && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
              <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 px-4 py-2 text-sm font-medium shadow-lg">
                Agotado
              </Badge>
            </div>
          )} */}
        </div>

        {/* Серая линия между изображением и контентом */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>

        {/* Контент */}
        <div className="flex flex-col flex-grow p-3">
          {/* Заголовок - ссылка на страницу товара */}
          <InstantLink
            href={`/products/${product.id}`}
            className="block text-base sm:text-base font-medium text-slate-900 line-clamp-2 mb-2 min-h-[2.5rem] leading-tight hover:text-slate-700 transition-colors touch-manipulation"
          >
            {product.short_name || product.name}
          </InstantLink>

          {/* Categoría */}
          <div className="mb-3">
            <Badge
              variant="outline"
              className="text-xs border-slate-200 text-slate-600 bg-slate-50"
            >
              {product.category_name || product.category}
            </Badge>
          </div>

          {/* Теги товара */}
          <ProductTagsDisplay 
            productId={parseInt(String(product.id))} 
            variant="compact" 
            maxTags={2}
            className="mb-3"
          />

          {/* Precio */}
          <div className="mb-3 flex-grow flex items-end">
            {(() => {
              // Если есть варианты, показываем диапазон цен
              if (product.variants && product.variants.length > 0) {
                const availableVariants = product.variants.filter(v => v.isAvailable)
                if (availableVariants.length === 0) {
                  return <span className="text-base font-bold text-slate-600">{t('product.outOfStock')}</span>
                }
                
                const prices = availableVariants.map(v => v.discountPrice || v.price || 0).filter(p => p > 0)
                if (prices.length === 0) {
                  return <span className="text-base font-bold text-slate-600">{t('product.onRequest')}</span>
                }
                
                const minPrice = Math.min(...prices)
                const maxPrice = Math.max(...prices)
                
                if (minPrice === maxPrice) {
                  return (
                      <span className="text-base font-bold text-slate-900 truncate block">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0
                        }).format(minPrice)}
                      </span>
                  )
                } else {
                  return (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">от</span>
                      <span className="text-base font-bold text-slate-900 truncate block">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0
                        }).format(minPrice)}
                      </span>
                    </div>
                  )
                }
              }
              
              // Стандартная логика для товаров без вариантов
              if (product.show_price === false || (!product.price && !product.discount_price)) {
                return <span className="text-base font-bold text-slate-600">{t('product.onRequest')}</span>
              } else if (product.price || product.discount_price) {
                if (product.discount_price && product.price && product.discount_price < product.price) {
                  return (
                    <div className="space-y-1">
                      <span className="text-base font-bold text-slate-900 truncate block">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0
                        }).format(product.discount_price)}
                      </span>
                      <span className="text-xs line-through text-slate-400 truncate block">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0
                        }).format(product.price)}
                      </span>
                    </div>
                  )
                } else {
                  return (
                    <span className="text-base font-bold text-slate-800 truncate block">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0
                      }).format((product.price || product.discount_price) ?? 0)}
                    </span>
                  )
                }
              } else {
                return <span className="text-base font-bold text-slate-600">{t('product.onRequest')}</span>
              }
            })()}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            {/* Кнопка добавления в заявку */}
            {!inCart && (
              <Button
                onClick={handleAddToCart}
                size="sm"
                className="flex-1 h-8 sm:h-9 bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 rounded-lg text-xs"
              >
                {t('product.addToCart')}
              </Button>
            )}

            {inCart && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const btn = document.getElementById('cart-button') as HTMLButtonElement | null
                  btn?.click()
                }}
                className="flex-1 h-8 sm:h-9 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors rounded-lg text-xs"
              >
                {t('product.inCart')}
              </Button>
            )}

            {/* Кнопка подробнее - переход на страницу товара */}
            <Link
              href={`/products/${product.id}`}
              className="flex-1 h-8 sm:h-9 inline-flex items-center justify-center bg-gradient-to-r from-sky-400 to-sky-600 hover:from-sky-500 hover:to-sky-700 text-white shadow-sm rounded-lg transition-all duration-300 text-xs font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {t('product.details')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
