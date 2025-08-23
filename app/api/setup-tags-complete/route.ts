import { NextResponse } from 'next/server'
import { pool } from '@/lib/database/db-connection'

export async function GET() {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // 1. Удаляем старые таблицы если существуют
    await client.query('DROP TABLE IF EXISTS variant_tag_relations CASCADE')
    await client.query('DROP TABLE IF EXISTS product_tag_relations CASCADE')
    await client.query('DROP TABLE IF EXISTS product_tags CASCADE')
    
    // 2. Создаем основную таблицу тегов
    await client.query(`
      CREATE TABLE product_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#6366f1',
        bg_color VARCHAR(7) DEFAULT '#e0e7ff',
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_tag_owner CHECK (
          (product_id IS NULL AND variant_id IS NULL) OR
          (product_id IS NOT NULL AND variant_id IS NULL) OR
          (product_id IS NULL AND variant_id IS NOT NULL)
        )
      )
    `)
    
    // Создаем уникальные индексы вместо constraints с WHERE
    await client.query(`
      CREATE UNIQUE INDEX unique_general_tag_name 
      ON product_tags(name) 
      WHERE product_id IS NULL AND variant_id IS NULL
    `)
    
    await client.query(`
      CREATE UNIQUE INDEX unique_general_tag_slug 
      ON product_tags(slug) 
      WHERE product_id IS NULL AND variant_id IS NULL
    `)
    
    await client.query(`
      CREATE UNIQUE INDEX unique_product_tag_name 
      ON product_tags(product_id, name) 
      WHERE product_id IS NOT NULL
    `)
    
    await client.query(`
      CREATE UNIQUE INDEX unique_variant_tag_name 
      ON product_tags(variant_id, name) 
      WHERE variant_id IS NOT NULL
    `)
    
    // 3. Создаем таблицу связей продуктов с тегами
    await client.query(`
      CREATE TABLE product_tag_relations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_product_tag_relation UNIQUE(product_id, tag_id)
      )
    `)
    
    // 4. Создаем таблицу связей вариантов с тегами
    await client.query(`
      CREATE TABLE variant_tag_relations (
        id SERIAL PRIMARY KEY,
        variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_variant_tag_relation UNIQUE(variant_id, tag_id)
      )
    `)
    
    // 5. Создаем индексы для производительности
    const indexes = [
      'CREATE INDEX idx_product_tags_slug ON product_tags(slug) WHERE is_active = true',
      'CREATE INDEX idx_product_tags_is_active ON product_tags(is_active)',
      'CREATE INDEX idx_product_tags_product_id ON product_tags(product_id) WHERE product_id IS NOT NULL',
      'CREATE INDEX idx_product_tags_variant_id ON product_tags(variant_id) WHERE variant_id IS NOT NULL',
      'CREATE INDEX idx_product_tags_sort_order ON product_tags(sort_order, name)',
      'CREATE INDEX idx_product_tag_relations_product_id ON product_tag_relations(product_id)',
      'CREATE INDEX idx_product_tag_relations_tag_id ON product_tag_relations(tag_id)',
      'CREATE INDEX idx_variant_tag_relations_variant_id ON variant_tag_relations(variant_id)',
      'CREATE INDEX idx_variant_tag_relations_tag_id ON variant_tag_relations(tag_id)'
    ]
    
    for (const index of indexes) {
      await client.query(index)
    }
    
    // 6. Вставляем базовые теги
    const tags = [
      ['Новинка', 'new', '#10b981', '#d1fae5', 'sparkles', 10],
      ['Хит продаж', 'bestseller', '#f59e0b', '#fef3c7', 'trending-up', 20],
      ['Рекомендуем', 'recommended', '#8b5cf6', '#ede9fe', 'star', 30],
      ['Акция', 'sale', '#ef4444', '#fee2e2', 'percent', 40],
      ['Эксклюзив', 'exclusive', '#6366f1', '#e0e7ff', 'crown', 50],
      ['Премиум', 'premium', '#f59e0b', '#fef3c7', 'gem', 60],
      ['Экологичный', 'eco', '#10b981', '#d1fae5', 'leaf', 70],
      ['Гарантия 5 лет', 'warranty-5', '#3b82f6', '#dbeafe', 'shield-check', 80],
      ['Быстрая доставка', 'fast-delivery', '#06b6d4', '#cffafe', 'truck', 90],
      ['Сделано в России', 'made-in-russia', '#ef4444', '#fee2e2', 'flag', 100],
      ['Скидка 10%', 'discount-10', '#f59e0b', '#fef3c7', 'tag', 110],
      ['Скидка 20%', 'discount-20', '#ef4444', '#fee2e2', 'tag', 120],
      ['Бесплатная доставка', 'free-shipping', '#10b981', '#d1fae5', 'package', 130],
      ['Ограниченная серия', 'limited-edition', '#8b5cf6', '#ede9fe', 'clock', 140],
      ['Подарок при покупке', 'gift', '#ec4899', '#fce7f3', 'gift', 150]
    ]
    
    for (const tag of tags) {
      await client.query(
        `INSERT INTO product_tags (name, slug, color, bg_color, icon, sort_order) 
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        tag
      )
    }
    
    // 7. Создаем триггер для обновления updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_product_tags_updated_at ON product_tags
    `)
    
    await client.query(`
      CREATE TRIGGER update_product_tags_updated_at 
      BEFORE UPDATE ON product_tags
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    `)
    
    await client.query('COMMIT')
    
    // 8. Проверяем результаты
    const checkTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('product_tags', 'product_tag_relations', 'variant_tag_relations')
      ORDER BY table_name
    `)
    
    const tagsCount = await client.query('SELECT COUNT(*) as count FROM product_tags')
    
    const sampleTags = await client.query(
      'SELECT name, slug, color, bg_color, icon FROM product_tags ORDER BY sort_order LIMIT 5'
    )
    
    return NextResponse.json({
      success: true,
      message: 'Система тегов успешно создана',
      tables: checkTables.rows.map(r => r.table_name),
      totalTags: parseInt(tagsCount.rows[0].count),
      sampleTags: sampleTags.rows
    })
    
  } catch (error) {
    await client.query('ROLLBACK')
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка создания таблиц'
    }, { status: 500 })
  } finally {
    client.release()
  }
}