"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

type SupportedLanguage = "es"

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
    qualityAndReliability: "Качество и надёжность",
    deliveryAcrossVenezuela: "Доставка по всей Венесуэле",
    guaranteeAndSupport: "Гарантия и поддержка",
    certifiedInRussia: "Сертифицировано в России",
    allRightsReserved: "Все права защищены",
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
    forVenezuela: "ИЗ РОССИИ",
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
    paymentInCurrencies: "Оплата в RUB/USD",
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
    selectAllRequired: "Пожалуйста, выберите все обязательные характеристики",
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
    qualityAndReliability: "Calidad y fiabilidad",
    deliveryAcrossVenezuela: "Entrega en toda Venezuela",
    guaranteeAndSupport: "Garantía y soporte",
    certifiedInRussia: "Certificado en Rusia",
    allRightsReserved: "Todos los derechos reservados",
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
    forVenezuela: "DE RUSIA",
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
    paymentInCurrencies: "Pago en RUB/USD",
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
    selectAllRequired: "Por favor, seleccione todas las características requeridas",
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

const en: Dictionary = {
  common: {
    searchPlaceholder: "Search...",
    apply: "Apply",
    category: "Category",
    showAllProducts: "Show all products",
    showAll: "Show all",
    collapse: "Show less",
    back: "Back",
    home: "Home",
    products: "Products",
    allCategories: "All categories",
    similarProduct: "Similar product",
    noRecommendations: "No recommendations available",
    loading: "Loading...",
    open: "Open",
    download: "Download",
    share: "Share",
    more: "more",
    domesticProduction: "Domestic production",
    productionInRussia: "Made in Russia",
    quality: "Quality",
    russianStandards: "Russian standards",
    reliable: "Reliable",
    timeTested: "Time tested",
    sortBy: "Sort by...",
    searchSortOptions: "Search sort options...",
    qualityAndReliability: "Quality and reliability",
    deliveryAcrossVenezuela: "Delivery across Venezuela",
    guaranteeAndSupport: "Warranty and support",
    certifiedInRussia: "Certified in Russia",
    allRightsReserved: "All rights reserved",
  },
  sort: {
    nameAsc: "By name A-Z",
    nameDesc: "By name Z-A",
    priceAsc: "By price ↑",
    priceDesc: "By price ↓"
  },
  header: {
    contacts: "Contacts",
    phone: "Phone",
    email: "Email",
    address: "Address",
    additionalContacts: "Additional contacts",
    language: "Language",
    currency: "Currency",
    contactSubtitle: "Contact us by any convenient method",
  },
  hero: {
    madeInRussia: "Made in Russia",
    forVenezuela: "FROM RUSSIA",
    qualityTraditions: "Quality and Traditions",
    seeProducts: "See products",
    catalogTitle: "Catalog of Russian products",
    categories: "Categories",
    filters: "Filters",
    activeFilters: "Active filters",
    clearAll: "Clear all",
    loadingMore: "Loading more products...",
    allLoaded: "All products loaded",
    alsoRecommend: "Also recommend",
    defaultSubtitle: "Quality Russian products from domestic manufacturers. Let's support our production - choose Russian! Reliability proven by time.",
  },
  footer: {
    contactInfo: "Contact information",
    socialTitle: "Social networks",
  },
  trust: {
    originalProducts: "Original Russian products",
    directFromManufacturers: "Direct from manufacturers",
    deliveryToVenezuela: "Delivery to Venezuela",
    shipNationwide: "Ship nationwide",
    paymentInCurrencies: "Payment in RUB/USD",
    flexibleTerms: "Flexible terms for customers",
  },
  product: {
    price: "Price",
    inStock: "In stock",
    outOfStock: "Out of stock",
    onRequest: "On request",
    addToCart: "Add to request",
    details: "More details",
    inCart: "In request",
    back: "Back",
    similar: "Similar products",
    selectVariant: "Choose a product variant",
    backToProduct: "Back to product",
    clickVariantToSelect: "Click on a variant below to select",
    selectAllRequired: "Please select all required characteristics",
  },
  cart: {
    title: "Request",
    empty: "Request is empty",
    continue: "Continue creating request",
    total: "Total:",
    checkout: "Place order",
    consult: "WhatsApp consultation",
    share: "Share request",
    sendToWhatsApp: "Send to WhatsApp",
    clear: "Clear request",
  },
  category: {
    emptyMenu: "Catalog menu is empty",
    chooseCategoryForFilters: "Choose a category to display filters",
  },
  productPage: {
    loading: "Loading product...",
    notFound: "Product not found",
    goHome: "Return to home",
  },
  groups: {
    size: "Size",
    color: "Color",
    variants: "Variants",
  }
}

const DICTS: Record<SupportedLanguage, Dictionary> = { es }

interface I18nContextValue {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (path: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with default language for SSR consistency
  const [language, setLanguageState] = useState<SupportedLanguage>("es")

  // Language is always Spanish for users
  useEffect(() => {
    // No need to check localStorage - always use Spanish
  }, [])

  // Persist changes and update document lang - only when language actually changes
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
      const fallback = getByPath(DICTS.es, path)
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


