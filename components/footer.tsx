"use client"

import Link from "next/link"
import { Mail, Phone, MapPin } from "lucide-react"
import FactoryIcon from '@mui/icons-material/Factory'
import HomeIcon from '@mui/icons-material/Home'
import { AdditionalContacts } from "@/components/additional-contacts"
import { useAdminStore } from "@/lib/stores"
import { SafeImage } from "@/components/safe-image"
import { useI18n } from "@/components/i18n-provider"
export function Footer() {
  const { t } = useI18n()
  const siteSettings = useAdminStore(state => state.settings)

  return (
    <footer className="border-t bg-muted/30">
      {/* Main Footer */}
      <div className="container mx-auto px-4 lg:px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Company Info */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <SafeImage src="/logo.webp?v=2" alt="Venorus" width={28} height={28} className="w-7 h-7" />
              </div>
              <span className="text-xl font-semibold">
                {siteSettings?.siteName || "Venorus"}
              </span>
            </Link>
            
            <div className="space-y-2 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <FactoryIcon className="w-4 h-4" />
                <span>{t('common.qualityAndReliability')}</span>
              </div>
              <div className="flex items-center gap-2">
                <HomeIcon className="w-4 h-4" />
                <span><strong>{t('hero.madeInRussia')}</strong> {t('common.deliveryAcrossVenezuela')}</span>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full"></div>
                <span>{t('common.domesticProduction')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full"></div>
                <span>{t('common.quality')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full"></div>
                <span>{t('common.guaranteeAndSupport')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-primary rounded-full"></div>
                <span>{t('common.certifiedInRussia')}</span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4">
              {t('footer.contactInfo')}
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">
                  121615, Moscú, Rublévskoe sh., 26
                </span>
              </div>

              <Link href="tel:+74951326265" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>+7 495 132-62-65 (Rusia)</span>
              </Link>

              <Link href="tel:+584142328611" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>+58 414-2328611 (Venezuela - William Warrick)</span>
              </Link>

              <Link href="mailto:info@venorus.ru" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>info@venorus.ru</span>
              </Link>
            </div>

            {/* Additional Contacts */}
            {siteSettings?.additionalContacts && siteSettings.additionalContacts.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h5 className="text-sm font-medium mb-3">{t('header.additionalContacts')}</h5>
                <AdditionalContacts
                  contacts={siteSettings.additionalContacts}
                  className="space-y-2"
                  theme="light"
                />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t bg-muted/50">
        <div className="container mx-auto px-4 lg:px-6 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} <span className="font-medium">{siteSettings?.siteName || "Venorus"}</span>. {t('common.allRightsReserved')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
