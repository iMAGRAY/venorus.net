"use client"

import { AdminLayout } from "@/components/admin/admin-layout"

export default function CatalogFilesPage() {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Управление каталогами</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Страница временно недоступна. Ведутся технические работы.
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}