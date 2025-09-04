"use client"

import Link from "next/link"
import { Mail, Phone, MapPin, Youtube } from "lucide-react"
import { VkIcon, TelegramIcon, OkIcon } from "@/components/social-icons"
import FactoryIcon from '@mui/icons-material/Factory'
import StarIcon from '@mui/icons-material/Star'
import ShieldIcon from '@mui/icons-material/Shield'
import VerifiedIcon from '@mui/icons-material/Verified'
import HomeIcon from '@mui/icons-material/Home'
import { AdditionalContacts } from "@/components/additional-contacts"
import { useAdminStore } from "@/lib/stores"
import { SafeImage } from "@/components/safe-image"
import { useI18n } from "@/components/i18n-provider"
export function Footer() {
  const { t } = useI18n()
  const siteSettings = useAdminStore(state => state.settings)

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-red-50/70 via-white to-blue-50/60">
      {/* Декоративные элементы */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-gradient-to-br from-red-200/20 to-blue-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-32 h-32 bg-gradient-to-tr from-red-100/30 to-blue-100/20 rounded-full blur-2xl"></div>
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-br from-red-300/10 to-blue-300/15 rounded-full blur-xl"></div>

      {/* Main Footer */}
      <div className="relative z-10 container mx-auto px-2 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Company Info */}
          <div>
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-blue-200/40 p-6 shadow-lg shadow-blue-100/20">
              <Link href="/" className="flex items-center gap-3 text-xl font-bold mb-4 group">
                <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-blue-100 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
                  <SafeImage src="/logo.webp?v=2" alt="Venorus - Товары из России" width={32} height={32} className="w-8 h-8 object-contain" />
                </div>
                <span className="bg-gradient-to-r from-red-700 to-blue-700 bg-clip-text text-transparent group-hover:from-red-600 group-hover:to-blue-600 transition-all duration-300">
                  {siteSettings?.siteName || "Venorus"}
                </span>
              </Link>
              <div className="text-slate-600 mb-6 leading-relaxed">
                <span className="flex items-center gap-2 mb-2">
                  <FactoryIcon className="w-5 h-5" />
                  {t('common.qualityAndReliability')}
                </span>
                <span className="flex items-center gap-2">
                  <HomeIcon className="w-5 h-5" />
                  <strong>{t('hero.madeInRussia')}</strong> {t('common.deliveryAcrossVenezuela')}
                </span>
              </div>

              {/* Дополнительная информация о компании */}
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                  <span className="flex items-center gap-2">
                    <FactoryIcon className="w-4 h-4" />
                    <strong>{t('common.domesticProduction')}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-red-500 to-red-600 rounded-full"></div>
                  <span className="flex items-center gap-2">
                    <StarIcon className="w-4 h-4" />
                    <strong>{t('common.quality')}</strong> - {t('common.timeTested')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-white to-white rounded-full border border-red-300"></div>
                  <span className="flex items-center gap-2">
                    <ShieldIcon className="w-4 h-4" />
                    <strong>{t('common.guaranteeAndSupport')}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full"></div>
                  <span className="flex items-center gap-2">
                    <VerifiedIcon className="w-4 h-4" />
                    {t('common.certifiedInRussia')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-blue-200/40 p-6 shadow-lg shadow-blue-100/20">
              <h4 className="text-lg font-bold mb-6 bg-gradient-to-r from-red-700 to-blue-700 bg-clip-text text-transparent">
                {t('footer.contactInfo')}
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 transition-all duration-300 group">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors duration-300">
                      121615, Москва, Рублевское ш., д. 26
                    </p>
                  </div>
                </div>

                <Link href="tel:+74951326265" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 transition-all duration-300 group">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-slate-600 group-hover:text-blue-700 transition-colors duration-300 font-medium">
                    +7 495 132-62-65
                  </span>
                </Link>

                <Link href="mailto:info@venorus.ru" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-blue-50 transition-all duration-300 group">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-slate-600 group-hover:text-blue-700 transition-colors duration-300 font-medium">
                    info@venorus.ru
                  </span>
                </Link>
              </div>

              {/* Additional Contacts */}
              {siteSettings?.additionalContacts && siteSettings.additionalContacts.length > 0 && (
                <div className="mt-6 pt-6 border-t border-blue-200/40">
                  <h5 className="text-sm font-semibold text-blue-700 mb-4">{t('header.additionalContacts')}</h5>
                  <AdditionalContacts
                    contacts={siteSettings.additionalContacts}
                    className="space-y-2"
                    theme="light"
                  />
                </div>
              )}

              {/* Social Media */}
              {(siteSettings?.socialMedia?.vk || siteSettings?.socialMedia?.telegram ||
                siteSettings?.socialMedia?.youtube || siteSettings?.socialMedia?.ok) && (
                <div className="mt-6 pt-6 border-t border-blue-200/40">
                  <h5 className="text-sm font-semibold text-blue-700 mb-4">{t('footer.socialTitle')}</h5>
                  <div className="flex gap-3">
                    {siteSettings.socialMedia?.vk && (
                      <a
                        href={siteSettings.socialMedia.vk}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-gradient-to-br from-red-500 to-blue-500 rounded-xl flex items-center justify-center hover:from-red-600 hover:to-blue-600 transition-all duration-300 hover:scale-110 shadow-lg"
                        title="VKontakte"
                      >
                        <VkIcon className="w-6 h-6 text-white" />
                      </a>
                    )}
                    {siteSettings.socialMedia?.telegram && (
                      <a
                        href={siteSettings.socialMedia.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-gradient-to-br from-red-500 to-blue-500 rounded-xl flex items-center justify-center hover:from-red-600 hover:to-blue-600 transition-all duration-300 hover:scale-110 shadow-lg"
                        title="Telegram"
                      >
                        <TelegramIcon className="w-6 h-6 text-white" />
                      </a>
                    )}
                    {siteSettings.socialMedia?.youtube && (
                      <a
                        href={siteSettings.socialMedia.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-gradient-to-br from-red-500 to-blue-500 rounded-xl flex items-center justify-center hover:from-red-600 hover:to-blue-600 transition-all duration-300 hover:scale-110 shadow-lg"
                        title="YouTube"
                      >
                        <Youtube className="w-6 h-6 text-white" />
                      </a>
                    )}
                    {siteSettings.socialMedia?.ok && (
                      <a
                        href={siteSettings.socialMedia.ok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-gradient-to-br from-red-500 to-blue-500 rounded-xl flex items-center justify-center hover:from-red-600 hover:to-blue-600 transition-all duration-300 hover:scale-110 shadow-lg"
                        title="Odnoklassniki"
                      >
                        <OkIcon className="w-6 h-6 text-white" />
                      </a>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="relative z-10 border-t border-blue-200/40 bg-white/40 backdrop-blur-xl">
        <div className="container mx-auto px-2 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-center items-center">
            <div className="text-center">
              <p className="text-sm text-slate-600 font-medium mb-2">
                © {new Date().getFullYear()} <span className="bg-gradient-to-r from-red-600 to-blue-600 bg-clip-text text-transparent font-semibold">{siteSettings?.siteName || "Venorus"}</span>. {t('common.allRightsReserved')}
              </p>
              <p className="text-xs text-slate-500 italic">
                <span className="flex items-center gap-2 justify-center">
                  <HomeIcon className="w-4 h-4" />
                  <strong>{t('common.qualityAndReliability')}</strong>
                  <HomeIcon className="w-4 h-4" />
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
