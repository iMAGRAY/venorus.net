import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SkeletonProvider } from "@/components/skeleton-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { InstantNavigationProvider } from "@/components/instant-navigation-provider"
import { CartProvider } from "@/lib/cart-context"
import { OrdersProvider } from "@/lib/orders-context"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Venorus - Качественные российские протезы и ортопедические изделия",
  description: "Производство высококачественных протезов и ортопедических изделий в России. Проверенные технологии и индивидуальный подход.",
  keywords: "российские протезы, ортопедия, медицинские изделия, производство в России, реабилитация",
  icons: {
    icon: [
      {
        url: '/logo.webp',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/logo.webp',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Улучшенный обработчик ошибок загрузки чанков
              (function() {
                let reloadAttempts = 0;
                const maxReloads = 2;
                const reloadKey = 'chunkReloadCount';
                
                // Получаем счетчик перезагрузок из sessionStorage
                const getReloadCount = () => parseInt(sessionStorage.getItem(reloadKey) || '0');
                const setReloadCount = (count) => sessionStorage.setItem(reloadKey, count.toString());
                
                // Обработчик ошибок
                const handleChunkError = (isPromise) => {
                  reloadAttempts = getReloadCount();
                  
                  if (reloadAttempts < maxReloads) {
                    setReloadCount(reloadAttempts + 1);
                    // Задержка перед перезагрузкой
                    setTimeout(() => window.location.reload(), 1000);
                  } else {
                    // Сброс счетчика после максимума попыток
                    setReloadCount(0);
                    // Показываем сообщение пользователю вместо бесконечных перезагрузок
                    if (document.body) {
                      const msg = document.createElement('div');
                      msg.style.cssText = 'position:fixed;top:10px;right:10px;background:#ef4444;color:white;padding:10px;border-radius:5px;z-index:9999';
                      msg.textContent = 'Ошибка загрузки. Попробуйте очистить кэш браузера.';
                      document.body.appendChild(msg);
                      setTimeout(() => msg.remove(), 5000);
                    }
                  }
                };
                
                // Сброс счетчика при успешной загрузке
                window.addEventListener('load', () => {
                  setTimeout(() => setReloadCount(0), 3000);
                });
                
                // Обработчик ошибок загрузки
                window.addEventListener('error', function(event) {
                  if (event.message && event.message.includes('ChunkLoadError')) {
                    event.preventDefault();
                    handleChunkError(false);
                  }
                });
                
                // Обработчик промисов
                window.addEventListener('unhandledrejection', function(event) {
                  if (event.reason && (event.reason.name === 'ChunkLoadError' || 
                      (event.reason.message && event.reason.message.includes('Loading chunk')))) {
                    event.preventDefault();
                    handleChunkError(true);
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} notion-page`}>
        <OrdersProvider>
        <CartProvider>
          <InstantNavigationProvider>
            <I18nProvider>
              <SkeletonProvider>
                {children}
                <Toaster position="top-right" />
              </SkeletonProvider>
            </I18nProvider>
          </InstantNavigationProvider>
        </CartProvider>
        </OrdersProvider>
      </body>
    </html>
  )
}
