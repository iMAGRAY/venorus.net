"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

type SupportedLanguage = "ru" | "es"

type Dictionary = Record<string, any>

const ru: Dictionary = {
  common: {
    searchPlaceholder: "Поиск...",
    apply: "Применить",
    category: "Категория",
    showAllProducts: "Показать все товары",
    showAll: "Показать все",
    collapse: "Свернуть",
    back: "Назад",
    home: "Главная",
    products: "Товары",
    allCategories: "Все категории",
    similarProduct: "Похожий товар",
    noRecommendations: "Нет доступных рекомендаций",
    loading: "Загрузка...",
    open: "Открыть",
    download: "Скачать",
    share: "Поделиться",
    more: "ещё",
    domesticProduction: "Отечественное",
    productionInRussia: "Производство в России",
    quality: "Качественное",
    russianStandards: "Российские стандарты",
    reliable: "Надёжное",
    timeTested: "Проверено временем",
    sortBy: "Сортировать по...",
    searchSortOptions: "Поиск вариантов сортировки...",
  },
  sort: {
    nameAsc: "По названию А-Я",
    nameDesc: "По названию Я-А",
    priceAsc: "По цене ↑",
    priceDesc: "По цене ↓"
  },
  header: {
    contacts: "Контакты",
    phone: "Телефон",
    email: "Email",
    address: "Адрес",
    additionalContacts: "Дополнительные контакты",
    language: "Язык",
    currency: "Валюта",
    contactSubtitle: "Свяжитесь с нами любым удобным способом",
  },
  hero: {
    madeInRussia: "Сделано в России",
    forVenezuela: "ДЛЯ ВЕНЕСУЭЛЫ",
    qualityTraditions: "Качество и Традиции",
    seeProducts: "Смотреть товары",
    catalogTitle: "Каталог российских товаров",
    categories: "Категории",
    filters: "Фильтры",
    activeFilters: "Активные фильтры",
    clearAll: "Очистить все",
    loadingMore: "Загружаем еще товары...",
    allLoaded: "Все товары загружены",
    alsoRecommend: "Рекомендуем также",
    defaultSubtitle: "Качественные российские товары от отечественных производителей. Поддержим наше производство — выберем российское! Надёжность, проверенная временем.",
  },
  footer: {
    contactInfo: "Контактная информация",
    socialTitle: "Мы в социальных сетях",
  },
  trust: {
    originalProducts: "Оригинальные российские товары",
    directFromManufacturers: "Напрямую от производителей",
    deliveryToVenezuela: "Доставка в Венесуэлу",
    shipNationwide: "Отправка по всей стране",
    paymentInCurrencies: "Оплата в RUB/VES/USD",
    flexibleTerms: "Гибкие условия для клиентов",
  },
  product: {
    price: "Цена",
    inStock: "В наличии",
    outOfStock: "Нет в наличии",
    onRequest: "По запросу",
    addToCart: "Добавить в заявку",
    details: "Подробнее",
    inCart: "В заявке",
    back: "Назад",
    similar: "Похожие товары",
    selectVariant: "Выберите вариант товара",
    backToProduct: "Вернуться к товару",
    clickVariantToSelect: "Нажмите на вариант ниже для выбора",
  },
  cart: {
    title: "Заявка",
    empty: "Заявка пуста",
    continue: "Продолжить формирование заявки",
    total: "Итого:",
    checkout: "Оформить заказ",
    consult: "Консультация в WhatsApp",
    share: "Поделиться заявкой",
    sendToWhatsApp: "Отправить в WhatsApp",
    clear: "Очистить заявку",
  },
  category: {
    emptyMenu: "Меню каталога пустое",
    chooseCategoryForFilters: "Выберите категорию для отображения фильтров",
  },
  productPage: {
    loading: "Загрузка товара...",
    notFound: "Товар не найден",
    goHome: "Вернуться на главную",
  },
  groups: {
    size: "Размер",
    color: "Цвет",
    variants: "Варианты",
  }
}

