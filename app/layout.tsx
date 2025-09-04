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
  title: "Venorus - Quality Russian Products",
  description: "Platform for promoting Russian products. Quality products from domestic manufacturers with delivery across Venezuela.",
  keywords: "russian products, made in russia, domestic manufacturers, quality products, venezuela import",
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Enhanced chunk loading error handler
              (function() {
                let reloadAttempts = 0;
                const maxReloads = 2;
                const reloadKey = 'chunkReloadCount';
                
                // Get reload counter from sessionStorage
                const getReloadCount = () => parseInt(sessionStorage.getItem(reloadKey) || '0');
                const setReloadCount = (count) => sessionStorage.setItem(reloadKey, count.toString());
                
                // Error handler
                const handleChunkError = (isPromise) => {
                  reloadAttempts = getReloadCount();
                  
                  if (reloadAttempts < maxReloads) {
                    setReloadCount(reloadAttempts + 1);
                    // Delay before reload
                    setTimeout(() => window.location.reload(), 1000);
                  } else {
                    // Reset counter after maximum attempts
                    setReloadCount(0);
                    // Show message to user instead of infinite reloads
                    if (document.body) {
                      const msg = document.createElement('div');
                      msg.style.cssText = 'position:fixed;top:10px;right:10px;background:#ef4444;color:white;padding:10px;border-radius:5px;z-index:9999';
                      msg.textContent = 'Loading error. Try clearing browser cache.';
                      document.body.appendChild(msg);
                      setTimeout(() => msg.remove(), 5000);
                    }
                  }
                };
                
                // Reset counter on successful load
                window.addEventListener('load', () => {
                  setTimeout(() => setReloadCount(0), 3000);
                });
                
                // Loading error handler
                window.addEventListener('error', function(event) {
                  if (event.message && event.message.includes('ChunkLoadError')) {
                    event.preventDefault();
                    handleChunkError(false);
                  }
                });
                
                // Promise handler
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
