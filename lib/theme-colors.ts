/**
 * Централизованная система цветов для Venorus
 * Российская цветовая схема с триколором и национальными акцентами
 */

export const themeColors = {
  // Основные цвета интерфейса - российская тематика
  primary: 'rgb(0 82 164)',        // Российский синий (флаг)
  secondary: 'rgb(220 38 38)',     // Российский красный (флаг)
  accent: 'rgb(255 215 0)',        // Золотой (герб)
  muted: 'rgb(248 250 252)',       // Белый с оттенком

  // Состояния
  success: 'rgb(22 163 74)',       // Зеленый
  warning: 'rgb(255 215 0)',       // Золотой
  error: 'rgb(220 38 38)',         // Красный российский
  info: 'rgb(0 82 164)',           // Синий российский

  // Текстовые цвета
  text: {
    primary: 'rgb(30 41 59)',      // Темно-синий
    secondary: 'rgb(51 65 85)',    // Средне-синий
    muted: 'rgb(100 116 139)',     // Серо-синий
    accent: 'rgb(0 82 164)',       // Российский синий
  },

  // Фоновые цвета
  background: {
    primary: 'rgb(255 255 255)',   // Белый (флаг)
    secondary: 'rgb(248 250 252)', // Очень светло-синий
    muted: 'rgb(241 245 249)',     // Светло-синий
    accent: 'rgb(254 249 235)',    // Золотистый акцент
  },

  // Границы
  border: {
    default: 'rgb(203 213 225)',   // Светло-синий
    muted: 'rgb(241 245 249)',     // Очень светло-синий
    accent: 'rgb(0 82 164)',       // Российский синий
  }
} as const

/**
 * Цветовая карта для характеристик продуктов
 * Российская цветовая палитра
 */
export const characteristicColors = {
  'телесный': '#D1D5DB',
  'черный матовый': '#1F1F1F',
  'белый глянцевый': '#FFFFFF',
  'серебристый металлик': '#B8B8B8',
  'синий': '#2563EB',
  'красный': '#DC2626',          // Российский красный
  'зеленый': '#16A34A',
  'камуфляж': '#8B7355',
  'под заказ': 'linear-gradient(45deg, #E5E7EB, #F3F4F6, #F9FAFB, #E5E7EB, #D1D5DB)',
  'коричневый': '#8B4513',
  'желтый': '#FFD700',           // Золотой
  'фиолетовый': '#7C3AED',
  'оранжевый': '#EA580C',        // Оранжевый
  'розовый': '#EC4899',          // Розовый
  'серый': '#6B7280',
  'золотой': '#D4AF37',
  'серебряный': '#C0C0C0'
} as const

/**
 * Получить цвет для характеристики
 */
export function getCharacteristicColor(name: string): string {
  const normalizedName = name.toLowerCase().trim()
  return characteristicColors[normalizedName as keyof typeof characteristicColors] || '#E5E7EB'
}

/**
 * CSS переменные для использования в Tailwind
 */
export const cssVariables = {
  '--theme-primary': themeColors.primary,
  '--theme-secondary': themeColors.secondary,
  '--theme-accent': themeColors.accent,
  '--theme-success': themeColors.success,
  '--theme-warning': themeColors.warning,
  '--theme-error': themeColors.error,
  '--theme-info': themeColors.info,
} as const

/**
 * Типы для TypeScript
 */
export type ThemeColor = keyof typeof themeColors
export type CharacteristicColorName = keyof typeof characteristicColors
export type TextColor = keyof typeof themeColors.text
export type BackgroundColor = keyof typeof themeColors.background
export type BorderColor = keyof typeof themeColors.border