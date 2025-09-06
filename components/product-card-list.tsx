"use client"

import { SafeImage } from "@/components/safe-image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Prosthetic } from "@/lib/data"
import { Package, Clock, Eye, Layers, Grid3X3 } from "lucide-react"
import { getProductImageSrc } from "@/lib/product-image-utils"
import { isProductOutOfStock, isProductAvailable, getActualPrice, formatProductName } from "@/lib/utils"
import { useCart } from "@/lib/cart-context"
import { ProductTagsDisplay } from "@/components/product-tags-display"

interface ProductCardListProps {
  product: Prosthetic
  onQuickView: (product: Prosthetic) => void
}

export function ProductCardList({ product, onQuickView }: ProductCardListProps) {
  const { addItem } = useCart()

  return (
    <div className="group relative">
      {/* Фоновый градиент */}
      <div className="absolute inset-0 bg-gradient-to-r from-sky-100/30 to-blue-100/40 rounded-2xl blur-sm transform group-hover:scale-[1.02] transition-transform duration-300"></div>

      <Card className="relative overflow-hidden min-h-[120px] bg-white/90 backdrop-blur-lg border border-blue-200/50 shadow-lg shadow-blue-100/20 hover:shadow-xl hover:shadow-blue-200/30 transition-all duration-300 hover:border-blue-300/60 rounded-2xl">
        <CardContent className="p-0 relative">
          <div className="flex flex-col sm:flex-row">
            {/* Секция изображения */}
            <div className="relative w-full aspect-square sm:w-64 sm:h-64 flex-shrink-0 overflow-hidden rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none bg-gradient-to-br from-sky-50 to-blue-50">
              <SafeImage
                src={getProductImageSrc(product)}
                alt={product.short_name || product.name}
                fill
                sizes="(max-width: 640px) 100vw, 256px"
                className="object-contain sm:object-contain object-cover transition-all duration-700 ease-out group-hover:scale-105 p-1 sm:p-2"
              />

              {/* Элегантный overlay градиент */}
              <div className="absolute inset-0 bg-gradient-to-t from-sky-900/20 via-transparent to-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Кнопка быстрого просмотра */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => onQuickView(product)}
                  className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-blue-700 hover:bg-blue-50 hover:scale-110 transition-all duration-300 shadow-lg border border-blue-200/50"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Статус наличия */}
              {/* Оверлей "Нет в наличии" */}
              {isProductOutOfStock(product) && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                  <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 px-4 py-2 text-sm font-medium shadow-lg">
                    Agotado
                  </Badge>
                </div>
              )}
            </div>

            {/* Серая линия между изображением и названием */}
            <div className="hidden sm:block w-px h-full bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>

            {/* Información básica */}
            <div className="flex-1 space-y-1 sm:space-y-2 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${product.id}`} className="block">
                    <h3 className="font-bold text-base sm:text-lg md:text-xl text-slate-800 line-clamp-2 hover:text-blue-700 transition-colors duration-200 mb-1" style={{ wordWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'normal' }}>
                      {formatProductName(product.short_name || product.name)}
                    </h3>
                  </Link>

                  {/* Основные параметры в компактном виде */}
                  {(product.weight || product.batteryLife || product.modelLine || product.category) && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-1 text-xs sm:text-sm">
                      {product.weight && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{product.weight}</span>
                        </div>
                      )}
                      {product.batteryLife && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{product.batteryLife}</span>
                        </div>
                      )}
                      {product.modelLine && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Layers className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{product.modelLine}</span>
                        </div>
                      )}
                      {product.category && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{product.category}</span>
                        </div>
                      )}
                      {/* Отображение количества вариантов */}
                      {product.has_variants && product.variants_count && product.variants_count > 0 && (
                        <Badge className="bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 border border-blue-200 text-[10px] sm:text-xs px-1.5 py-0.5">
                          <Layers className="w-2.5 h-2.5 mr-0.5" />
                          {product.variants_count + 1} var.
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Теги товара */}
                  <ProductTagsDisplay 
                    productId={parseInt(String(product.id))} 
                    variant="compact" 
                    maxTags={4}
                    className="mb-1"
                  />

                  {/* Precio */}
                  <div>
                    {product.show_price === false || (!product.price && !product.discount_price) ? (
                      <span className="text-xl font-bold text-slate-600">
                        Bajo petición
                      </span>
                    ) : (product.price || product.discount_price) ? (
                      product.discount_price && product.price && product.discount_price < product.price ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-700 bg-clip-text text-transparent">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 0
                            }).format(product.discount_price)}
                          </span>
                          <span className="text-sm line-through text-slate-400">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 0
                            }).format(product.price)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold text-slate-800">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0
                          }).format((product.price || product.discount_price) ?? 0)}
                        </span>
                      )
                    ) : (
                      <span className="text-xl font-bold text-slate-600">
                        Bajo petición
                      </span>
                    )}
                  </div>

                  {/* Статус склада */}

                </div>

                  {/* Кнопки действий */}
                  <div className="flex gap-2 w-full sm:w-auto sm:min-w-[200px]">
                    <Link href={`/products/${product.id}`} className="flex-1">
                      <Button
                        disabled={false}
                        size="sm"
                        className={`w-full h-9 text-sm font-medium rounded-lg transition-all duration-300 ${
                          isProductAvailable(product)
                            ? 'bg-gradient-to-r from-sky-400 to-sky-600 hover:from-sky-500 hover:to-sky-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200'
                        }`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {isProductAvailable(product) ? "Ver" : "N/D"}
                      </Button>
                    </Link>

                    {/* Кнопка добавления в заявку - только если товар доступен */}
                    {isProductAvailable(product) && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          addItem({
                            id: String(product.id),
                            name: product.name,
                            price: getActualPrice(product),
                            image_url: getProductImageSrc(product),
                            category: product.category,
                            sku: product.sku || '',
                            article_number: product.article_number || '',
                            is_on_request: product.show_price === false || (!product.price && !product.discount_price),
                            show_price: product.show_price
                          })
                        }}
                        size="sm"
                        className="flex-1 h-9 bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-all duration-200 rounded-lg"
                      >
                        <Package className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Añadir</span>
                        <span className="sm:hidden">+</span>
                      </Button>
                    )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
