"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X, Phone, Mail, MapPin, ClipboardList } from "lucide-react"
import { useAdminStore } from "@/lib/stores"
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
        size="sm"
        className="relative h-9"
      >
        <ClipboardList className="w-4 h-4" />
      </Button>
    )
  }

  return (
    <CartDrawer>
      <Button
        variant="outline"
        size="sm"
        id="cart-button"
        className="relative h-9"
      >
        <ClipboardList className="w-4 h-4" />
        {totalItems > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-primary text-primary-foreground border-0 text-2xs min-w-[16px] h-4 flex items-center justify-center p-0 rounded-full">
            {totalItems}
          </Badge>
        )}
      </Button>
    </CartDrawer>
  )
}

export default function Header() {
  const { t } = useI18n()
  const siteSettings = useAdminStore(state => state.settings)
  const isInitialized = useAdminStore(state => state.initialized.settings)
  const initializeSettings = useAdminStore(state => state.initializeSettings)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Inicialización de configuraciones
  useEffect(() => {
    if (!isInitialized) {
      initializeSettings()
    }
  }, [isInitialized, initializeSettings])


  const navLinks = [
    { href: "#contact", label: t('header.contacts') },
  ]
  const contactLink = navLinks.find((l) => l.href === "#contact")

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsContactModalOpen(true)
    // Cerrar menú lateral al abrir modal de contactos
    setIsSheetOpen(false)
  }

  // Функция для обработки открытия/закрытия бокового меню
  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    // Cerrar modal de contactos al abrir menú lateral
    if (open) {
      setIsContactModalOpen(false)
    }
  }

  return (
    <>
      {/* Banda promocional superior eliminada según especificaciones */}

      <header className="sticky top-0 z-50 w-full backdrop-blur-md border-b bg-background/80 border-border">
        <div className="container flex items-center h-14 mx-auto px-4 lg:px-6">
          {/* Логотип */}
          <div className="flex items-center">
            <InstantLink href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="w-7 h-7 flex items-center justify-center">
                <SafeImage src="/logo.webp?v=2" alt="Venorus" width={24} height={24} className="w-6 h-6" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Venorus</span>
            </InstantLink>
          </div>

          {/* Центральная навигация */}
          <nav className="flex-1 hidden md:flex items-center justify-center">
            <div className="flex items-center gap-1">
              {navLinks.filter((l) => l.href !== "#contact").map((link) => (
                <InstantLink
                  key={link.label}
                  href={link.href}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                >
                  {link.label}
                </InstantLink>
              ))}
            </div>
          </nav>

          {/* Правая часть */}
          <div className="flex items-center gap-3">
            {/* Контакты (десктоп) */}
            <div className="hidden md:flex">
              {[contactLink].map((link) => (
                link?.href === "#contact" ? (
                  <button
                    key={link.label}
                    onClick={handleContactClick}
                    className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                  >
                    {link.label}
                  </button>
                ) : null
              ))}
            </div>


            {/* Carrito */}
            <SafeCartButton />

            {/* Мобильное меню */}
            <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9"
                >
                  <Menu className="w-4 h-4" />
                  <span className="sr-only">Menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-xs">
                <nav className="grid gap-2 py-4">
                  <InstantLink href="/" className="flex items-center gap-2 mb-6">
                    <div className="w-7 h-7 flex items-center justify-center">
                      <SafeImage
                        src="/logo.webp?v=2"
                        alt="Venorus"
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <span className="text-lg font-semibold">Venorus</span>
                  </InstantLink>


                  {navLinks.map((link) => (
                    link.href === "#contact" ? (
                      <button
                        key={link.label}
                        onClick={(e) => {
                          handleContactClick(e);
                          setIsSheetOpen(false);
                        }}
                        className="text-left px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <InstantLink
                        key={link.label}
                        href={link.href}
                        className="text-left px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
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

      {/* Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsContactModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full h-full sm:h-auto sm:w-auto flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-card rounded-2xl shadow-lg w-full sm:max-w-lg p-6 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto border">
              {/* Close Button */}
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="mb-6 pr-12">
                <h2 className="text-2xl font-semibold mb-2">
                  {t('header.contacts')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t('header.contactSubtitle')}
                </p>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                {/* Phone */}
                <a href="tel:+74951326265" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Teléfono</p>
                      <p className="text-sm text-muted-foreground">
                        +7 495 132-62-65
                      </p>
                    </div>
                  </div>
                </a>

                {/* Venezuela Phone - William Warrick */}
                <a href="tel:+584142328611" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Venezuela</p>
                      <p className="text-sm text-muted-foreground">
                        +58 414-2328611
                      </p>
                      <p className="text-xs text-muted-foreground">
                        William Warrick
                      </p>
                    </div>
                  </div>
                </a>

                {/* Email */}
                <a href="mailto:info@venorus.ru" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <Mail className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Email</p>
                      <p className="text-sm text-muted-foreground">
                        info@venorus.ru
                      </p>
                    </div>
                  </div>
                </a>

                {/* Address */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Dirección</p>
                    <p className="text-sm text-muted-foreground">
                      121615, Москва, Рублевское ш., д. 26
                    </p>
                  </div>
                </div>

                {/* Additional Contacts */}
                {(siteSettings as any)?.additionalContacts && (siteSettings as any).additionalContacts.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-4">
                      Contactos adicionales
                    </h3>
                    <AdditionalContacts
                      contacts={(siteSettings as any).additionalContacts}
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
