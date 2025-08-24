import React from 'react'

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

export default function ProductCharacteristicsMinimal({ sections }: ProductCharacteristicsMinimalProps) {
  if (!sections || sections.length === 0) {
    return null
  }
  
  // Проверяем структуру данных и логируем для отладки
  try {
    
    sections.forEach(section => {
      if (section.groups) {
        section.groups.forEach(group => {
          if (group.characteristics && !Array.isArray(group.characteristics)) {
            console.error('Characteristics is not an array:', group.characteristics)
          }
        })
      }
    })
  } catch (e) {
    console.error('Error in sections structure:', e)
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
        <h2 className="text-lg font-semibold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">Характеристики</h2>
      </div>

      <div className="p-6 space-y-8">
        {sectionsWithCharacteristics.map((section) => {
          // Группируем характеристики по группам
          const groupedCharacteristics = section.groups
            .filter(group => group.characteristics?.length > 0)
            .sort((a, b) => (a.group_name || '').localeCompare(b.group_name || '', 'ru'))

          if (groupedCharacteristics.length === 0) return null

          return (
            <div key={section.section_id}>
              <h3 className="text-base font-semibold text-gray-900 mb-5 pb-2 border-b border-cyan-200/30">
                {section.section_name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
                {groupedCharacteristics.map((group, index) => {
                  // Фильтруем пустые характеристики и сортируем по алфавиту
                  const sortedCharacteristics = [...group.characteristics]
                    .filter(char => {
                      // Проверяем, есть ли хоть какое-то значение
                      const hasValue = char.additional_value || char.value_name || char.value || char.text_value || char.enum_value_name;
                      return hasValue && String(hasValue).trim() !== '';
                    })
                    .sort((a, b) => {
                      const nameA = String(a.additional_value || a.value_name || a.value || a.text_value || a.enum_value_name || '');
                      const nameB = String(b.additional_value || b.value_name || b.value || b.text_value || b.enum_value_name || '');
                      return nameA.localeCompare(nameB, 'ru');
                    });
                  
                  // Логируем для отладки
                  
                  // Пропускаем группу, если в ней нет характеристик с значениями
                  if (sortedCharacteristics.length === 0) {
                    return null;
                  }

                  // Чередующийся фон для лучшей читаемости
                  const bgClass = index % 2 === 0 
                    ? "bg-gradient-to-r from-cyan-50/20 to-blue-50/20" 
                    : "bg-gradient-to-r from-slate-50/30 to-gray-50/20";

                  return (
                    <div key={group.group_id} className={`group rounded-lg p-3 transition-all duration-200 hover:shadow-sm ${bgClass}`}>
                      <div className="text-sm font-medium text-gray-500 mb-1.5">
                        {group.group_name}
                      </div>
                      <div className="text-sm text-gray-900 font-medium leading-relaxed">
                        {sortedCharacteristics.length === 1 ? (
                          // Одно значение - отображаем в одну строку
                          <div className="flex items-center gap-2">
                            {sortedCharacteristics[0].color_hex && (
                              <div
                                className="w-4 h-4 rounded-full border border-gray-300 shadow-sm flex-shrink-0"
                                style={{ backgroundColor: sortedCharacteristics[0].color_hex }}
                                title={`Цвет: ${sortedCharacteristics[0].color_hex}`}
                              />
                            )}
                            <span className="break-words">
                              {String(sortedCharacteristics[0].additional_value || sortedCharacteristics[0].value_name || sortedCharacteristics[0].value || sortedCharacteristics[0].text_value || sortedCharacteristics[0].enum_value_name || '')}
                            </span>
                          </div>
                        ) : (
                          // Несколько значений - отображаем списком
                          <div className="space-y-1">
                            {sortedCharacteristics.map((char, index) => (
                              <div key={char.value_id || char.id || index} className="flex items-center gap-2">
                                {char.color_hex && (
                                  <div
                                    className="w-4 h-4 rounded-full border border-gray-300 shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: char.color_hex }}
                                    title={`Цвет: ${char.color_hex}`}
                                  />
                                )}
                                <span className="break-words">
                                  {String(char.additional_value || char.value_name || char.value || char.text_value || char.enum_value_name || '')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}