const es: Dictionary = {
  common: {
    searchPlaceholder: "Buscar...",
    apply: "Aplicar",
    category: "Categoría",
    showAllProducts: "Mostrar todos los productos",
    showAll: "Ver todo",
    collapse: "Mostrar menos",
    back: "Atrás",
    home: "Inicio",
    products: "Productos",
    allCategories: "Todas las categorías",
    similarProduct: "Producto similar",
    noRecommendations: "No hay recomendaciones disponibles",
    loading: "Cargando...",
    open: "Abrir",
    download: "Descargar",
    share: "Compartir",
    more: "más",
    domesticProduction: "De producción nacional",
    productionInRussia: "Hecho en Rusia",
    quality: "De calidad",
    russianStandards: "Normas rusas",
    reliable: "Fiable",
    timeTested: "Probado por el tiempo",
    sortBy: "Ordenar por...",
    searchSortOptions: "Buscar opciones de ordenación...",
  },
  sort: {
    nameAsc: "Por nombre A-Z",
    nameDesc: "Por nombre Z-A",
    priceAsc: "Por precio ↑",
    priceDesc: "Por precio ↓"
  },
  header: {
    contacts: "Contactos",
    phone: "Teléfono",
    email: "Correo electrónico",
    address: "Dirección",
    additionalContacts: "Contactos adicionales",
    language: "Idioma",
    currency: "Moneda",
    contactSubtitle: "Contáctenos por cualquier medio conveniente",
  },
  hero: {
    madeInRussia: "Hecho en Rusia",
    forVenezuela: "PARA VENEZUELA",
    qualityTraditions: "Calidad y Tradiciones",
    seeProducts: "Ver productos",
    catalogTitle: "Catálogo de productos rusos",
    categories: "Categorías",
    filters: "Filtros",
    activeFilters: "Filtros activos",
    clearAll: "Limpiar todo",
    loadingMore: "Cargando más productos...",
    allLoaded: "Todos los productos cargados",
    alsoRecommend: "También recomendamos",
    defaultSubtitle: "Productos rusos de calidad de fabricantes nacionales. ¡Apoyemos nuestra producción eligiendo lo ruso! Fiabilidad probada por el tiempo.",
  },
  footer: {
    contactInfo: "Información de contacto",
    socialTitle: "Redes sociales",
  },
  trust: {
    originalProducts: "Productos rusos originales",
    directFromManufacturers: "Directo de los fabricantes",
    deliveryToVenezuela: "Envío a Venezuela",
    shipNationwide: "Envíos a todo el país",
    paymentInCurrencies: "Pago en RUB/VES/USD",
    flexibleTerms: "Condiciones flexibles para clientes",
  },
  product: {
    price: "Precio",
    inStock: "En stock",
    outOfStock: "Agotado",
    onRequest: "Bajo petición",
    addToCart: "Añadir a la solicitud",
    details: "Más detalles",
    inCart: "En solicitud",
    back: "Atrás",
    similar: "Productos similares",
    selectVariant: "Elija una variante del producto",
    backToProduct: "Volver al producto",
    clickVariantToSelect: "Pulse en una variante para seleccionar",
  },
  cart: {
    title: "Solicitud",
    empty: "La solicitud está vacía",
    continue: "Continuar creando la solicitud",
    total: "Total:",
    checkout: "Realizar pedido",
    consult: "Consulta por WhatsApp",
    share: "Compartir solicitud",
    sendToWhatsApp: "Enviar a WhatsApp",
    clear: "Vaciar solicitud",
  },
  category: {
    emptyMenu: "El menú del catálogo está vacío",
    chooseCategoryForFilters: "Seleccione una categoría para mostrar filtros",
  },
  productPage: {
    loading: "Cargando producto...",
    notFound: "Producto no encontrado",
    goHome: "Volver a la página principal",
  },
  groups: {
    size: "Talla",
    color: "Color",
    variants: "Variantes",
  }
}

const DICTS: Record<SupportedLanguage, Dictionary> = { ru, es }

interface I18nContextValue {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (path: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Initialize with RU to match SSR and avoid hydration mismatches
  const [language, setLanguageState] = useState<SupportedLanguage>("ru")

  // On mount, restore saved language from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("venorus_lang") as SupportedLanguage | null
      if (saved === "ru" || saved === "es") {
        setLanguageState(saved)
      }
    }
  }, [])

  // Persist changes and update document lang
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("venorus_lang", language)
      try {
        document.documentElement.lang = language
      } catch {}
    }
  }, [language])

  const setLanguage = (lang: SupportedLanguage) => setLanguageState(lang)

  const t = useMemo(() => {
    const getByPath = (dict: Dictionary, path: string): string | undefined => {
      return path.split(".").reduce<any>((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict)
    }
    return (path: string) => {
      const primary = getByPath(DICTS[language], path)
      if (typeof primary === "string") return primary
      const fallback = getByPath(DICTS.ru, path)
      return typeof fallback === "string" ? fallback : path
    }
  }, [language])

  const value: I18nContextValue = { language, setLanguage, t }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}


