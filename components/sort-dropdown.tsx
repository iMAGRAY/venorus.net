"use client"

import { SearchableSelect, createSelectOptions } from "@/components/ui/searchable-select"
import { sortOptions } from "@/lib/data"
import { useI18n } from "@/components/i18n-provider"

interface SortDropdownProps {
  onSort: (value: string) => void
  currentSort: string
}

export function SortDropdown({ onSort, currentSort }: SortDropdownProps) {
  const options = createSelectOptions(sortOptions, 'value', 'label')
  const { t } = useI18n()

  return (
    <div className="w-48">
      <SearchableSelect
        options={options}
        value={currentSort}
        onValueChange={onSort}
        placeholder={t('common.sortBy')}
        searchPlaceholder={t('common.searchSortOptions')}
        className="notion-select"
      />
    </div>
  )
}
