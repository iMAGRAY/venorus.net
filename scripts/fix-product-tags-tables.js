#!/usr/bin/env node

// Import pool directly using dynamic import since this is ESM
const { Pool } = require('pg')

// Create pool with environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
  port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
  user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
  password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function fixProductTagsTables() {
  try {
    console.log('Checking and creating product tags tables...')
    
    // Check if tables exist
    const checkTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('product_tags', 'product_tag_relations')
    `)
    
    const existingTables = checkTables.rows.map(row => row.table_name)
    console.log('Existing tables:', existingTables)
    
    // Create product_tags table if not exists
    if (!existingTables.includes('product_tags')) {
      console.log('Creating product_tags table...')
      await pool.query(`
        CREATE TABLE product_tags (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          color VARCHAR(20) DEFAULT '#333333',
          bg_color VARCHAR(20) DEFAULT '#f0f0f0',
          icon VARCHAR(50),
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `)
      console.log('✓ product_tags table created')
    } else {
      console.log('✓ product_tags table already exists')
    }
    
    // Create product_tag_relations table if not exists
    if (!existingTables.includes('product_tag_relations')) {
      console.log('Creating product_tag_relations table...')
      await pool.query(`
        CREATE TABLE product_tag_relations (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(product_id, tag_id)
        )
      `)
      
      // Create indexes
      await pool.query(`
        CREATE INDEX idx_product_tag_relations_product_id ON product_tag_relations(product_id);
        CREATE INDEX idx_product_tag_relations_tag_id ON product_tag_relations(tag_id);
      `)
      console.log('✓ product_tag_relations table created with indexes')
    } else {
      console.log('✓ product_tag_relations table already exists')
    }
    
    // Insert some default tags if table is empty
    const tagsCount = await pool.query('SELECT COUNT(*) FROM product_tags')
    if (parseInt(tagsCount.rows[0].count) === 0) {
      console.log('Adding default product tags...')
      await pool.query(`
        INSERT INTO product_tags (name, slug, color, bg_color, icon, sort_order, is_active) VALUES
        ('Новинка', 'new', '#ffffff', '#ef4444', 'sparkles', 1, true),
        ('Хит продаж', 'bestseller', '#ffffff', '#f59e0b', 'trending-up', 2, true),
        ('Рекомендуем', 'recommended', '#ffffff', '#10b981', 'star', 3, true),
        ('Скидка', 'discount', '#ffffff', '#8b5cf6', 'percent', 4, true),
        ('Премиум', 'premium', '#ffffff', '#1f2937', 'crown', 5, true),
        ('Эксклюзив', 'exclusive', '#ffffff', '#dc2626', 'gem', 6, true),
        ('Эко', 'eco', '#ffffff', '#059669', 'leaf', 7, true),
        ('Гарантия', 'warranty', '#ffffff', '#0d9488', 'shield-check', 8, true),
        ('Быстрая доставка', 'fast-delivery', '#ffffff', '#3b82f6', 'truck', 9, true),
        ('Российское', 'russian', '#ffffff', '#dc2626', 'flag', 10, true)
        ON CONFLICT (slug) DO NOTHING
      `)
      console.log('✓ Default tags added')
    } else {
      console.log('✓ Product tags already exist')
    }
    
    console.log('Product tags tables setup complete!')
    
  } catch (error) {
    console.error('Error setting up product tags tables:', error)
    throw error
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  fixProductTagsTables().catch(console.error)
}

module.exports = { fixProductTagsTables }