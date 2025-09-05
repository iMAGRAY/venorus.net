"use client"

import { ShieldCheck, Truck, BadgeDollarSign } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

export function TrustStrip() {
  const { t } = useI18n()
  return (
    <div className="w-full bg-muted/30 border-y">
      <div className="container mx-auto px-4 lg:px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{t('trust.originalProducts')}</div>
            <div className="text-xs text-muted-foreground">{t('trust.directFromManufacturers')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{t('trust.deliveryToVenezuela')}</div>
            <div className="text-xs text-muted-foreground">{t('trust.shipNationwide')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{t('trust.paymentInCurrencies')}</div>
            <div className="text-xs text-muted-foreground">{t('trust.flexibleTerms')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
