"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

type SupportedLanguage = "es"

type Dictionary = Record<string, any>

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
    defaultSubtitle: "Descubra los mejores productos de fabricantes rusos.",
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
    paymentInCurrencies: "Pago en USD",
    flexibleTerms: "Condiciones flexibles para clientes",
  },
  product: {
    price: "Precio",
    inStock: "En stock",
    outOfStock: "Agotado",
    onRequest: "Bajo petición",
    addToCart: "Añadir",
    details: "Detalles",
    inCart: "En lista",
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
  },
  navigation: {
    fullscreen: {
      withArrows: "← → para navegar, Esc para cerrar",
      escOnly: "Esc para cerrar"
    }
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
  // Always Spanish for frontend
  const [language, setLanguageState] = useState<SupportedLanguage>("es")

  // Language is always Spanish for users
  useEffect(() => {
    // Always Spanish, no need to check localStorage
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
      const value = getByPath(DICTS[language], path)
      // Only Spanish dictionary available
      return typeof value === "string" ? value : path
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