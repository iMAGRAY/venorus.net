# Перевод интерфейса с русского на испанский

## Выполненные изменения

### ✅ Обновлены переводы в `components/i18n-provider.tsx`

#### Общие переводы (common):
- `products`: "Товары" → "Productos"
- `domesticProduction`: "Отечественное" → "Nacional"
- `quality`: "Качественное" → "Calidad"
- `timeTested`: "Проверено временем" → "Probado por el tiempo"
- `sortBy`: "Сортировать по..." → "Ordenar por..."
- `qualityAndReliability`: "Качество и надёжность" → "Calidad y confiabilidad"
- `deliveryAcrossVenezuela`: "Доставка по всей Венесуэле" → "Entrega en toda Venezuela"
- `guaranteeAndSupport`: "Гарантия и поддержка" → "Garantía y soporte"
- `certifiedInRussia`: "Сертифицировано в России" → "Certificado en Rusia"
- `allRightsReserved`: "Все права защищены" → "Todos los derechos reservados"

#### Сортировка (sort):
- `nameAsc`: "По названию А-Я" → "Por nombre A-Z"
- `nameDesc`: "По названию Я-А" → "Por nombre Z-A"
- `priceAsc`: "По цене ↑" → "Por precio ↑"
- `priceDesc`: "По цене ↓" → "Por precio ↓"

#### Заголовок (header):
- `contacts`: "Контакты" → "Contactos"
- `phone`: "Телефон" → "Teléfono"
- `contactSubtitle`: "Свяжитесь с нами любым удобным способом" → "Contáctenos de cualquier manera conveniente"

#### Hero секция (hero):
- `madeInRussia`: "Сделано в России" → "Hecho en Rusia"
- `forVenezuela`: "ИЗ РОССИИ" → "DE RUSIA"
- `qualityTraditions`: "Качество и Традиции" → "Calidad y Tradiciones"
- `seeProducts`: "Смотреть товары" → "Ver productos"
- `catalogTitle`: "Каталог российских товаров" → "Catálogo de productos rusos"
- `categories`: "Категории" → "Categorías"
- `filters`: "Фильтры" → "Filtros"
- `activeFilters`: "Активные фильтры" → "Filtros activos"
- `clearAll`: "Очистить все" → "Limpiar todo"
- `loadingMore`: "Загружаем еще товары..." → "Cargando más productos..."
- `allLoaded`: "Все товары загружены" → "Todos los productos cargados"

#### Продукты (product):
- `price`: "Цена" → "Precio"
- `inStock`: "В наличии" → "En stock"
- `outOfStock`: "Нет в наличии" → "Agotado"
- `onRequest`: "По запросу" → "Bajo petición"
- `addToCart`: "Добавить в заявку" → "Añadir a la solicitud"
- `details`: "Подробнее" → "Más detalles"
- `inCart`: "В заявке" → "En solicitud"
- `back`: "Назад" → "Atrás"
- `similar`: "Похожие товары" → "Productos similares"

#### Корзина (cart):
- `title`: "Заявка" → "Solicitud"
- `empty`: "Заявка пуста" → "Solicitud vacía"
- `continue`: "Продолжить формирование заявки" → "Continuar formando solicitud"
- `total`: "Итого:" → "Total:"
- `checkout`: "Оформить заказ" → "Realizar pedido"
- `consult`: "Консультация в WhatsApp" → "Consulta en WhatsApp"

### ✅ Обновлены компоненты

#### `components/product-quick-view.tsx`:
- "Характеристики" → "Características"

#### `components/product-variant-details.tsx`:
- "Артикул" → "Artículo"
- "Характеристики" → "Características"
- "Цены и наличие" → "Precios y disponibilidad"
- "Изображения" → "Imágenes"
- "Характеристики варианта" → "Características de la variante"
- "Характеристики не указаны" → "Características no especificadas"

#### `components/product-basic-info.tsx`:
- "Артикул" → "Artículo"

#### `components/product-characteristics.tsx`:
- "Характеристики" → "Características"
- "Характеристики не указаны" → "Características no especificadas"
- "Ключевые характеристики изделия" → "Características clave del producto"
- "Подробные характеристики" → "Características detalladas"

#### `components/product-characteristics-minimal.tsx`:
- "Характеристики" → "Características"

#### `components/product-main-parameters.tsx`:
- "Важные характеристики" → "Características importantes"

#### `app/page.tsx`:
- "Категория:" → "Categoría:"

### ✅ Trust Strip обновлен
- Все тексты переведены на испанский в соответствии с переводами

## Важно: Админ панель остается на русском языке

Все изменения касаются только пользовательского интерфейса. Админ панель (`/admin/*`) остается на русском языке как было запрошено.

## Результат

✅ Основной сайт теперь на испанском языке
✅ Админ панель остается на русском
✅ Проект успешно собирается
✅ Все переводы согласованы и единообразны

Сайт готов к использованию с испанским интерфейсом для пользователей и русским интерфейсом для администраторов.