import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'
import { requireAuth, hasPermission } from '@/lib/auth/database-auth'
import { logger } from '@/lib/logger'
import { withCache, invalidateApiCache } from '@/lib/cache/cache-middleware'
import { cacheKeys, cacheRemember, CACHE_TTL, invalidateCache, cachePatterns, invalidateProductCache } from '@/lib/cache/cache-utils'
import { guardDbOr503, tablesExist, okEmpty } from '@/lib/api-guards'
import { preparedStatements, COMMON_QUERIES } from '@/lib/database/prepared-statements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withCache(async function GET(request: NextRequest) {
  try {
    const guard = await guardDbOr503()
    if (guard) return guard

    const { searchParams } = new URL(request.url);
    const fast = searchParams.get('fast') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : (page - 1) * limit;
    const _detailed = searchParams.get('detailed') === 'true';
    const nocache = searchParams.get('nocache') === 'true';
    const categoryId = searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!) : undefined;
    const manufacturerId = searchParams.get('manufacturer_id') ? parseInt(searchParams.get('manufacturer_id')!) : undefined;
    const sort = searchParams.get('sort') || 'created_desc';

    // Если нет нужных таблиц — возвращаем пустой успешный ответ, не 500
    const needed = await tablesExist(['products'])
    if (!needed.products) {
      return okEmpty('data', { success: true, count: 0 })
    }

    // Генерируем ключ кеша с учетом всех параметров пагинации
    const cacheParams = { 
      fast, 
      limit, 
      page, 
      offset, 
      detailed: _detailed, 
      categoryId, 
      manufacturerId, 
      sort 
    };
    const cacheKey = cacheKeys.productList(cacheParams);

    // Определяем TTL в зависимости от типа запроса - ОПТИМИЗИРОВАНО для производительности
    const ttl = fast ? CACHE_TTL.MEDIUM : CACHE_TTL.LONG;

    // Используем cacheRemember для автоматического кеширования
    const fetchProducts = async () => {
      let query;
      let queryParams: any[] = [];
      let whereConditions = ['(p.is_deleted = false OR p.is_deleted IS NULL)'];
      let paramCounter = 1;

      // Добавляем фильтры
      if (categoryId) {
        whereConditions.push(`p.category_id = $${paramCounter}`);
        queryParams.push(categoryId);
        paramCounter++;
      }
      
      if (manufacturerId) {
        whereConditions.push(`p.manufacturer_id = $${paramCounter}`);
        queryParams.push(manufacturerId);
        paramCounter++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Определяем сортировку
      let orderBy = 'ORDER BY p.created_at DESC';
      switch(sort) {
        case 'name_asc': orderBy = 'ORDER BY p.name ASC'; break;
        case 'name_desc': orderBy = 'ORDER BY p.name DESC'; break;
        case 'price_asc': orderBy = 'ORDER BY p.price ASC NULLS LAST'; break;
        case 'price_desc': orderBy = 'ORDER BY p.price DESC NULLS LAST'; break;
        case 'created_asc': orderBy = 'ORDER BY p.created_at ASC'; break;
        case 'created_desc': orderBy = 'ORDER BY p.created_at DESC'; break;
      }

    if (fast) {
      // Оптимизированный быстрый запрос без сложных подзапросов
      query = `
        SELECT
          p.id, p.name, p.short_name, p.description, p.sku, p.article_number, p.price, p.discount_price,
          p.image_url, p.in_stock, p.stock_quantity, p.stock_status, p.show_price,
          p.category_id, p.manufacturer_id, p.series_id,
          p.created_at, p.updated_at,
          false as has_variants,
          0 as variants_count,
          '[]'::json as variants
        FROM products p
        ${whereClause}
        ${orderBy}
      `;
    } else {
      // ОПТИМИЗИРОВАННЫЙ запрос - получаем сначала только основные данные продуктов
      // без сложных JSON агрегаций и множественных JOIN'ов
      query = `
        SELECT
          p.*,
          ms.name as model_line_name,
          m.name as manufacturer_name,
          pc.name as category_name,
          -- Подсчитываем варианты отдельно для производительности
          (SELECT COUNT(*) FROM product_variants pv 
           WHERE pv.master_id = p.id AND pv.is_active = true AND (pv.is_deleted = false OR pv.is_deleted IS NULL)) as variants_count,
          -- Устанавливаем has_variants как boolean
          (SELECT COUNT(*) FROM product_variants pv 
           WHERE pv.master_id = p.id AND pv.is_active = true AND (pv.is_deleted = false OR pv.is_deleted IS NULL)) > 0 as has_variants
        FROM products p
        LEFT JOIN model_series ms ON p.series_id = ms.id
        LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        ${whereClause}
        ${orderBy}
      `;
    }

    if (limit) {
      if (offset) {
        query += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
        queryParams.push(limit, offset);
      } else {
        query += ` LIMIT $${paramCounter}`;
        queryParams.push(limit);
      }
    } else if (offset) {
      query += ` OFFSET $${paramCounter}`;
      queryParams.push(offset);
    }

      // Добавляем timeout 15s для предотвращения hang (уменьшено для нагрузки)
      const queryTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 15 seconds')), 15000)
      );
      
      // Используем prepared statements для частых запросов
      let result;
      if (!categoryId && !manufacturerId && sort === 'created_desc' && fast) {
        // Быстрый запрос продуктов - используем prepared statement
        result = await Promise.race([
          preparedStatements.executeQuery(
            COMMON_QUERIES.GET_PRODUCTS_LIST, 
            query, 
            queryParams
          ),
          queryTimeout
        ]) as any;
      } else {
        // Сложный запрос - обычный executeQuery
        result = await Promise.race([
          executeQuery(query, queryParams),
          queryTimeout
        ]) as any;
      }

      // ОПТИМИЗИРОВАНО: Параллельное выполнение запросов для variants и characteristics
      if (!fast && result.rows.length > 0 && _detailed) {
        const productIds = result.rows.map((p: any) => p.id);
        
        // Запускаем все запросы параллельно для снижения общей латентности
        const [variantsResult, charTables] = await Promise.all([
          // Запрос вариантов
          executeQuery(`
            SELECT 
              pv.master_id,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', pv.id,
                  'price', pv.price,
                  'discountPrice', pv.discount_price,
                  'isAvailable', pv.is_active,
                  'sizeName', COALESCE(pv.name, pv.sku),
                  'sizeValue', COALESCE(pv.sku, pv.name),
                  'stockQuantity', pv.stock_quantity,
                  'sku', pv.sku
                ) ORDER BY pv.sort_order, pv.name
              ) as variants
            FROM product_variants pv
            WHERE pv.master_id = ANY($1) 
              AND pv.is_active = true 
              AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
            GROUP BY pv.master_id
          `, [productIds]),
          // Проверка таблиц (теперь с кешем на 24 часа)
          tablesExist(['product_characteristics_simple','characteristics_values_simple','characteristics_groups_simple'])
        ]);
        
        // Обрабатываем результаты вариантов
        const variantsByProductId: any = {};
        variantsResult.rows.forEach((row: any) => {
          variantsByProductId[row.master_id] = row.variants;
        });
        
        // Получаем характеристики если таблицы существуют
        let specsByProductId: any = {};
        if (charTables.product_characteristics_simple && charTables.characteristics_values_simple && charTables.characteristics_groups_simple) {
          const specsResult = await executeQuery(`
            SELECT 
              prch.product_id,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'spec_name', cg.name,
                  'spec_value', cv.value,
                  'group_name', cg.name,
                  'group_id', cg.id,
                  'spec_type', 'simple'
                )
              ) as specifications
            FROM product_characteristics_simple prch
            LEFT JOIN characteristics_values_simple cv ON prch.value_id = cv.id AND cv.is_active = true
            LEFT JOIN characteristics_groups_simple cg ON cv.group_id = cg.id AND cg.is_active = true
            WHERE prch.product_id = ANY($1) AND cv.id IS NOT NULL AND cg.id IS NOT NULL
            GROUP BY prch.product_id
          `, [productIds]);
          
          specsResult.rows.forEach((row: any) => {
            specsByProductId[row.product_id] = row.specifications;
          });
        }
        
        // Добавляем варианты и характеристики к продуктам
        result.rows.forEach((product: any) => {
          product.variants = variantsByProductId[product.id] || [];
          product.specifications = specsByProductId[product.id] || [];
        });
      } else {
        // Для fast режима или non-detailed просто добавляем пустые массивы
        result.rows.forEach((product: any) => {
          if (!product.variants) product.variants = [];
          if (!product.specifications) product.specifications = [];
        });
      }

      const responseData = {
        success: true,
        count: result.rows.length,
        data: result.rows
      };

      logger.info('Products loaded successfully', {
        count: result.rows.length,
        fast,
        detailed: _detailed
      });

      return responseData;
    };

    // Если nocache=true, не используем кеш
    if (nocache) {
      const data = await fetchProducts();
      return NextResponse.json(data);
    }

    // Получаем данные из кеша или выполняем запрос
    const responseData = await cacheRemember(
      cacheKey,
      ttl,
      fetchProducts,
      'product'
    );

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('Failed to fetch products:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: (error as any).message,
        stack: process.env.NODE_ENV === 'development' ? (error as any).stack : undefined
      },
      { status: 500 }
    );
  }
})

