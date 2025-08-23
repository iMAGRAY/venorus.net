-- PERFORMANCE OPTIMIZATION SCRIPT
-- Индексы для улучшения производительности запросов

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================

-- Основные индексы для частых запросов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_is_deleted 
ON products (is_deleted) 
WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active
ON products (category_id, is_deleted, created_at) 
WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_manufacturer_active
ON products (manufacturer_id, is_deleted, created_at) 
WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_search
ON products USING gin(to_tsvector('russian', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_fields
ON products USING gin(
  (to_tsvector('russian', coalesce(name, '')) || 
   to_tsvector('russian', coalesce(description, '')) || 
   to_tsvector('russian', coalesce(sku, '')) || 
   to_tsvector('russian', coalesce(article_number, '')))
);

-- ============================================================================
-- PRODUCT_VARIANTS TABLE INDEXES
-- ============================================================================

-- Критически важные индексы для вариантов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_master_active
ON product_variants (master_id, is_active, is_deleted) 
WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_sku
ON product_variants (sku) 
WHERE sku IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_stock
ON product_variants (stock_quantity, is_active) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_sort
ON product_variants (master_id, sort_order, name);

-- Поисковый индекс для вариантов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_search
ON product_variants USING gin(
  (to_tsvector('russian', coalesce(name, '')) || 
   to_tsvector('russian', coalesce(sku, '')))
) WHERE is_active = true;

-- ============================================================================
-- CHARACTERISTICS TABLES INDEXES
-- ============================================================================

-- Индексы для упрощенной системы характеристик
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_characteristics_simple_product
ON product_characteristics_simple (product_id, value_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variant_characteristics_simple_variant
ON variant_characteristics_simple (variant_id, value_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characteristics_values_simple_group
ON characteristics_values_simple (group_id, sort_order) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characteristics_groups_simple_active
ON characteristics_groups_simple (is_active, sort_order) 
WHERE is_active = true;

-- ============================================================================
-- CATEGORIES & MANUFACTURERS INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_categories_active
ON product_categories (is_active) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturers_active
ON manufacturers (is_active) 
WHERE is_active = true;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Индекс для пагинации продуктов с фильтрами
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_listing_pagination
ON products (is_deleted, category_id, manufacturer_id, created_at DESC) 
WHERE is_deleted = false;

-- Индекс для поиска продуктов с вариантами
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_with_variants
ON products (is_deleted, id) 
WHERE is_deleted = false AND EXISTS (
  SELECT 1 FROM product_variants pv 
  WHERE pv.master_id = products.id 
  AND pv.is_active = true 
  AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
);

-- ============================================================================
-- OPTIMIZATION STATISTICS UPDATE
-- ============================================================================

-- Обновляем статистики для оптимизатора запросов
ANALYZE products;
ANALYZE product_variants;
ANALYZE product_characteristics_simple;
ANALYZE variant_characteristics_simple;
ANALYZE characteristics_values_simple;
ANALYZE characteristics_groups_simple;
ANALYZE product_categories;
ANALYZE manufacturers;

-- ============================================================================
-- VACUUM FOR PERFORMANCE
-- ============================================================================

-- Автоматическая очистка и дефрагментация
VACUUM ANALYZE products;
VACUUM ANALYZE product_variants;
VACUUM ANALYZE product_characteristics_simple;
VACUUM ANALYZE variant_characteristics_simple;