-- КРИТИЧЕСКИЕ ИНДЕКСЫ ДЛЯ УСКОРЕНИЯ ЗАПРОСОВ
-- Применить через pgAdmin или командную строку PostgreSQL

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ PRODUCTS (критично для производительности)
-- ============================================================================

-- Основной индекс для активных продуктов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active 
ON products (is_deleted, created_at DESC) 
WHERE is_deleted = false OR is_deleted IS NULL;

-- Индекс для поиска по категории
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category
ON products (category_id, is_deleted) 
WHERE is_deleted = false OR is_deleted IS NULL;

-- Индекс для поиска по производителю
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_manufacturer
ON products (manufacturer_id, is_deleted)
WHERE is_deleted = false OR is_deleted IS NULL;

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ PRODUCT_VARIANTS (критично для вариантов)
-- ============================================================================

-- Индекс для поиска вариантов по master_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_master
ON product_variants (master_id, is_active)
WHERE is_active = true;

-- Индекс для поиска по SKU
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_sku
ON product_variants (sku)
WHERE sku IS NOT NULL;

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦ СПРАВОЧНИКОВ
-- ============================================================================

-- Индекс для активных производителей
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturers_active
ON manufacturers (name)
WHERE is_active = true;

-- Индекс для активных категорий
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active
ON product_categories (parent_id, is_active)
WHERE is_active = true;

-- Индекс для model_lines
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_lines_manufacturer
ON model_series (manufacturer_id, is_active)
WHERE is_active = true;

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ХАРАКТЕРИСТИК
-- ============================================================================

-- Индекс для product_characteristics_simple
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_chars_simple_product
ON product_characteristics_simple (product_id);

-- Индекс для variant_characteristics_simple
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variant_chars_simple_variant
ON variant_characteristics_simple (variant_id);

-- ============================================================================
-- ОБНОВЛЕНИЕ СТАТИСТИКИ
-- ============================================================================

-- Обновляем статистику для оптимизатора запросов
ANALYZE products;
ANALYZE product_variants;
ANALYZE manufacturers;
ANALYZE product_categories;
ANALYZE model_series;
ANALYZE product_characteristics_simple;
ANALYZE variant_characteristics_simple;

-- ============================================================================
-- ПРОВЕРКА СОЗДАННЫХ ИНДЕКСОВ
-- ============================================================================

-- Запрос для проверки всех индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('products', 'product_variants', 'manufacturers', 'product_categories', 'model_series')
ORDER BY tablename, indexname;