export async function POST(request: NextRequest) {
  let requestData: any;

  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.create') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    requestData = await request.json();
    logger.info('Product POST request', { name: requestData.name });

    const query = `
      INSERT INTO products (
        name, short_name, description, sku, article_number, price, discount_price,
        image_url, images, series_id, manufacturer_id, category_id,
        in_stock, stock_quantity, stock_status, weight, battery_life, warranty,
        show_price, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `;

    // Валидация и преобразование числовых полей
    const validateAndParseNumber = (value: any, fieldName: string, maxValue: number) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new Error(`Поле "${fieldName}" должно быть числом`);
      }
      if (parsed < 0) {
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        const formattedMax = maxValue.toLocaleString('ru-RU');
        throw new Error(`Поле "${fieldName}" не может превышать ${formattedMax}`);
      }
      return parsed;
    };

    const validateAndParseInteger = (value: any, fieldName: string, maxValue: number = 2147483647) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseInt(value);
      if (isNaN(parsed)) {
        throw new Error(`Поле "${fieldName}" должно быть целым числом`);
      }
      if (parsed < 0) {
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        const formattedMax = maxValue.toLocaleString('ru-RU');
        throw new Error(`Поле "${fieldName}" не может превышать ${formattedMax}`);
      }
      return parsed;
    };

    const values = [
      requestData.name,
      requestData.short_name || requestData.name,
      requestData.description || null,
      requestData.sku || null,
      requestData.article_number || null,
      validateAndParseNumber(requestData.price, 'цена', 99999999.99),
      validateAndParseNumber(requestData.discount_price, 'цена со скидкой', 99999999.99),
      requestData.image_url || null,
      JSON.stringify(requestData.images || []),
      validateAndParseInteger(requestData.series_id || requestData.model_line_id, 'линейка модели'),
      validateAndParseInteger(requestData.manufacturer_id, 'производитель'),
      validateAndParseInteger(requestData.category_id, 'категория'),
      requestData.in_stock ?? true,
      validateAndParseInteger(requestData.stock_quantity, 'количество на складе') || 0,
      requestData.stock_status || 'in_stock',
      requestData.weight || null,
      requestData.battery_life || null,
      requestData.warranty || null,
      requestData.show_price ?? true,
      validateAndParseInteger(requestData.created_by, 'создатель')
    ];

    const result = await executeQuery(query, values);
    const product = result.rows[0];

    // Invalidate cache after product creation using unified function
    await invalidateProductCache(product.id, requestData.category_id, 'create')

    // Если есть характеристики, добавляем их
    if (requestData.characteristics && Array.isArray(requestData.characteristics) && requestData.characteristics.length > 0) {
      logger.info(`Adding ${requestData.characteristics.length} characteristics to product ${product.id}`);

      // Подготавливаем запрос для массового добавления характеристик
      const characteristicsValues = [];
      const characteristicsPlaceholders = [];
      let paramIndex = 1;

      for (const char of requestData.characteristics) {
        if (char.value_id) {
          characteristicsPlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
          characteristicsValues.push(
            product.id,
            char.value_id,
            char.additional_value || null
          );
          paramIndex += 3;
        }
      }

      if (characteristicsPlaceholders.length > 0) {
        const characteristicsQuery = `
          INSERT INTO product_characteristics_simple (product_id, value_id, additional_value)
          VALUES ${characteristicsPlaceholders.join(', ')}
        `;

        await executeQuery(characteristicsQuery, characteristicsValues);
        logger.info(`Successfully added ${characteristicsPlaceholders.length} characteristics to product ${product.id}`);
      }
    }

    logger.info('Product created successfully', { productId: product.id });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Failed to create product:', error);

    // Ошибки валидации данных
    if (error.message && (
      error.message.includes('должно быть числом') ||
      error.message.includes('не может быть отрицательным') ||
      error.message.includes('не может превышать') ||
      error.message.includes('должно быть целым числом')
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Ошибки ограничений базы данных
    if (error.code === '23514') {
      if (error.constraint === 'check_stock_status_new') {
        return NextResponse.json(
          { error: 'Недопустимое значение статуса склада. Допустимые значения: В наличии, Нет в наличии, На заказ, Дальний склад, Ближний склад' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'Данные не соответствуют ограничениям базы данных' },
          { status: 400 }
        );
      }
    }

    // Ошибки уникальности
    if (error.code === '23505') {
      if (error.constraint === 'unique_product_name_manufacturer') {
        // Получаем информацию о существующем продукте для более детального сообщения
        try {
          const existingProductQuery = `
            SELECT p.id, p.name, p.manufacturer_id, m.name as manufacturer_name
            FROM products p
            LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
            WHERE p.name = $1 AND p.manufacturer_id = $2
          `;
          const existingProduct = await executeQuery(existingProductQuery, [requestData?.name, requestData?.manufacturer_id]);

          if (existingProduct.rows.length > 0) {
            const existing = existingProduct.rows[0];
            return NextResponse.json(
              {
                error: `Продукт с именем "${requestData?.name}" уже существует у производителя "${existing.manufacturer_name}" (ID: ${existing.id})`,
                suggestion: 'Используйте другое имя продукта или выберите другого производителя',
                existingProduct: {
                  id: existing.id,
                  name: existing.name,
                  manufacturer: existing.manufacturer_name
                }
              },
              { status: 409 }
            );
          }
        } catch (lookupError) {
          logger.warn('Failed to lookup existing product for detailed error message', { error: lookupError.message });
        }

        return NextResponse.json(
          {
            error: 'Продукт с таким именем уже существует у данного производителя',
            suggestion: 'Используйте другое имя продукта или выберите другого производителя'
          },
          { status: 409 }
        );
      } else if (error.detail?.includes('sku')) {
        return NextResponse.json(
          {
            error: 'Продукт с таким SKU уже существует',
            suggestion: 'Используйте другой SKU'
          },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          {
            error: 'Продукт с такими данными уже существует',
            suggestion: 'Проверьте уникальность всех полей'
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create product',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let data: any;
  
  try {
    // Проверяем аутентификацию
    const session = await requireAuth(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (!hasPermission(session.user, 'products.update') &&
        !hasPermission(session.user, 'products.*') &&
        !hasPermission(session.user, '*')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    data = await request.json();
    const productId = data.id;

    if (!productId) {
      logger.error('Product PUT request without ID', { data });
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    logger.info('Product PUT request', { 
      productId, 
      name: data.name, 
      dataKeys: Object.keys(data),
      hasCustomFields: !!data.custom_fields,
      configurableCharacteristics: data.custom_fields?.configurableCharacteristics?.length || 0
    });

    const query = `
      UPDATE products SET
        name = $1,
        short_name = $2,
        description = $3,
        sku = $4,
        article_number = $5,
        price = $6,
        discount_price = $7,
        image_url = $8,
        images = $9,
        series_id = $10,
        manufacturer_id = $11,
        category_id = $12,
        in_stock = $13,
        stock_quantity = $14,
        stock_status = $15,
        weight = $16,
        battery_life = $17,
        warranty = $18,
        show_price = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `;

    // Валидация и преобразование числовых полей
    const validateAndParseNumber = (value: any, fieldName: string, maxValue: number) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        logger.error(`Validation error: ${fieldName} is not a number`, { value, fieldName });
        throw new Error(`Поле "${fieldName}" должно быть числом`);
      }
      if (parsed < 0) {
        logger.error(`Validation error: ${fieldName} is negative`, { value: parsed, fieldName });
        throw new Error(`Поле "${fieldName}" не может быть отрицательным`);
      }
      if (parsed > maxValue) {
        logger.error(`Validation error: ${fieldName} exceeds max value`, { value: parsed, fieldName, maxValue });
        throw new Error(`Поле "${fieldName}" не может быть больше ${maxValue}`);
      }
      return parsed;
    };

    const values = [
      data.name,
      data.short_name || data.name, // Если short_name не указан, используем name
      data.description || null,
      data.sku || null,
      data.article_number || null,
      validateAndParseNumber(data.price, 'price', 999999999.99),
      validateAndParseNumber(data.discount_price, 'discount_price', 999999999.99),
      data.image_url || null,
      JSON.stringify(data.images || []),
      data.series_id || null,
      data.manufacturer_id || null,
      data.category_id || null,
      data.in_stock !== undefined ? data.in_stock : true,
      validateAndParseNumber(data.stock_quantity, 'stock_quantity', 999999),
      data.stock_status || 'in_stock',
      validateAndParseNumber(data.weight, 'weight', 999999.999),
      validateAndParseNumber(data.battery_life, 'battery_life', 999999),
      data.warranty || null,
      data.show_price !== undefined ? data.show_price : true,
      productId
    ];

    const result = await executeQuery(query, values);
    const updatedProduct = result.rows[0];

    if (!updatedProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    logger.info('Product updated successfully', { productId: updatedProduct.id });

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update product:', error);
    logger.error('Product update error details:', {
      productId: data?.id,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      requestDataKeys: data ? Object.keys(data) : [],
      hasId: !!data?.id
    });
    
    return NextResponse.json(
      {
        error: 'Failed to update product',
        details: error.message
      },
      { status: 500 }
    );
  }
}
