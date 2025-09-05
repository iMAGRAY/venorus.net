# Обновление валюты на сайте Venorus

## Выполненные изменения

### ✅ Удален выбор валюты
- Убран селектор валюты из хедера (десктоп и мобильная версия)
- Оставлен только индикатор USD
- Удалены функции переключения валюты

### ✅ Обновлены все цены на USD
Изменены следующие файлы:

#### Основные утилиты:
- `lib/constants.ts` - CURRENCY: 'USD', LOCALE: 'en-US'
- `lib/utils.ts` - форматирование цен в USD

#### Компоненты продуктов:
- `components/product-card.tsx` - цены в USD
- `components/product-card-list.tsx` - цены в USD  
- `components/product-card-simple.tsx` - цены в USD
- `components/product-quick-view.tsx` - цены в USD
- `components/product-recommendations.tsx` - цены в USD

#### Страницы:
- `app/products/[id]/page.tsx` - цены продуктов в USD

#### Админские компоненты:
- `components/admin/warehouse-section.tsx` - цены в USD
- `components/admin/warehouse-articles-section.tsx` - цены в USD
- `components/admin/products-manager.tsx` - цены в USD
- `components/admin/product-selector.tsx` - цены в USD

#### Интерфейс:
- `components/header.tsx` - убран селектор валюты, показывается только USD
- `components/i18n-provider.tsx` - обновлены тексты "Оплата в USD"

### ✅ Форматирование цен
Все цены теперь отображаются в формате:
- Локаль: `en-US` 
- Валюта: `USD`
- Формат: `$1,234` (без копеек для целых чисел)

### ✅ Проверка работоспособности
- ✅ Сборка проекта успешна
- ✅ Все компоненты обновлены
- ✅ Нет ошибок TypeScript

## Результат

Теперь на сайте:
- 🚫 Нет выбора валюты
- 💵 Все цены отображаются только в USD
- 🎯 Единообразное отображение валюты по всему сайту
- ✅ Проект успешно собирается и работает

Сайт готов к использованию с единой валютой USD.