"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useAdminStore } from "@/lib/stores"

interface BulkActionsProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  type: "products" | "categories"
}

export function BulkActions({ selectedIds, onSelectionChange, type }: BulkActionsProps) {
  const [bulkAction, setBulkAction] = useState("")
  const updateProduct = useAdminStore(state => state.updateProduct)
  const deleteProduct = useAdminStore(state => state.deleteProduct)
  const updateCategory = useAdminStore(state => state.updateCategory)
  const deleteCategory = useAdminStore(state => state.deleteCategory)

  const handleBulkAction = () => {
    if (!bulkAction || selectedIds.length === 0) return

    switch (bulkAction) {
      case "delete":
        if (confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) {
          selectedIds.forEach((id) => {
            const numId = parseInt(id, 10)
            switch (type) {
              case "products":
                deleteProduct(numId)
                break
              case "categories":
                deleteCategory(numId)
                break
            }
          })
          onSelectionChange([])
        }
        break
      case "activate":
        selectedIds.forEach((id) => {
          const numId = parseInt(id, 10)
          switch (type) {
            case "products":
              updateProduct(numId, { inStock: true })
              break
            case "categories":
              updateCategory(numId, { is_active: true })
              break
          }
        })
        onSelectionChange([])
        break
      case "deactivate":
        selectedIds.forEach((id) => {
          const numId = parseInt(id, 10)
          switch (type) {
            case "products":
              updateProduct(numId, { inStock: false })
              break
            case "categories":
              updateCategory(numId, { is_active: false })
              break
          }
        })
        onSelectionChange([])
        break
    }
    setBulkAction("")
  }

  if (selectedIds.length === 0) return null

  return (
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <span className="text-sm font-medium">
        {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
      </span>
      <SearchableSelect
        options={[
          { value: "activate", label: "Activate" },
          { value: "deactivate", label: "Deactivate" },
          { value: "delete", label: "Delete" }
        ]}
        value={bulkAction}
        onValueChange={setBulkAction}
        placeholder="Выберите действие..."
        searchPlaceholder="Поиск действий..."
        className="w-48"
      />
      <Button onClick={handleBulkAction} disabled={!bulkAction} className="bg-teal-500 hover:bg-teal-600">
        Apply
      </Button>
      <Button variant="outline" onClick={() => onSelectionChange([])}>
        Clear Selection
      </Button>
    </div>
  )
}
