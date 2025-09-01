/**
 * Template validation utilities
 * Provides safe validation functions for template data
 */

export interface Characteristics {
  [key: string]: string | number | boolean | Characteristics
}

export const VALIDATION_LIMITS = {
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
  CHARACTERISTICS_MAX_SIZE: 100000 // 100KB limit
} as const

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Safely sanitizes and truncates string input
 * @param input - Input to sanitize (must be string)
 * @param maxLength - Maximum length (must be non-negative integer)
 * @returns Sanitized and truncated string
 * @throws Error if input validation fails
 */
export function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string')
  }
  
  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new Error('maxLength must be a non-negative integer')
  }
  
  const trimmed = input.trim()
  
  // Unicode-safe truncation to prevent breaking multi-byte characters
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  
  // Use Intl.Segmenter if available, fallback to simple substring
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    const segments = Array.from(segmenter.segment(trimmed))
    
    let result = ''
    let byteLength = 0
    
    for (const segment of segments) {
      const segmentBytes = new TextEncoder().encode(segment.segment).length
      if (byteLength + segmentBytes > maxLength) {
        break
      }
      result += segment.segment
      byteLength += segmentBytes
    }
    
    return result
  }
  
  return trimmed.substring(0, maxLength)
}

/**
 * Detects circular references in objects using iterative approach
 * @param obj - Object to check for circular references
 * @returns true if circular reference detected, false otherwise
 */
export function hasCircularReference(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false
  }
  
  const seen = new WeakSet()
  const stack: unknown[] = [obj]
  
  while (stack.length > 0) {
    const current = stack.pop()
    
    if (current === null || typeof current !== 'object') {
      continue
    }
    
    if (seen.has(current)) {
      return true
    }
    
    seen.add(current)
    
    // Handle both enumerable and symbol properties
    const keys = [
      ...Object.keys(current),
      ...Object.getOwnPropertySymbols(current)
    ]
    
    for (const key of keys) {
      const value = (current as Record<string | symbol, unknown>)[key]
      if (typeof value === 'object' && value !== null) {
        stack.push(value)
      }
    }
  }
  
  return false
}

/**
 * Validates characteristics object size and structure
 * @param characteristics - Characteristics object to validate
 * @returns ValidationResult with success status and error message
 */
export function validateCharacteristicsSize(characteristics: Characteristics): ValidationResult {
  try {
    // Check for circular references first (fast check)
    if (hasCircularReference(characteristics)) {
      return { 
        valid: false, 
        error: 'Circular reference detected in characteristics' 
      }
    }
    
    // Validate object structure
    if (typeof characteristics !== 'object' || characteristics === null || Array.isArray(characteristics)) {
      return { 
        valid: false, 
        error: 'Characteristics must be a valid object' 
      }
    }
    
    // Safe JSON serialization with size check
    const serialized = JSON.stringify(characteristics)
    const sizeInBytes = new TextEncoder().encode(serialized).length
    
    if (sizeInBytes > VALIDATION_LIMITS.CHARACTERISTICS_MAX_SIZE) {
      return {
        valid: false,
        error: `Characteristics exceed maximum size of ${VALIDATION_LIMITS.CHARACTERISTICS_MAX_SIZE} bytes (current: ${sizeInBytes} bytes)`
      }
    }
    
    return { valid: true }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown serialization error'
    return { 
      valid: false, 
      error: `Failed to validate characteristics structure: ${errorMessage}` 
    }
  }
}

/**
 * Comprehensive input validation for template data
 * @param name - Template name
 * @param description - Template description (optional)
 * @param characteristics - Template characteristics
 * @returns ValidationResult with details
 */
export function validateTemplateInput(
  name: unknown,
  description: unknown,
  characteristics: unknown
): ValidationResult {
  try {
    // Validate name
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { valid: false, error: 'Name must be a non-empty string' }
    }
    
    if (name.trim().length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
      return { valid: false, error: `Name exceeds maximum length of ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters` }
    }
    
    // Validate description (optional)
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return { valid: false, error: 'Description must be a string or null' }
      }
      
      if (description.trim().length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
        return { valid: false, error: `Description exceeds maximum length of ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters` }
      }
    }
    
    // Validate characteristics
    if (typeof characteristics !== 'object' || characteristics === null || Array.isArray(characteristics)) {
      return { valid: false, error: 'Characteristics must be a valid object' }
    }
    
    // Use existing characteristics validation
    const characteristicsResult = validateCharacteristicsSize(characteristics as Characteristics)
    if (!characteristicsResult.valid) {
      return characteristicsResult
    }
    
    return { valid: true }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
    return { valid: false, error: `Validation failed: ${errorMessage}` }
  }
}

/**
 * Safe template data sanitization
 * @param name - Template name
 * @param description - Template description (optional)
 * @returns Sanitized template data
 */
export interface SanitizedTemplateData {
  name: string
  description: string | null
}

export function sanitizeTemplateData(name: string, description?: string | null): SanitizedTemplateData {
  return {
    name: sanitizeString(name, VALIDATION_LIMITS.NAME_MAX_LENGTH),
    description: description ? sanitizeString(description, VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) : null
  }
}