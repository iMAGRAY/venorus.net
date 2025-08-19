import type { ReactNode } from "react"

function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="container mx-auto px-4 py-3">
          <div className="text-sm font-semibold bg-gradient-to-r from-red-700 to-blue-700 bg-clip-text text-transparent">Админ-панель</div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

export default AdminLayout
export { AdminLayout }
