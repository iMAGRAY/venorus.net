#!/usr/bin/env node

/**
 * Скрипт для создания тестовых данных российских товаров протезирования
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Настройка подключения к PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRESQL_HOST,
  port: parseInt(process.env.POSTGRESQL_PORT),
  database: process.env.POSTGRESQL_DBNAME,
  user: process.env.POSTGRESQL_USER,
  password: decodeURIComponent(process.env.POSTGRESQL_PASSWORD),
  ssl: false,
});

console.log('🇷🇺 СОЗДАНИЕ РОССИЙСКИХ ТОВАРОВ ДЛЯ VENORUS');
console.log('============================================================');

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Создание российских производителей
    console.log('🏭 Создание российских производителей...');
    
    const manufacturers = [
      {
        name: 'НПП "Протез"',
        description: 'Научно-производственное предприятие "Протез" - ведущий российский разработчик и производитель протезно-ортопедических изделий',
        website: 'https://npp-protez.ru',
        founded_year: 1994
      },
      {
        name: 'ОртоМед',
        description: 'Российская компания по производству ортопедических изделий и протезов высокого качества',
        website: 'https://ortomed-spb.ru',
        founded_year: 2001
      },
      {
        name: 'РусПротез',
        description: 'Современные российские технологии протезирования и реабилитации',
        website: 'https://rusprotez.ru',
        founded_year: 2010
      },
      {
        name: 'Биомеханика',
        description: 'Инновационные решения в области биомеханики и протезирования',
        website: 'https://biomech.ru',
        founded_year: 2005
      },
      {
        name: 'МедТехИнжиниринг',
        description: 'Разработка и производство высокотехнологичных медицинских изделий',
        website: 'https://medtecheng.ru',
        founded_year: 2008
      }
    ];

    const manufacturerIds = [];
    for (const manufacturer of manufacturers) {
      const result = await client.query(
        `INSERT INTO manufacturers (name, description, website_url, country, founded_year, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, 1, NOW(), NOW()) 
         RETURNING id`,
        [
          manufacturer.name,
          manufacturer.description,
          manufacturer.website,
          'Россия',
          manufacturer.founded_year
        ]
      );
      manufacturerIds.push(result.rows[0].id);
      console.log(`   ✅ ${manufacturer.name} (ID: ${result.rows[0].id})`);
    }

    // 2. Создание категорий товаров
    console.log('📂 Создание категорий товаров...');
    
    const categories = [
      {
        name: 'Протезы верхних конечностей',
        description: 'Протезы рук, кистей и пальцев различных типов',
        parent_id: null
      },
      {
        name: 'Протезы нижних конечностей', 
        description: 'Протезы ног, стоп и голеней',
        parent_id: null
      },
      {
        name: 'Ортопедические изделия',
        description: 'Ортезы, корсеты, бандажи и другие ортопедические изделия',
        parent_id: null
      },
      {
        name: 'Реабилитационное оборудование',
        description: 'Оборудование для реабилитации и восстановления',
        parent_id: null
      }
    ];

    // Подкатегории для протезов верхних конечностей
    const upperLimbSubcategories = [
      {
        name: 'Протезы кисти',
        description: 'Косметические и функциональные протезы кисти',
        parent_name: 'Протезы верхних конечностей'
      },
      {
        name: 'Протезы предплечья',
        description: 'Протезы предплечья с различными системами управления',
        parent_name: 'Протезы верхних конечностей'
      },
      {
        name: 'Протезы плеча',
        description: 'Протезы плеча и плечевого пояса',
        parent_name: 'Протезы верхних конечностей'
      }
    ];

    // Подкатегории для протезов нижних конечностей
    const lowerLimbSubcategories = [
      {
        name: 'Протезы голени',
        description: 'Протезы голени (транстибиальные)',
        parent_name: 'Протезы нижних конечностей'
      },
      {
        name: 'Протезы бедра',
        description: 'Протезы бедра (трансфеморальные)',
        parent_name: 'Протезы нижних конечностей'
      },
      {
        name: 'Протезы стопы',
        description: 'Протезы стопы и пальцев ног',
        parent_name: 'Протезы нижних конечностей'
      }
    ];

    const categoryIds = {};
    
    // Создание основных категорий
    for (const category of categories) {
      const result = await client.query(
        `INSERT INTO product_categories (name, description, parent_id, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, true, 1, NOW(), NOW()) 
         RETURNING id`,
        [category.name, category.description, category.parent_id]
      );
      categoryIds[category.name] = result.rows[0].id;
      console.log(`   ✅ ${category.name} (ID: ${result.rows[0].id})`);
    }

    // Создание подкатегорий
    const allSubcategories = [...upperLimbSubcategories, ...lowerLimbSubcategories];
    for (const subcategory of allSubcategories) {
      const parentId = categoryIds[subcategory.parent_name];
      const result = await client.query(
        `INSERT INTO product_categories (name, description, parent_id, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, true, 1, NOW(), NOW()) 
         RETURNING id`,
        [subcategory.name, subcategory.description, parentId]
      );
      categoryIds[subcategory.name] = result.rows[0].id;
      console.log(`     ✅ ${subcategory.name} (ID: ${result.rows[0].id})`);
    }

    // 3. Создание товаров
    console.log('🦾 Создание товаров...');

    const products = [
      // Протезы кисти
      {
        name: 'Косметический протез кисти КП-01М',
        sku: 'VP-HAND-001',
        description: 'Современный косметический протез кисти с высокой детализацией и естественным внешним видом. Изготавливается по индивидуальному слепку.',
        category: 'Протезы кисти',
        manufacturer: 'НПП "Протез"',
        price: 85000,
        discount_price: 76500,
        in_stock: true,
        stock_quantity: 15,
        weight: 450,
        dimensions: '19x8x3 см',
        material: 'Медицинский силикон',
        warranty_months: 24,
        certification: 'Росздравнадзор РЗН 2023/456'
      },
      {
        name: 'Функциональный протез кисти ФП-02Э',
        sku: 'VP-HAND-002', 
        description: 'Электромеханический функциональный протез кисти с управлением от ЭМГ-сигналов. Обеспечивает захват предметов различной формы.',
        category: 'Протезы кисти',
        manufacturer: 'Биомеханика',
        price: 450000,
        in_stock: true,
        stock_quantity: 8,
        weight: 520,
        dimensions: '20x9x4 см',
        material: 'Титановый сплав, углеродное волокно',
        warranty_months: 36,
        certification: 'CE 0297'
      },
      {
        name: 'Детский протез кисти ДП-01',
        sku: 'VP-HAND-003',
        description: 'Легкий детский протез кисти с возможностью подгонки по мере роста ребенка. Яркие цветовые решения.',
        category: 'Протезы кисти',
        manufacturer: 'ОртоМед',
        price: 65000,
        discount_price: 58500,
        in_stock: true,
        stock_quantity: 12,
        weight: 280,
        dimensions: '15x6x2.5 см',
        material: 'Полимерные материалы',
        warranty_months: 18,
        certification: 'ГОСТ Р 51079-2006'
      },

      // Протезы голени
      {
        name: 'Модульный протез голени МПГ-100',
        sku: 'VP-LEG-001',
        description: 'Современный модульный протез голени с гидравлическим коленным узлом. Адаптивная система ходьбы.',
        category: 'Протезы голени',
        manufacturer: 'РусПротез',
        price: 320000,
        in_stock: true,
        stock_quantity: 5,
        weight: 2100,
        dimensions: '45x12x8 см',
        material: 'Углеродное волокно, алюминий',
        warranty_months: 24,
        certification: 'ISO 22675:2016'
      },
      {
        name: 'Спортивный протез голени СПГ-200',
        sku: 'VP-LEG-002',
        description: 'Специализированный спортивный протез для бега и активных видов спорта. Карбоновая стопа с энергоотдачей.',
        category: 'Протезы голени',
        manufacturer: 'МедТехИнжиниринг',
        price: 280000,
        discount_price: 252000,
        in_stock: true,
        stock_quantity: 7,
        weight: 1850,
        dimensions: '42x10x6 см',
        material: 'Углеродное волокно',
        warranty_months: 18,
        certification: 'World Para Athletics'
      },
      {
        name: 'Базовый протез голени БПГ-50',
        sku: 'VP-LEG-003',
        description: 'Надежный базовый протез голени для повседневного использования. Оптимальное соотношение цены и качества.',
        category: 'Протезы голени',
        manufacturer: 'НПП "Протез"',
        price: 180000,
        in_stock: true,
        stock_quantity: 10,
        weight: 2400,
        dimensions: '44x13x9 см',
        material: 'Алюминий, пластик',
        warranty_months: 24,
        certification: 'ГОСТ Р ИСО 22675-2018'
      },

      // Протезы бедра
      {
        name: 'Протез бедра с микропроцессорным коленом ПБ-МК1',
        sku: 'VP-THIGH-001',
        description: 'Высокотехнологичный протез бедра с микропроцессорным управлением коленного сустава. Интеллектуальная адаптация к походке.',
        category: 'Протезы бедра',
        manufacturer: 'Биомеханика',
        price: 850000,
        in_stock: true,
        stock_quantity: 3,
        weight: 3200,
        dimensions: '65x15x10 см',
        material: 'Титан, углеродное волокно',
        warranty_months: 36,
        certification: 'CE 0297, FDA'
      },
      {
        name: 'Гидравлический протез бедра ГПБ-150',
        sku: 'VP-THIGH-002',
        description: 'Протез бедра с гидравлическим коленным шарниром. Плавная ходьба на различных скоростях.',
        category: 'Протезы бедра',
        manufacturer: 'РусПротез',
        price: 420000,
        discount_price: 378000,
        in_stock: true,
        stock_quantity: 6,
        weight: 2800,
        dimensions: '62x14x9 см',
        material: 'Алюминий, сталь',
        warranty_months: 24,
        certification: 'ISO 22675:2016'
      },

      // Протезы предплечья
      {
        name: 'Миоэлектрический протез предплечья МПП-300',
        sku: 'VP-FORE-001',
        description: 'Современный миоэлектрический протез предплечья с интуитивным управлением. Множественный захват предметов.',
        category: 'Протезы предплечья',
        manufacturer: 'МедТехИнжиниринг',
        price: 520000,
        in_stock: true,
        stock_quantity: 4,
        weight: 680,
        dimensions: '25x10x8 см',
        material: 'Углеродное волокно, титан',
        warranty_months: 30,
        certification: 'CE 0297, Health Canada'
      },
      {
        name: 'Механический протез предплечья МехПП-100',
        sku: 'VP-FORE-002',
        description: 'Надежный механический протез предплечья с тросовым управлением. Проверенная временем конструкция.',
        category: 'Протезы предплечья',
        manufacturer: 'НПП "Протез"',
        price: 125000,
        discount_price: 112500,
        in_stock: true,
        stock_quantity: 9,
        weight: 580,
        dimensions: '24x9x7 см',
        material: 'Алюминий, нержавеющая сталь',
        warranty_months: 24,
        certification: 'ГОСТ Р 51079-2006'
      },

      // Протезы стопы
      {
        name: 'Динамическая стопа ДС-Carbon',
        sku: 'VP-FOOT-001',
        description: 'Карбоновая динамическая стопа с энергоотдачей для активных пользователей. Естественная походка.',
        category: 'Протезы стопы',
        manufacturer: 'Биомеханика',
        price: 95000,
        in_stock: true,
        stock_quantity: 18,
        weight: 420,
        dimensions: '28x10x6 см',
        material: 'Углеродное волокно',
        warranty_months: 24,
        certification: 'ISO 22675:2016'
      },
      {
        name: 'Базовая стопа SACH БС-50',
        sku: 'VP-FOOT-002',
        description: 'Классическая стопа SACH для повседневного использования. Надежная и доступная.',
        category: 'Протезы стопы',
        manufacturer: 'ОртоМед',
        price: 35000,
        discount_price: 31500,
        in_stock: true,
        stock_quantity: 25,
        weight: 580,
        dimensions: '27x9x7 см',
        material: 'Полиуретан, дерево',
        warranty_months: 18,
        certification: 'ГОСТ 51079-2006'
      }
    ];

    const productIds = [];
    for (const product of products) {
      const manufacturerId = manufacturerIds[manufacturers.findIndex(m => m.name === product.manufacturer)];
      const categoryId = categoryIds[product.category];
      
      const result = await client.query(
        `INSERT INTO products (name, sku, description, category_id, manufacturer_id, price, discount_price, in_stock, stock_quantity, weight, warranty, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING id`,
        [
          product.name,
          product.sku,
          product.description,
          categoryId,
          manufacturerId,
          product.price,
          product.discount_price || null,
          product.in_stock,
          product.stock_quantity,
          product.weight + ' г',
          product.warranty_months + ' месяцев'
        ]
      );
      
      productIds.push(result.rows[0].id);
      console.log(`   ✅ ${product.name} (ID: ${result.rows[0].id}, SKU: ${product.sku})`);
    }

    // 4. Создание групп характеристик
    console.log('⚙️  Создание групп характеристик...');
    
    const characteristicGroups = [
      { name: 'Общие характеристики', description: 'Основные технические параметры' },
      { name: 'Материалы', description: 'Материалы изготовления' },
      { name: 'Размеры и вес', description: 'Габаритные размеры и масса' },
      { name: 'Гарантия и сертификация', description: 'Гарантийные обязательства и сертификаты' }
    ];

    const groupIds = {};
    for (const group of characteristicGroups) {
      const result = await client.query(
        `INSERT INTO characteristics_groups_simple (name, description, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, true, 1, NOW(), NOW()) 
         RETURNING id`,
        [group.name, group.description]
      );
      groupIds[group.name] = result.rows[0].id;
      console.log(`   ✅ Группа: ${group.name} (ID: ${result.rows[0].id})`);
    }

    // 5. Создание значений характеристик
    console.log('🏷️  Создание значений характеристик...');
    
    const characteristicValues = [
      // Общие значения
      { group: 'Общие характеристики', value: 'Россия', description: 'Страна производства' },
      { group: 'Гарантия и сертификация', value: 'Росздравнадзор', description: 'Орган сертификации' },
      { group: 'Гарантия и сертификация', value: 'CE 0297', description: 'Европейский сертификат' },
      { group: 'Гарантия и сертификация', value: 'ISO 22675:2016', description: 'Международный стандарт' },
      
      // Материалы
      { group: 'Материалы', value: 'Медицинский силикон', description: 'Биосовместимый материал' },
      { group: 'Материалы', value: 'Титановый сплав', description: 'Легкий прочный металл' },
      { group: 'Материалы', value: 'Углеродное волокно', description: 'Высокопрочный композит' },
      { group: 'Материалы', value: 'Алюминий', description: 'Легкий металл' },
      { group: 'Материалы', value: 'Полимерные материалы', description: 'Современные пластики' },
      { group: 'Материалы', value: 'Полиуретан', description: 'Эластичный материал' }
    ];

    const valueIds = {};
    for (const charValue of characteristicValues) {
      const groupId = groupIds[charValue.group];
      const result = await client.query(
        `INSERT INTO characteristics_values_simple (group_id, value, description, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, true, 1, NOW(), NOW()) 
         RETURNING id`,
        [groupId, charValue.value, charValue.description]
      );
      valueIds[charValue.value] = result.rows[0].id;
      console.log(`     ✅ ${charValue.value} (ID: ${result.rows[0].id})`);
    }

    // 6. Связывание характеристик с товарами
    console.log('🔗 Привязка характеристик к товарам...');
    
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const product = products[i];
      
      // Привязываем страну производства с комплексной информацией
      await client.query(
        `INSERT INTO product_characteristics_simple (product_id, value_id, is_primary, additional_value, display_order, created_at)
         VALUES ($1, $2, true, $3, 1, NOW())`,
        [productId, valueIds['Россия'], `Вес: ${product.weight} г, Размеры: ${product.dimensions}`]
      );

      // Привязываем материал
      const materialValueId = valueIds[product.material];
      if (materialValueId) {
        await client.query(
          `INSERT INTO product_characteristics_simple (product_id, value_id, is_primary, display_order, created_at)
           VALUES ($1, $2, true, 2, NOW())`,
          [productId, materialValueId]
        );
      }

      // Привязываем сертификацию с гарантией
      await client.query(
        `INSERT INTO product_characteristics_simple (product_id, value_id, additional_value, display_order, created_at)
         VALUES ($1, $2, $3, 3, NOW())`,
        [productId, valueIds['Росздравнадзор'], `Гарантия: ${product.warranty_months} месяцев`]
      );

      console.log(`   ✅ Привязаны характеристики для: ${product.name}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 ДАННЫЕ УСПЕШНО СОЗДАНЫ!');
    console.log('============================================================');
    console.log(`✅ Создано производителей: ${manufacturers.length}`);
    console.log(`✅ Создано категорий: ${categories.length + allSubcategories.length}`);
    console.log(`✅ Создано товаров: ${products.length}`);
    console.log(`✅ Создано групп характеристик: ${characteristicGroups.length}`);
    console.log(`✅ Создано значений характеристик: ${characteristicValues.length}`);
    console.log(`✅ Создано связей товар-характеристика: ${products.length * 3}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при создании данных:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск скрипта
async function main() {
  try {
    await seedDatabase();
    console.log('\n🚀 Скрипт выполнен успешно!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Критическая ошибка:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();