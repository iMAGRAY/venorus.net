"use client"

import { ShieldCheck, Truck, BadgeDollarSign } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

export function TrustStrip() {
  const { t } = useI18n()
  return (
    <div className="w-full bg-white border-y border-slate-200">
      <div className="container mx-auto px-2 sm:px-6 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{t('trust.originalProducts')}</div>
            <div className="text-xs text-slate-500">{t('trust.directFromManufacturers')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{t('trust.deliveryToVenezuela')}</div>
            <div className="text-xs text-slate-500">{t('trust.shipNationwide')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{t('trust.paymentInCurrencies')}</div>
            <div className="text-xs text-slate-500">{t('trust.flexibleTerms')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
