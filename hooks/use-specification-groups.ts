import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { SpecGroup, ProductCharacteristic } from './use-specifications-data'

export function useSpecificationGroups(
  productCharacteristics: ProductCharacteristic[], 
  setProductCharacteristics: (chars: ProductCharacteristic[]) => void,
  isNewProduct = false
) {
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [activeStep, setActiveStep] = useState<'groups' | 'configure' | 'manage'>('groups')

  // Initialize collapsed groups
  useEffect(() => {
    if (selectedGroups.size > 0) {
      // Collapse all groups except the first one for compactness
      const groupsArray = Array.from(selectedGroups)
      const groupsToCollapse = groupsArray.slice(1) // Keep first group expanded
      setCollapsedGroups(new Set(groupsToCollapse))
    }
  }, [selectedGroups])

  // Update selected groups based on existing characteristics
  useEffect(() => {
    if (productCharacteristics.length > 0) {
      const existingGroupIds = new Set(productCharacteristics.map(char => char.group_id))
      setSelectedGroups(existingGroupIds)
      
      if (productCharacteristics.length > 0) {
        setActiveStep('manage')
      }
    }
  }, [productCharacteristics])

  // Handle group toggle
  const handleGroupToggle = useCallback((groupId: number, event?: React.MouseEvent) => {
    event?.stopPropagation()
    event?.preventDefault()

    // Validate groupId
    if (isNaN(groupId) || groupId === 0) {
      toast.error('Ошибка: некорректный ID группы')
      return
    }

    setSelectedGroups(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(groupId)) {
        newSelected.delete(groupId)
        // Remove characteristics of this group
        setProductCharacteristics(
          productCharacteristics.filter(char => char.group_id !== groupId)
        )
      } else {
        newSelected.add(groupId)
      }
      return newSelected
    })
  }, [productCharacteristics, setProductCharacteristics])

  // Handle group collapse toggle
  const toggleGroupCollapse = useCallback((groupId: number) => {
    setCollapsedGroups(prev => {
      const newCollapsed = new Set(prev)
      if (newCollapsed.has(groupId)) {
        newCollapsed.delete(groupId)
      } else {
        newCollapsed.add(groupId)
      }
      return newCollapsed
    })
  }, [])

  // Proceed to next step
  const proceedToNextStep = useCallback(() => {
    if (selectedGroups.size === 0) {
      toast.error('Выберите хотя бы одну группу характеристик')
      return
    }

    if (activeStep === 'groups') {
      setActiveStep('configure')
    } else if (activeStep === 'configure') {
      setActiveStep('manage')
    }
  }, [selectedGroups, activeStep])

  // Go back to previous step
  const goBackToStep = useCallback((step: 'groups' | 'configure' | 'manage') => {
    setActiveStep(step)
  }, [])

  return {
    selectedGroups,
    collapsedGroups,
    activeStep,
    handleGroupToggle,
    toggleGroupCollapse,
    proceedToNextStep,
    goBackToStep,
    setActiveStep
  }
}