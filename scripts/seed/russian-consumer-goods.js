#!/usr/bin/env node

/**
 * Скрипт для создания российских потребительских товаров
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
        name: 'Калашников',
        description: 'Российский концерн по производству спортивного и охотничьего снаряжения',
        website: 'https://kalashnikovgroup.ru',
        founded_year: 1807
      },
      {
        name: 'Ростех',
        description: 'Российская государственная корпорация, производящая высокотехнологичную продукцию',
        website: 'https://rostec.ru',
        founded_year: 2007
      },
      {
        name: 'Спектр',
        description: 'Российский производитель электроники и бытовой техники',
        website: 'https://spektr.ru',
        founded_year: 1992
      },
      {
        name: 'Русские самоцветы',
        description: 'Производство ювелирных изделий и украшений из натуральных камней',
        website: 'https://rus-gems.ru',
        founded_year: 1995
      },
      {
        name: 'Сибирские промыслы',
        description: 'Традиционные российские товары и изделия народных промыслов',
        website: 'https://sibcraft.ru',
        founded_year: 1990
      },
      {
        name: 'МегаТех',
        description: 'Современные технологические решения и электроника',
        website: 'https://megatech.ru',
        founded_year: 2005
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
        name: 'Электроника',
        description: 'Электронные устройства и гаджеты российского производства',
        parent_id: null
      },
      {
        name: 'Одежда и обувь', 
        description: 'Российская одежда, обувь и аксессуары',
        parent_id: null
      },
      {
        name: 'Дом и быт',
        description: 'Товары для дома, быта и хозяйства',
        parent_id: null
      },
      {
        name: 'Спорт и отдых',
        description: 'Спортивные товары и товары для активного отдыха',
        parent_id: null
      },
      {
        name: 'Красота и здоровье',
        description: 'Косметика, парфюмерия и товары для здоровья',
        parent_id: null
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

    // Подкатегории
    const subcategories = [
      { name: 'Смартфоны и планшеты', description: 'Мобильные устройства', parent_name: 'Электроника' },
      { name: 'Аудиотехника', description: 'Наушники, колонки, аудиосистемы', parent_name: 'Электроника' },
      { name: 'Мужская одежда', description: 'Одежда для мужчин', parent_name: 'Одежда и обувь' },
      { name: 'Женская одежда', description: 'Одежда для женщин', parent_name: 'Одежда и обувь' },
      { name: 'Обувь', description: 'Обувь для всей семьи', parent_name: 'Одежда и обувь' },
      { name: 'Кухонные принадлежности', description: 'Посуда и кухонная утварь', parent_name: 'Дом и быт' },
      { name: 'Текстиль для дома', description: 'Постельное белье, полотенца', parent_name: 'Дом и быт' },
      { name: 'Туризм и кемпинг', description: 'Снаряжение для походов и отдыха', parent_name: 'Спорт и отдых' },
      { name: 'Фитнес', description: 'Товары для фитнеса и тренировок', parent_name: 'Спорт и отдых' }
    ];

    for (const subcategory of subcategories) {
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
    console.log('📱 Создание товаров...');

    const products = [
      // Электроника
      {
        name: 'Смартфон YotaPhone 3 Pro',
        sku: 'YOTA-PHONE-3P',
        description: 'Российский смартфон с двумя экранами - основным цветным и дополнительным E-ink дисплеем для экономии батареи.',
        category: 'Смартфоны и планшеты',
        manufacturer: 'МегаТех',
        price: 45000,
        discount_price: 39900,
        in_stock: true,
        stock_quantity: 25,
        weight: 190,
        dimensions: '15.3x7.7x0.9 см',
        material: 'Алюминий, стекло',
        warranty_months: 24
      },
      {
        name: 'Наушники Marshal Major IV',
        sku: 'MARS-MAJ-4',
        description: 'Беспроводные накладные наушники с отличным звуком и долгой автономностью до 80 часов.',
        category: 'Аудиотехника',
        manufacturer: 'Спектр',
        price: 12000,
        in_stock: true,
        stock_quantity: 50,
        weight: 165,
        dimensions: '18x15x8 см',
        material: 'Пластик, металл, кожа',
        warranty_months: 12
      },
      {
        name: 'Планшет RITMIX RMD-1121',
        sku: 'RITMIX-1121',
        description: '10-дюймовый планшет на Android для работы и развлечений с мощным процессором.',
        category: 'Смартфоны и планшеты',
        manufacturer: 'МегаТех',
        price: 18000,
        discount_price: 15300,
        in_stock: true,
        stock_quantity: 15,
        weight: 520,
        dimensions: '24x17x1 см',
        material: 'Пластик, металл',
        warranty_months: 18
      },

      // Одежда
      {
        name: 'Пуховик мужской "Сибирь"',
        sku: 'SIBIR-DOWN-M',
        description: 'Теплый мужской пуховик для суровых российских зим. Натуральный пух, водоотталкивающая ткань.',
        category: 'Мужская одежда',
        manufacturer: 'Сибирские промыслы',
        price: 8500,
        in_stock: true,
        stock_quantity: 30,
        weight: 950,
        dimensions: 'Размеры: S-XXL',
        material: 'Полиэстер, натуральный пух',
        warranty_months: 12
      },
      {
        name: 'Платье "Русские узоры"',
        sku: 'RUS-DRESS-01',
        description: 'Элегантное женское платье с традиционными русскими орнаментами, выполненными вручную.',
        category: 'Женская одежда',
        manufacturer: 'Русские самоцветы',
        price: 6500,
        discount_price: 5850,
        in_stock: true,
        stock_quantity: 20,
        weight: 420,
        dimensions: 'Размеры: XS-XL',
        material: 'Хлопок, лен',
        warranty_months: 6
      },
      {
        name: 'Сапоги "Валенки Премиум"',
        sku: 'VALENKI-PREM',
        description: 'Современные валенки из натуральной овечьей шерсти с влагозащитной подошвой.',
        category: 'Обувь',
        manufacturer: 'Сибирские промыслы',
        price: 4200,
        in_stock: true,
        stock_quantity: 40,
        weight: 850,
        dimensions: 'Размеры: 36-45',
        material: 'Овечья шерсть, резина',
        warranty_months: 12
      },

      // Дом и быт
      {
        name: 'Набор посуды "Гжель Люкс"',
        sku: 'GZHEL-LUX-SET',
        description: 'Эксклюзивный набор фарфоровой посуды с традиционной гжельской росписью, 12 предметов.',
        category: 'Кухонные принадлежности',
        manufacturer: 'Русские самоцветы',
        price: 15000,
        discount_price: 13500,
        in_stock: true,
        stock_quantity: 12,
        weight: 3200,
        dimensions: 'Комплект 12 предметов',
        material: 'Фарфор, глазурь',
        warranty_months: 24
      },
      {
        name: 'Постельное белье "Павловопосадские мотивы"',
        sku: 'PAVL-BED-SET',
        description: 'Роскошное постельное белье из натурального сатина с принтами в стиле павловопосадских платков.',
        category: 'Текстиль для дома',
        manufacturer: 'Русские самоцветы',
        price: 5500,
        in_stock: true,
        stock_quantity: 25,
        weight: 1200,
        dimensions: '2-спальный комплект',
        material: 'Сатин (хлопок 100%)',
        warranty_months: 12
      },

      // Спорт и отдых
      {
        name: 'Палатка "Таймень 3"',
        sku: 'TAYMEN-TENT-3',
        description: 'Трехместная туристическая палатка повышенной прочности для походов в любую погоду.',
        category: 'Туризм и кемпинг',
        manufacturer: 'Калашников',
        price: 12500,
        in_stock: true,
        stock_quantity: 18,
        weight: 3800,
        dimensions: '210x180x115 см',
        material: 'Полиэстер, алюминий',
        warranty_months: 24
      },
      {
        name: 'Гантели "Сила России" 2x10кг',
        sku: 'SILA-RUS-10KG',
        description: 'Профессиональные разборные гантели с прорезиненными дисками для домашних тренировок.',
        category: 'Фитнес',
        manufacturer: 'Ростех',
        price: 4800,
        discount_price: 4320,
        in_stock: true,
        stock_quantity: 35,
        weight: 20000,
        dimensions: '40x20x20 см (в упаковке)',
        material: 'Чугун, резина, сталь',
        warranty_months: 36
      },

      // Красота и здоровье
      {
        name: 'Крем "Сибирские травы" антивозрастной',
        sku: 'SIB-HERBS-ANTI',
        description: 'Натуральный крем на основе сибирских трав с антивозрастным эффектом. Без парабенов.',
        category: 'Красота и здоровье',
        manufacturer: 'Сибирские промыслы',
        price: 1850,
        in_stock: true,
        stock_quantity: 60,
        weight: 75,
        dimensions: '5x5x4 см',
        material: 'Натуральные экстракты, масла',
        warranty_months: 24
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
      { name: 'Основные характеристики', description: 'Базовые технические параметры' },
      { name: 'Материалы и качество', description: 'Материалы изготовления и качество' },
      { name: 'Размеры и упаковка', description: 'Габариты, вес и упаковка' },
      { name: 'Гарантия', description: 'Гарантийное обслуживание' }
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
      // Основные
      { group: 'Основные характеристики', value: 'Россия', description: 'Страна производства' },
      { group: 'Основные характеристики', value: 'Высокое качество', description: 'Премиум качество' },
      
      // Материалы
      { group: 'Материалы и качество', value: 'Алюминий', description: 'Легкий прочный металл' },
      { group: 'Материалы и качество', value: 'Натуральные материалы', description: 'Экологичные материалы' },
      { group: 'Материалы и качество', value: 'Пластик высокого качества', description: 'Прочный пластик' },
      { group: 'Материалы и качество', value: 'Текстиль премиум', description: 'Качественные ткани' },
      
      // Упаковка
      { group: 'Размеры и упаковка', value: 'Компактный размер', description: 'Удобные размеры' },
      { group: 'Размеры и упаковка', value: 'Легкий вес', description: 'Небольшой вес' },
      
      // Гарантия
      { group: 'Гарантия', value: '12 месяцев', description: 'Стандартная гарантия' },
      { group: 'Гарантия', value: '24 месяца', description: 'Расширенная гарантия' },
      { group: 'Гарантия', value: '36 месяцев', description: 'Максимальная гарантия' }
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
      
      // Привязываем страну производства
      await client.query(
        `INSERT INTO product_characteristics_simple (product_id, value_id, is_primary, display_order, created_at)
         VALUES ($1, $2, true, 1, NOW())`,
        [productId, valueIds['Россия']]
      );

      // Привязываем материал (определяем по описанию товара)
      let materialValueId = null;
      if (product.material.includes('Алюминий')) {
        materialValueId = valueIds['Алюминий'];
      } else if (product.material.includes('хлопок') || product.material.includes('лен') || product.material.includes('шерсь')) {
        materialValueId = valueIds['Натуральные материалы'];
      } else if (product.material.includes('сатин') || product.material.includes('кожа')) {
        materialValueId = valueIds['Текстиль премиум'];
      } else {
        materialValueId = valueIds['Пластик высокого качества'];
      }

      if (materialValueId) {
        await client.query(
          `INSERT INTO product_characteristics_simple (product_id, value_id, display_order, created_at)
           VALUES ($1, $2, 2, NOW())`,
          [productId, materialValueId]
        );
      }

      // Привязываем гарантию
      let warrantyValueId = null;
      if (product.warranty_months >= 36) {
        warrantyValueId = valueIds['36 месяцев'];
      } else if (product.warranty_months >= 24) {
        warrantyValueId = valueIds['24 месяца'];
      } else {
        warrantyValueId = valueIds['12 месяцев'];
      }

      await client.query(
        `INSERT INTO product_characteristics_simple (product_id, value_id, additional_value, display_order, created_at)
         VALUES ($1, $2, $3, 3, NOW())`,
        [productId, warrantyValueId, `Размеры: ${product.dimensions}, Вес: ${product.weight} г`]
      );

      console.log(`   ✅ Привязаны характеристики для: ${product.name}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 РОССИЙСКИЕ ТОВАРЫ СОЗДАНЫ!');
    console.log('============================================================');
    console.log(`✅ Создано производителей: ${manufacturers.length}`);
    console.log(`✅ Создано категорий: ${categories.length + subcategories.length}`);
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