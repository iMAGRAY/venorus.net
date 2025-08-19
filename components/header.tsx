"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X, Phone, Mail, MapPin, ClipboardList, Globe, Banknote } from "lucide-react"
import { useAdminStore } from "@/lib/admin-store"
import { AdditionalContacts } from "@/components/additional-contacts"
import { InstantLink } from "@/components/instant-link"
import { CartDrawer } from "@/components/cart-drawer"
import { useCart } from "@/lib/cart-context"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useI18n } from "@/components/i18n-provider"
import { SafeImage } from "@/components/safe-image"

  // Безопасный компонент списка
function SafeCartButton() {
  const [isClient, setIsClient] = useState(false)
  const cart = useCart()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const totalItems = cart?.totalItems ?? 0

  if (!isClient) {
    return (
      <Button
        variant="outline"
        className="relative bg-gradient-to-r from-red-50 to-blue-50 border-blue-200 text-blue-700 hover:from-red-100 hover:to-blue-100 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md p-3"
      >
        <ClipboardList className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <CartDrawer>
      <Button
        variant="outline"
        id="cart-button"
        className="relative bg-gradient-to-r from-red-50 to-blue-50 border-blue-200 text-blue-700 hover:from-red-100 hover:to-blue-100 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md p-3"
      >
        <ClipboardList className="w-5 h-5" />
        {totalItems > 0 && (
          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-red-600 to-blue-600 text-white border-0 text-xs min-w-[20px] h-5 flex items-center justify-center p-0">
            {totalItems}
          </Badge>
        )}
      </Button>
    </CartDrawer>
  )
}

export default function Header() {
  const { language, setLanguage, t } = useI18n()
  const { siteSettings } = useAdminStore()
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [lang, setLang] = useState<'ru' | 'es'>(language)
  const [currency, setCurrency] = useState<'RUB' | 'USD'>(() => {
    if (typeof window === 'undefined') return 'RUB'
    const saved = localStorage.getItem('venorus_currency')
    return saved === 'USD' ? 'USD' : 'RUB'
  })

  // Сохраняем выбор пользователя
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('venorus_lang', lang)
      localStorage.setItem('venorus_currency', currency)
    }
  }, [lang, currency])

  useEffect(() => {
    // Синхронизируем локальный селектор с провайдером i18n
    if (lang !== language) {
      setLanguage(lang)
    }
  }, [lang, language, setLanguage])

  const navLinks = [
    { href: "#contact", label: t('header.contacts') },
  ]
  const contactLink = navLinks.find((l) => l.href === "#contact")

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsContactModalOpen(true)
    // Закрываем боковое меню при открытии модального окна контактов
    setIsSheetOpen(false)
  }

  // Функция для обработки открытия/закрытия бокового меню
  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    // Закрываем модальное окно контактов при открытии бокового меню
    if (open) {
      setIsContactModalOpen(false)
    }
  }

  return (
    <>
    {/* Верхняя промо-полоска удалена по ТЗ */}

    <header className="sticky top-0 z-50 w-full backdrop-blur-xl border-b bg-white/90 border-blue-200/40 shadow-sm shadow-blue-100/20">
      <div className="container flex items-center h-16 mx-auto px-2 sm:px-6">
        {/* Левая часть - Логотип */}
        <div className="flex-1 flex justify-start">
          <InstantLink href="/" className="flex items-center gap-3 transition-all duration-200 hover:opacity-80">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              <SafeImage src="/logo.webp?v=2" alt="Venorus - Товары из России" width={28} height={28} className="h-7 w-auto max-w-none" />
            </div>
            <span className="text-lg font-semibold text-slate-800 whitespace-nowrap">Venorus</span>
          </InstantLink>
        </div>

        {/* Центральная часть - навигация */}
        <nav className="flex-1 hidden md:flex items-center gap-2 justify-center">
          {navLinks.filter((l) => l.href !== "#contact").map((link) => (
            <InstantLink
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-slate-700 font-medium transition-all duration-300 hover:text-blue-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-lg"
            >
              {link.label}
            </InstantLink>
          ))}
        </nav>

        {/* Правая часть - Контакты и Заявка */}
        <div className="flex-1 flex justify-end items-center gap-4">
          <nav className="hidden md:flex gap-6">
            {[contactLink].map((link) => (
              link?.href === "#contact" ? (
                <button
                  key={link.label}
                  onClick={handleContactClick}
                  className="relative px-4 py-2 text-slate-700 font-medium transition-all duration-300 hover:text-blue-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-lg group"
                >
                  {link.label}
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-red-600 to-blue-600 group-hover:w-full transition-all duration-300"></div>
                </button>
              ) : null
            ))}
          </nav>

          {/* Язык и Валюта (десктоп) */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-slate-700">
              <Globe className="w-3.5 h-3.5" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as 'ru' | 'es')}
                className="bg-transparent text-xs focus:outline-none"
                aria-label="Выбор языка"
              >
                <option value="ru">RU</option>
                <option value="es">ES</option>
              </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-slate-700">
              <Banknote className="w-3.5 h-3.5" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'RUB' | 'USD')}
                className="bg-transparent text-xs focus:outline-none"
                aria-label="Выбор валюты"
              >
                <option value="RUB">RUB ₽</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>

          {/* Заявка */}
          <SafeCartButton />

          {/* Мобильное меню */}
          <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden w-10 h-10 bg-gradient-to-r from-red-50 to-blue-50 border-blue-200 text-blue-700 hover:from-red-100 hover:to-blue-100 hover:border-blue-300 transition-all duration-300"
              >
                <Menu className="w-5 h-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xs bg-gradient-to-br from-white via-red-50/30 to-blue-50/20 backdrop-blur-xl border-blue-200/40">
              <nav className="grid gap-4 py-4">
                  <InstantLink href="/" className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                      <SafeImage
                        src="/logo.webp?v=2"
                        alt="Venorus - Товары из России"
                        width={32}
                        height={32}
                        className="h-6 w-auto max-w-none"
                      />
                    </div>
                    <span className="text-lg font-semibold text-slate-800">Venorus</span>
                </InstantLink>
                {/* Язык и Валюта (мобайл) */}
                <div className="flex items-center gap-2 px-4">
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-slate-700">
                    <Globe className="w-3.5 h-3.5" />
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as 'ru' | 'es')}
                      className="bg-transparent text-xs focus:outline-none"
                      aria-label="Выбор языка"
                    >
                      <option value="ru">RU</option>
                      <option value="es">ES</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-slate-700">
                    <Banknote className="w-3.5 h-3.5" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'RUB' | 'USD')}
                      className="bg-transparent text-xs focus:outline-none"
                      aria-label="Выбор валюты"
                    >
                      <option value="RUB">RUB ₽</option>
                      <option value="USD">USD $</option>
                    </select>
                  </div>
                </div>
                {navLinks.map((link) => (
                  link.href === "#contact" ? (
                    <button
                      key={link.label}
                      onClick={(e) => {
                        handleContactClick(e);
                        setIsSheetOpen(false);
                      }}
                      className="text-left px-4 py-3 text-slate-700 font-medium transition-all duration-300 hover:text-blue-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-lg"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <InstantLink
                      key={link.label}
                      href={link.href}
                      className="text-left px-4 py-3 text-slate-700 font-medium transition-all duration-300 hover:text-blue-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 rounded-lg"
                    >
                      {link.label}
                    </InstantLink>
                  )
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      </header>

      {/* Contact Modal - тиффани стиль */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto">
          {/* Backdrop с красивым блюром */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-blue-900/30 to-blue-900/40 backdrop-blur-md"
            onClick={() => setIsContactModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Фоновый градиент */}
            <div className="absolute inset-0 sm:inset-auto sm:w-full sm:h-full bg-gradient-to-br from-red-100/30 to-blue-100/40 rounded-3xl blur-sm"></div>

            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-200/20 w-full sm:max-w-lg p-6 sm:p-8 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto border border-blue-200/50">
              {/* Close Button - увеличен размер и добавлен отступ для мобильных */}
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-3 sm:p-2 rounded-full bg-gradient-to-r from-red-100/50 to-blue-100/50 text-blue-700 hover:from-red-200/50 hover:to-blue-200/50 transition-all duration-300 hover:scale-110 z-10"
              >
                <X className="w-6 h-6 sm:w-5 sm:h-5" />
              </button>

              {/* Header - добавлен отступ справа для кнопки закрытия */}
              <div className="text-center mb-6 sm:mb-8 pr-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-red-700 to-blue-700 bg-clip-text text-transparent">
                  {t('header.contacts')}
                </h2>
                <p className="text-slate-600">
                  {t('header.contactSubtitle')}
                </p>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                {/* Phone */}
                <a href="tel:+74951326265" className="block">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-red-50/80 to-blue-50/60 border border-blue-200/30 hover:from-red-100/80 hover:to-blue-100/60 hover:border-blue-300/50 transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-600 to-blue-600 flex items-center justify-center shadow-lg">
                      <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Телефон</p>
                      <p className="text-blue-700 font-medium">
                        +7 495 132-62-65
                      </p>
                    </div>
                  </div>
                </a>

                {/* Email */}
                <a href="mailto:info@venorus.ru" className="block">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-red-50/80 to-blue-50/60 border border-blue-200/30 hover:from-red-100/80 hover:to-blue-100/60 hover:border-blue-300/50 transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-600 to-blue-600 flex items-center justify-center shadow-lg">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Email</p>
                      <p className="text-blue-700 font-medium">
                        info@venorus.ru
                      </p>
                    </div>
                  </div>
                </a>

                {/* Address */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-red-50/80 to-blue-50/60 border border-blue-200/30">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-600 to-blue-600 flex items-center justify-center shadow-lg">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Адрес</p>
                    <p className="text-blue-700 font-medium">
                      121615, Москва, Рублевское ш., д. 26
                    </p>
                  </div>
                </div>

                {/* Additional Contacts */}
                {siteSettings?.additionalContacts && siteSettings.additionalContacts.length > 0 && (
                  <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-blue-200/50">
                    <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-red-700 to-blue-700 bg-clip-text text-transparent">
                      Дополнительные контакты
                    </h3>
                    <AdditionalContacts
                      contacts={siteSettings.additionalContacts}
                      className="space-y-3"
                      theme="light"
                    />
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
