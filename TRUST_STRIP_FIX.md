# Исправление отображения TrustStrip

## Проблема
Текст в компоненте TrustStrip отображался слитно без пробелов:
"Productos rusos originalesDirecto de los fabricantesEnvío a VenezuelaEnvíos a todo el paísPago en USDCondiciones flexibles para clientes"

## Решение
Добавлен класс `space-y-1` для создания отступов между элементами в каждом блоке TrustStrip.

### Изменения в `components/trust-strip.tsx`:
```tsx
// Было:
<div>
  <div className="text-sm font-semibold">{t('trust.originalProducts')}</div>
  <div className="text-xs text-muted-foreground">{t('trust.directFromManufacturers')}</div>
</div>

// Стало:
<div className="space-y-1">
  <div className="text-sm font-semibold">{t('trust.originalProducts')}</div>
  <div className="text-xs text-muted-foreground">{t('trust.directFromManufacturers')}</div>
</div>
```

## Результат
Теперь каждый блок в TrustStrip имеет правильные отступы между заголовком и подзаголовком, что предотвращает слипание текста.

## Статус
✅ Исправлено - добавлены отступы между элементами
✅ Проект запущен на http://localhost:3010
✅ Изменения применены