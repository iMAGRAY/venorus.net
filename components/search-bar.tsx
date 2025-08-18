"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder }: SearchBarProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState("")

  const handleSearch = (value: string) => {
    setQuery(value)
    onSearch(value)
  }

  const clearSearch = () => {
    setQuery("")
    onSearch("")
  }

  return (
    <div className="relative flex-1 max-w-md">
      {/* Фоновый градиент */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-100/30 to-blue-100/30 rounded-lg blur-sm"></div>

      <div className="relative bg-white/80 backdrop-blur-lg rounded-lg border border-blue-200/50 shadow-md shadow-blue-100/20 overflow-hidden">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-600" />
      <Input
        type="text"
        placeholder={placeholder || t('common.searchPlaceholder')}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-10 border-0 bg-transparent placeholder:text-blue-500/70 text-slate-800 focus:ring-0 focus:outline-none"
      />
      {query && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-blue-100/50 rounded-md text-blue-600 hover:text-blue-700"
        >
            <X className="w-3 h-3" />
        </Button>
      )}
      </div>
    </div>
  )
}
