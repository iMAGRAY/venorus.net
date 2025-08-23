-- ============================================================================
-- СОЗДАНИЕ ТАБЛИЦ ДЛЯ СИСТЕМЫ ТЕГОВ
-- ============================================================================

-- Удаляем старые таблицы если существуют (для чистой установки)
DROP TABLE IF EXISTS variant_tag_relations CASCADE;
DROP TABLE IF EXISTS product_tag_relations CASCADE;
DROP TABLE IF EXISTS product_tags CASCADE;

-- ============================================================================
-- ОСНОВНАЯ ТАБЛИЦА ТЕГОВ
-- ============================================================================
CREATE TABLE product_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',        -- Цвет текста
    bg_color VARCHAR(7) DEFAULT '#e0e7ff',     -- Цвет фона
    icon VARCHAR(50),                          -- Имя иконки
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Поля для личных тегов (NULL для общих тегов)
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальные ограничения
    CONSTRAINT unique_general_tag_name UNIQUE (name) WHERE product_id IS NULL AND variant_id IS NULL,
    CONSTRAINT unique_general_tag_slug UNIQUE (slug) WHERE product_id IS NULL AND variant_id IS NULL,
    CONSTRAINT unique_product_tag_name UNIQUE (product_id, name) WHERE product_id IS NOT NULL,
    CONSTRAINT unique_variant_tag_name UNIQUE (variant_id, name) WHERE variant_id IS NOT NULL,
    
    -- Проверки целостности
    CONSTRAINT check_tag_owner CHECK (
        (product_id IS NULL AND variant_id IS NULL) OR  -- Общий тег
        (product_id IS NOT NULL AND variant_id IS NULL) OR  -- Личный тег продукта
        (product_id IS NULL AND variant_id IS NOT NULL)  -- Личный тег варианта
    )
);

-- ============================================================================
-- ТАБЛИЦА СВЯЗЕЙ ПРОДУКТОВ С ТЕГАМИ
-- ============================================================================
CREATE TABLE product_tag_relations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальное ограничение
    CONSTRAINT unique_product_tag_relation UNIQUE(product_id, tag_id)
);

-- ============================================================================
-- ТАБЛИЦА СВЯЗЕЙ ВАРИАНТОВ С ТЕГАМИ
-- ============================================================================
CREATE TABLE variant_tag_relations (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальное ограничение
    CONSTRAINT unique_variant_tag_relation UNIQUE(variant_id, tag_id)
);

-- ============================================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ============================================================================

-- Индексы для product_tags
CREATE INDEX idx_product_tags_slug ON product_tags(slug) WHERE is_active = true;
CREATE INDEX idx_product_tags_is_active ON product_tags(is_active);
CREATE INDEX idx_product_tags_product_id ON product_tags(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_tags_variant_id ON product_tags(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_product_tags_sort_order ON product_tags(sort_order, name);

-- Индексы для product_tag_relations
CREATE INDEX idx_product_tag_relations_product_id ON product_tag_relations(product_id);
CREATE INDEX idx_product_tag_relations_tag_id ON product_tag_relations(tag_id);

-- Индексы для variant_tag_relations
CREATE INDEX idx_variant_tag_relations_variant_id ON variant_tag_relations(variant_id);
CREATE INDEX idx_variant_tag_relations_tag_id ON variant_tag_relations(tag_id);

-- ============================================================================
-- ВСТАВКА БАЗОВЫХ ТЕГОВ
-- ============================================================================
INSERT INTO product_tags (name, slug, color, bg_color, icon, sort_order) VALUES
    ('Новинка', 'new', '#10b981', '#d1fae5', 'sparkles', 10),
    ('Хит продаж', 'bestseller', '#f59e0b', '#fef3c7', 'trending-up', 20),
    ('Рекомендуем', 'recommended', '#8b5cf6', '#ede9fe', 'star', 30),
    ('Акция', 'sale', '#ef4444', '#fee2e2', 'percent', 40),
    ('Эксклюзив', 'exclusive', '#6366f1', '#e0e7ff', 'crown', 50),
    ('Премиум', 'premium', '#f59e0b', '#fef3c7', 'gem', 60),
    ('Экологичный', 'eco', '#10b981', '#d1fae5', 'leaf', 70),
    ('Гарантия 5 лет', 'warranty-5', '#3b82f6', '#dbeafe', 'shield-check', 80),
    ('Быстрая доставка', 'fast-delivery', '#06b6d4', '#cffafe', 'truck', 90),
    ('Сделано в России', 'made-in-russia', '#ef4444', '#fee2e2', 'flag', 100),
    ('Скидка 10%', 'discount-10', '#f59e0b', '#fef3c7', 'tag', 110),
    ('Скидка 20%', 'discount-20', '#ef4444', '#fee2e2', 'tag', 120),
    ('Бесплатная доставка', 'free-shipping', '#10b981', '#d1fae5', 'package', 130),
    ('Ограниченная серия', 'limited-edition', '#8b5cf6', '#ede9fe', 'clock', 140),
    ('Подарок при покупке', 'gift', '#ec4899', '#fce7f3', 'gift', 150)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для product_tags
CREATE TRIGGER update_product_tags_updated_at 
    BEFORE UPDATE ON product_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ПРОВЕРКА УСТАНОВКИ
-- ============================================================================
SELECT 
    'product_tags' as table_name, 
    COUNT(*) as total_rows 
FROM product_tags
UNION ALL
SELECT 
    'product_tag_relations' as table_name, 
    COUNT(*) as total_rows 
FROM product_tag_relations
UNION ALL
SELECT 
    'variant_tag_relations' as table_name, 
    COUNT(*) as total_rows 
FROM variant_tag_relations;