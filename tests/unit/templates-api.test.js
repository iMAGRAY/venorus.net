/**
 * Comprehensive unit tests for template validation functions
 */

const {
  sanitizeString,
  hasCircularReference,
  validateCharacteristicsSize,
  validateTemplateInput,
  sanitizeTemplateData,
  VALIDATION_LIMITS
} = require('../../lib/validation/template-validators')

describe('Template Validation Functions', () => {
  describe('sanitizeString', () => {
    test('should sanitize and truncate string correctly', () => {
      expect(sanitizeString('  test string  ', 10)).toBe('test strin')
    })
    
    test('should handle Unicode characters safely', () => {
      expect(sanitizeString('Hello 👋 World', 10)).toBe('Hello 👋 W')
    })
    
    test('should throw error for non-string input', () => {
      expect(() => sanitizeString(123, 10)).toThrow('Input must be a string')
      expect(() => sanitizeString(null, 10)).toThrow('Input must be a string')
      expect(() => sanitizeString(undefined, 10)).toThrow('Input must be a string')
    })
    
    test('should throw error for invalid maxLength', () => {
      expect(() => sanitizeString('test', -1)).toThrow('maxLength must be a non-negative integer')
      expect(() => sanitizeString('test', 1.5)).toThrow('maxLength must be a non-negative integer')
      expect(() => sanitizeString('test', 'invalid')).toThrow('maxLength must be a non-negative integer')
    })
    
    test('should handle edge cases', () => {
      expect(sanitizeString('   ', 10)).toBe('')
      expect(sanitizeString('test', 0)).toBe('')
      expect(sanitizeString('test', 4)).toBe('test')
      expect(sanitizeString('test', 100)).toBe('test')
    })
  })
  
  describe('hasCircularReference', () => {
    test('should detect direct circular references', () => {
      const obj = { a: 1 }
      obj.self = obj
      expect(hasCircularReference(obj)).toBe(true)
    })
    
    test('should detect indirect circular references', () => {
      const objA = { name: 'A' }
      const objB = { name: 'B', ref: objA }
      objA.ref = objB
      expect(hasCircularReference(objA)).toBe(true)
    })
    
    test('should detect circular references in arrays', () => {
      const arr = [1, 2, 3]
      arr.push(arr)
      expect(hasCircularReference(arr)).toBe(true)
    })
    
    test('should return false for non-circular objects', () => {
      const obj = { a: 1, b: { c: 2, d: { e: 3 } } }
      expect(hasCircularReference(obj)).toBe(false)
    })
    
    test('should return false for primitives and null', () => {
      expect(hasCircularReference('string')).toBe(false)
      expect(hasCircularReference(123)).toBe(false)
      expect(hasCircularReference(true)).toBe(false)
      expect(hasCircularReference(null)).toBe(false)
      expect(hasCircularReference(undefined)).toBe(false)
    })
    
    test('should handle deep nesting without circular refs', () => {
      const obj = { a: { b: { c: { d: { e: 'deep' } } } } }
      expect(hasCircularReference(obj)).toBe(false)
    })
    
    test('should handle symbol properties', () => {
      const sym = Symbol('test')
      const obj = { [sym]: 'value', normal: 'prop' }
      expect(hasCircularReference(obj)).toBe(false)
    })
  })
  
  describe('validateCharacteristicsSize', () => {
    test('should validate small valid objects', () => {
      const small = { name: 'test', value: 123, nested: { prop: 'value' } }
      const result = validateCharacteristicsSize(small)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
    
    test('should reject objects with circular references', () => {
      const circular = { a: 1 }
      circular.self = circular
      const result = validateCharacteristicsSize(circular)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Circular reference detected')
    })
    
    test('should reject oversized objects', () => {
      const large = { data: 'x'.repeat(200000) } // Exceeds 100KB limit
      const result = validateCharacteristicsSize(large)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceed maximum size')
    })
    
    test('should reject arrays', () => {
      const arr = [1, 2, 3]
      const result = validateCharacteristicsSize(arr)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('must be a valid object')
    })
    
    test('should reject null and primitives', () => {
      expect(validateCharacteristicsSize(null).valid).toBe(false)
      expect(validateCharacteristicsSize('string').valid).toBe(false)
      expect(validateCharacteristicsSize(123).valid).toBe(false)
    })
    
    test('should handle JSON serialization errors gracefully', () => {
      const problematic = {}
      Object.defineProperty(problematic, 'toJSON', {
        value: () => { throw new Error('Serialization error') }
      })
      const result = validateCharacteristicsSize(problematic)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Failed to validate characteristics structure')
    })
  })
  
  describe('validateTemplateInput', () => {
    test('should validate correct input', () => {
      const result = validateTemplateInput(
        'Valid Name',
        'Valid description',
        { type: 'test', value: 123 }
      )
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
    
    test('should validate input with null description', () => {
      const result = validateTemplateInput(
        'Valid Name',
        null,
        { type: 'test' }
      )
      expect(result.valid).toBe(true)
    })
    
    test('should reject invalid name', () => {
      expect(validateTemplateInput('', 'desc', {}).valid).toBe(false)
      expect(validateTemplateInput('   ', 'desc', {}).valid).toBe(false)
      expect(validateTemplateInput(null, 'desc', {}).valid).toBe(false)
      expect(validateTemplateInput(123, 'desc', {}).valid).toBe(false)
    })
    
    test('should reject oversized name', () => {
      const longName = 'x'.repeat(VALIDATION_LIMITS.NAME_MAX_LENGTH + 1)
      const result = validateTemplateInput(longName, 'desc', {})
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Name exceeds maximum length')
    })
    
    test('should reject invalid description type', () => {
      const result = validateTemplateInput('name', 123, {})
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Description must be a string or null')
    })
    
    test('should reject oversized description', () => {
      const longDesc = 'x'.repeat(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH + 1)
      const result = validateTemplateInput('name', longDesc, {})
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Description exceeds maximum length')
    })
    
    test('should reject invalid characteristics', () => {
      expect(validateTemplateInput('name', 'desc', null).valid).toBe(false)
      expect(validateTemplateInput('name', 'desc', []).valid).toBe(false)
      expect(validateTemplateInput('name', 'desc', 'string').valid).toBe(false)
    })
  })
  
  describe('sanitizeTemplateData', () => {
    test('should sanitize valid data', () => {
      const result = sanitizeTemplateData('  Test Name  ', '  Test Description  ')
      expect(result.name).toBe('Test Name')
      expect(result.description).toBe('Test Description')
    })
    
    test('should handle null description', () => {
      const result = sanitizeTemplateData('Test Name', null)
      expect(result.name).toBe('Test Name')
      expect(result.description).toBe(null)
    })
    
    test('should handle undefined description', () => {
      const result = sanitizeTemplateData('Test Name')
      expect(result.name).toBe('Test Name')
      expect(result.description).toBe(null)
    })
    
    test('should truncate oversized inputs', () => {
      const longName = 'x'.repeat(VALIDATION_LIMITS.NAME_MAX_LENGTH + 10)
      const longDesc = 'y'.repeat(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH + 10)
      
      const result = sanitizeTemplateData(longName, longDesc)
      expect(result.name.length).toBeLessThanOrEqual(VALIDATION_LIMITS.NAME_MAX_LENGTH)
      expect(result.description.length).toBeLessThanOrEqual(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH)
    })
  })
  
  describe('VALIDATION_LIMITS', () => {
    test('should have reasonable limits', () => {
      expect(VALIDATION_LIMITS.NAME_MAX_LENGTH).toBe(255)
      expect(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH).toBe(1000)
      expect(VALIDATION_LIMITS.CHARACTERISTICS_MAX_SIZE).toBe(100000)
    })
  })
})