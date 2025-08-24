"use client"

import { AdminLayout } from "@/components/admin/admin-layout"

interface MaintenancePageProps {
  title: string
  description?: string
}

export function MaintenancePage({ title, description }: MaintenancePageProps) {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{title}</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">
            Техническое обслуживание
          </h2>
          <p className="text-yellow-700 mb-4">
            {description || 'Страница временно недоступна. Ведутся технические работы по оптимизации системы.'}
          </p>
          <p className="text-sm text-yellow-600">
            Приносим извинения за неудобства. Функциональность будет восстановлена в ближайшее время.
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}