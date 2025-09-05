import React, { memo } from 'react'

interface Characteristic {
  id?: number
  value_id: number
  value_name: string
  additional_value?: string
  color_hex?: string
  value?: string
  text_value?: string
  enum_value_name?: string
}

interface CharacteristicGroup {
  group_id: number
  group_name: string
  characteristics: Characteristic[]
  group_ordering?: number
}

interface CharacteristicSection {
  section_id: number
  section_name: string
  section_description?: string
  groups: CharacteristicGroup[]
  section_ordering?: number
}

interface ProductCharacteristicsMinimalProps {
  sections: CharacteristicSection[]
}

// Helper function to extract characteristic value
const getCharacteristicValue = (char: Characteristic): string => {
  return String(char.additional_value || char.value_name || char.value || char.text_value || char.enum_value_name || '')
}

function ProductCharacteristicsMinimal({ sections }: ProductCharacteristicsMinimalProps) {
  if (!sections || sections.length === 0) {
    return null
  }
  

  // Фильтруем секции с характеристиками
  const sectionsWithCharacteristics = sections
    .filter(section => section.groups?.some(group => group.characteristics?.length > 0))
    .sort((a, b) => (a.section_ordering || 0) - (b.section_ordering || 0))

  if (sectionsWithCharacteristics.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-cyan-200/30">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">Características del producto</h2>
      </div>

      <div className="p-6 space-y-8">
        {sectionsWithCharacteristics.map((section) => {
          // Группируем характеристики по группам
          const groupedCharacteristics = section.groups
            .filter(group => group.characteristics?.length > 0)
            .sort((a, b) => (a.group_name || '').localeCompare(b.group_name || '', 'es'))

          if (groupedCharacteristics.length === 0) return null

          return (
            <div key={section.section_id} className="mb-8 last:mb-0">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />
                <h3 className="text-base font-semibold text-gray-900 px-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-full py-1">
                  {section.section_name}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />
              </div>
              {section.section_description && (
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {section.section_description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
                {groupedCharacteristics.map((group, index) => {
                  // Фильтруем пустые характеристики и сортируем по алфавиту
                  const sortedCharacteristics = (group.characteristics || [])
                    .filter(char => {
                      const value = getCharacteristicValue(char)
                      return value.trim() !== ''
                    })
                    .sort((a, b) => {
                      const nameA = getCharacteristicValue(a)
                      const nameB = getCharacteristicValue(b)
                      return nameA.localeCompare(nameB, 'es')
                    })
                  
                  // Пропускаем группу, если в ней нет характеристик с значениями
                  if (sortedCharacteristics.length === 0) {
                    return null;
                  }

                  // Чередующийся фон для лучшей читаемости
                  const bgClass = index % 2 === 0 
                    ? "bg-gradient-to-r from-cyan-50/20 to-blue-50/20" 
                    : "bg-gradient-to-r from-slate-50/30 to-gray-50/20";

                  // For each characteristic, display it on its own line
                  return sortedCharacteristics.map((char, charIndex) => {
                    const value = getCharacteristicValue(char)
                    const displayBgClass = charIndex % 2 === 0 
                      ? "bg-gradient-to-r from-cyan-50/20 to-blue-50/20" 
                      : "bg-gradient-to-r from-slate-50/30 to-gray-50/20"
                    
                    return (
                      <div 
                        key={`${group.group_id}_${char.value_id || charIndex}`} 
                        className={`group rounded-lg p-3 transition-all duration-200 hover:shadow-sm border border-gray-100 ${displayBgClass}`}
                      >
                        <div className="text-sm leading-relaxed flex items-center gap-2">
                          {char.color_hex && (
                            <span
                              className="inline-block w-4 h-4 rounded-full border border-gray-300 shadow-sm flex-shrink-0"
                              style={{ backgroundColor: char.color_hex }}
                              title={`Color: ${char.color_hex}`}
                            />
                          )}
                          {group.group_name ? (
                            <div>
                              <span className="font-semibold text-gray-700">{group.group_name}:</span>
                              <span className="ml-2 text-gray-900">{value}</span>
                            </div>
                          ) : (
                            <span className="text-gray-900">{value}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                }).filter(Boolean)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(ProductCharacteristicsMinimal)