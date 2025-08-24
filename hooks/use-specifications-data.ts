import { useState, useCallback } from 'react'
import { toast } from 'sonner'

// Interfaces
interface SpecGroup {
  id: number
  name: string
  description?: string
  enum_count?: number
  enum_values?: SpecEnum[]
  parent_id?: number | null
  level?: number
  children?: SpecGroup[]
  source_type?: 'spec_group' | 'category'
  original_id?: number
  enums?: SpecEnum[]
  ordering?: number
}

interface SpecEnum {
  id: number
  group_id: number
  value: string
  description?: string
  is_default?: boolean
  ordering?: number
}

interface CharacteristicTemplate {
  id: number
  name: string
  description?: string
  groups: SpecGroup[]
}

interface ProductCharacteristic {
  id: string
  group_id: number
  group_name: string
  characteristic_type: 'text' | 'numeric' | 'select'
  label: string
  value_numeric?: number
  value_text?: string
  selected_enum_value?: string
  unit_code?: string
  is_primary: boolean
  is_required: boolean
  sort_order: number
}

export function useSpecificationsData(productId?: number, isNewProduct = false) {
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([])
  const [productCharacteristics, setProductCharacteristics] = useState<ProductCharacteristic[]>([])
  const [templates, setTemplates] = useState<CharacteristicTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Helper function for processing hierarchical groups
  const processHierarchicalGroups = useCallback((groups: any[]): SpecGroup[] => {
    const processGroup = (group: any, _index: number): SpecGroup | null => {
      let groupId: number;

      // Handle different ID formats
      if (typeof group.id === 'string' && group.id.startsWith('spec_')) {
        const numericPart = group.id.replace('spec_', '');
        groupId = Number(numericPart);
      } else {
        groupId = Number(group.id);
      }

      // Skip groups with invalid IDs
      if (isNaN(groupId) || groupId <= 0) {
        return null
      }

      const processedGroup: SpecGroup = {
        id: groupId,
        name: group.name || `Group ${groupId}`,
        description: group.description || ''
      }

      return processedGroup
    }

    return groups.map((group, index) => processGroup(group, index)).filter(Boolean) as SpecGroup[]
  }, [])

  // Helper function for processing API characteristics
  const processApiCharacteristics = useCallback((apiData: any[]): ProductCharacteristic[] => {
    return apiData.map(item => ({
      id: `char_${item.id}`,
      group_id: item.group_id,
      group_name: item.group_name,
      characteristic_type: item.type === 'enum' ? 'select' : item.type,
      label: item.label || item.group_name,
      value_numeric: item.value_numeric,
      value_text: item.value_text,
      selected_enum_value: item.enum_value,
      unit_code: item.unit_code,
      is_primary: false,
      is_required: false,
      sort_order: 0
    }))
  }, [])

  // Load specification groups
  const loadSpecGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/specifications')
      if (res.ok) {
        const apiResponse = await res.json()
        const data = apiResponse.data || apiResponse
        const processedGroups = processHierarchicalGroups(data)
        setSpecGroups(processedGroups)
      }
    } catch (_error) {
      toast.error('Не удалось загрузить группы характеристик')
    }
  }, [processHierarchicalGroups])

  // Load product characteristics
  const loadProductCharacteristics = useCallback(async () => {
    if (!productId || isNewProduct) {
      return
    }

    try {
      const res = await fetch(`/api/products/${productId}/characteristics`)
      if (res.ok) {
        const data = await res.json()
        const processedCharacteristics = processApiCharacteristics(data)
        setProductCharacteristics(processedCharacteristics)
      }
    } catch (_error) {
      // Error loading product characteristics
    }
  }, [productId, isNewProduct, processApiCharacteristics])

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/form-templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (_error) {
      // Error loading templates
    }
  }, [])

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadSpecGroups(),
        loadProductCharacteristics(),
        loadTemplates()
      ])
    } finally {
      setLoading(false)
    }
  }, [loadSpecGroups, loadProductCharacteristics, loadTemplates])

  return {
    specGroups,
    productCharacteristics,
    templates,
    loading,
    loadData,
    setProductCharacteristics,
    processApiCharacteristics
  }
}

export type { SpecGroup, ProductCharacteristic, CharacteristicTemplate, SpecEnum }