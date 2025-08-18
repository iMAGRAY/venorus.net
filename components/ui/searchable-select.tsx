"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronsUpDown, Check, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useI18n } from "@/components/i18n-provider"

export interface SelectOption {
  value: string
  label: string
}

export function createSelectOptions<T extends Record<string, any>>(items: T[], valueKey: keyof T, labelKey: keyof T): SelectOption[] {
  return items.map((item) => ({ value: String(item[valueKey]), label: String(item[labelKey]) }))
}

interface SearchableSelectProps extends React.HTMLAttributes<HTMLButtonElement> {
  options: SelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
}

export function SearchableSelect({ options, value, onValueChange, placeholder = "Select...", searchPlaceholder = "Search...", className }: SearchableSelectProps) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)

  const renderLabel = (label: string) => {
    // if label looks like an i18n key (contains dot), try translate
    return label.includes('.') ? t(label) : label
  }

  const selected = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selected ? renderLabel(selected.label) : (placeholder || 'Select...')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} icon={<Search className="h-4 w-4" />} />
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.value}
                onSelect={() => {
                  onValueChange(opt.value)
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                {renderLabel(opt.label)}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}