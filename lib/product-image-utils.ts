import { PROSTHETIC_FALLBACK_IMAGE } from "@/lib/fallback-image"
import type { Prosthetic } from "@/lib/data"

/**
 * Security configuration for URL validation
 */
const URL_VALIDATION_CONFIG = {
  MAX_URL_LENGTH: 2048, // Standard maximum URL length
  VALID_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'] as const, // Removed .svg for security
  PATH_TRAVERSAL_PATTERNS: ['../', '..\\', '%2e%2e%2f', '%2e%2e%5c'] as const,
  DANGEROUS_PROTOCOLS: ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'] as const
} as const

/**
 * Helper function to check if a pathname has a valid image extension
 */
function hasValidImageExtension(pathname: string): boolean {
  try {
    // Decode URL-encoded characters to handle encoded extensions
    const decodedPath = decodeURIComponent(pathname).toLowerCase()
    return URL_VALIDATION_CONFIG.VALID_IMAGE_EXTENSIONS.some(ext => 
      decodedPath.endsWith(ext.toLowerCase())
    )
  } catch {
    // If decoding fails, fall back to original path
    const lowercasePath = pathname.toLowerCase()
    return URL_VALIDATION_CONFIG.VALID_IMAGE_EXTENSIONS.some(ext => 
      lowercasePath.endsWith(ext.toLowerCase())
    )
  }
}

/**
 * Helper function to check for path traversal attacks with comprehensive validation
 */
function containsPathTraversal(path: string): boolean {
  const lowercasePath = path.toLowerCase()
  
  // Check basic path traversal patterns
  const hasBasicTraversal = URL_VALIDATION_CONFIG.PATH_TRAVERSAL_PATTERNS.some(pattern => 
    lowercasePath.includes(pattern)
  )
  
  if (hasBasicTraversal) return true
  
  // Try to decode and normalize the path for more comprehensive checking
  try {
    const decodedPath = decodeURIComponent(path).toLowerCase()
    
    // Check for path traversal patterns after decoding
    if (decodedPath.includes('../') || decodedPath.includes('..\\')) {
      return true
    }
    
    // Check for null byte injection
    if (decodedPath.includes('\0')) {
      return true
    }
    
    // Normalize path by removing redundant slashes and check for traversal
    const normalizedPath = decodedPath.replace(/\/+/g, '/').replace(/\\+/g, '\\')
    const pathSegments = normalizedPath.split(/[/\\]/)
    
    // If any segment is '..', it's a traversal attempt
    return pathSegments.includes('..')
    
  } catch {
    // If decoding fails, be conservative and reject
    return true
  }
}

/**
 * Helper function to validate file extension and prevent double extension attacks
 */
function hasSecureImageExtension(pathname: string): boolean {
  try {
    // Decode and normalize the pathname
    const decodedPath = decodeURIComponent(pathname).toLowerCase()
    
    // Split by both forward and back slashes to get the filename
    const pathParts = decodedPath.split(/[/\\]/)
    const filename = pathParts[pathParts.length - 1]
    
    if (!filename) return false
    
    // Check for double extensions (e.g., image.jpg.php)
    const extensionParts = filename.split('.')
    if (extensionParts.length > 2) {
      // More than one extension - potential security risk
      return false
    }
    
    // Get the final extension
    const finalExtension = '.' + extensionParts[extensionParts.length - 1]
    return URL_VALIDATION_CONFIG.VALID_IMAGE_EXTENSIONS.includes(finalExtension as any)
    
  } catch {
    // If decoding fails, fall back to basic check
    return hasValidImageExtension(pathname)
  }
}

/**
 * Type guard to check if a value is a valid and safe image URL string
 * Includes security checks to prevent XSS, path traversal, and validates image file extensions
 * Updated to handle S3 URLs with suffixes
 */
function isValidImageString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  
  // Trim whitespace
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return false
  }
  
  // Check for null byte injection
  if (trimmed.includes('\0')) {
    return false
  }
  
  // Check for maximum URL length to prevent DoS
  if (trimmed.length > URL_VALIDATION_CONFIG.MAX_URL_LENGTH) {
    return false
  }
  
  // Check for path traversal attacks
  if (containsPathTraversal(trimmed)) {
    return false
  }
  
  // Allow relative URLs starting with '/'
  if (trimmed.startsWith('/')) {
    // Normalize path and check for valid extension
    const normalizedPath = trimmed.replace(/\/+/g, '/') // Remove double slashes
    return hasValidImageExtension(normalizedPath)
  }
  
  // For absolute URLs, use URL constructor for proper validation
  try {
    const url = new URL(trimmed)
    
    // Check for dangerous protocols
    const protocol = url.protocol.toLowerCase()
    if (URL_VALIDATION_CONFIG.DANGEROUS_PROTOCOLS.includes(protocol as any)) {
      return false
    }
    
    // Only allow http and https protocols for security
    if (!['http:', 'https:'].includes(protocol)) {
      return false
    }
    
    // Check if pathname is empty after trimming
    if (!url.pathname || url.pathname === '/') {
      return false
    }
    
    // Additional path traversal check on the normalized pathname
    if (containsPathTraversal(url.pathname)) {
      return false
    }
    
    // Special handling for S3 URLs - they often have suffixes after extensions
    if (url.hostname.includes('s3.') || url.hostname.includes('amazonaws.com') || url.hostname.includes('twcstorage.ru')) {
      // For S3 URLs, use a more permissive extension check
      const pathname = url.pathname.toLowerCase()
      const hasImageExt = URL_VALIDATION_CONFIG.VALID_IMAGE_EXTENSIONS.some(ext => 
        pathname.includes(ext.toLowerCase())
      )
      // Still check for dangerous extensions to prevent attacks
      const dangerousExtensions = ['.php', '.asp', '.jsp', '.exe', '.js', '.html', '.htm', '.py']
      const hasDangerousExt = dangerousExtensions.some(ext => pathname.includes(ext))
      
      return hasImageExt && !hasDangerousExt
    }
    
    // For other URLs, use strict extension validation
    return hasValidImageExtension(url.pathname)
    
  } catch {
    // Invalid URL format
    return false
  }
}

/**
 * Safe utility to get product image source with proper fallback handling
 * Includes validation for all image sources and proper type guards
 * 
 * @param product - Product object that may contain image data
 * @returns Valid image source URL or fallback image
 */
/**
 * Helper function to safely validate and return image URL if valid
 * Handles potential exceptions from URL validation gracefully
 * 
 * @param url - URL string to validate, can be null or undefined
 * @returns Valid URL string if validation passes, null otherwise
 * 
 * @example
 * ```typescript
 * const validUrl = tryImageUrl('https://example.com/image.jpg') // Returns the URL
 * const invalidUrl = tryImageUrl('invalid-url') // Returns null
 * const nullUrl = tryImageUrl(null) // Returns null
 * ```
 */
function tryImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }
  
  try {
    // Use our robust validation function with error handling
    if (isValidImageString(url)) {
      return url
    }
  } catch (error) {
    // Log validation errors in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('Image URL validation error:', error, 'URL:', url)
    }
  }
  
  return null
}

/**
 * Safe utility to get product image source with comprehensive fallback handling
 * 
 * Attempts to find a valid image URL from multiple product properties in priority order:
 * 1. image_url (API standard snake_case field)
 * 2. imageUrl (camelCase variant)  
 * 3. primary_image_url (product variants field)
 * 4. primaryImageUrl (camelCase variant)
 * 5. First image from images array
 * 
 * All URLs are validated for security (prevents XSS, path traversal, dangerous extensions)
 * and format correctness before being returned.
 * 
 * @param product - Product object that may contain image data in various fields
 * @returns Valid image source URL or fallback image if no valid source found
 * 
 * @example
 * ```typescript
 * // Product with valid S3 image
 * const product1 = { id: 1, image_url: 'https://s3.example.com/image_abc123.jpg' }
 * const imageUrl = getProductImageSrc(product1) // Returns the S3 URL
 * 
 * // Product with no images
 * const product2 = { id: 2, image_url: null }
 * const fallback = getProductImageSrc(product2) // Returns fallback image
 * 
 * // Invalid product
 * const imageFromNull = getProductImageSrc(null) // Returns fallback image
 * ```
 */
export function getProductImageSrc(product: Prosthetic | null | undefined): string {
  // Validate product object exists and is valid
  if (!product || typeof product !== 'object') {
    return PROSTHETIC_FALLBACK_IMAGE
  }
  
  // Define image source fields in priority order for systematic checking
  const imageSources = [
    product.image_url,           // API standard (snake_case) - highest priority
    product.imageUrl,            // camelCase variant for compatibility
    product.primary_image_url,   // Product variants and detailed product data
    product.primaryImageUrl,     // camelCase variant of primary image
    // First image from images array as last resort
    Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null
  ]
  
  // Find first valid image URL using robust validation
  for (const imageUrl of imageSources) {
    const validUrl = tryImageUrl(imageUrl)
    if (validUrl) {
      return validUrl
    }
  }
  
  // Return fallback if no valid image source found
  return PROSTHETIC_FALLBACK_IMAGE
}

/**
 * Create a robust hash from a string for cache keys using djb2 algorithm
 * DJB2 provides good distribution and fewer collisions than simple hash algorithms
 * 
 * @param str - Input string to hash
 * @returns Base-36 encoded hash string
 * @throws {Error} If input is not a valid string
 * 
 * @example
 * ```typescript
 * const hash = simpleHash('example-data')
 * console.log(hash) // Returns something like "1x2y3z4"
 * ```
 */
function simpleHash(str: string): string {
  // Input validation
  if (typeof str !== 'string') {
    throw new Error('Hash input must be a string')
  }
  
  // Handle edge cases
  if (str.length === 0) {
    return '0'
  }
  
  // Prevent performance issues with extremely long strings
  const maxLength = 10000
  const input = str.length > maxLength ? str.substring(0, maxLength) : str
  
  // DJB2 hash algorithm - better distribution than simple hash
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) + hash) + char // hash * 33 + char
    hash = hash >>> 0 // Convert to 32-bit unsigned integer
  }
  
  return hash.toString(36)
}

/**
 * Create robust cache key that includes all image sources
 * Generates a stable hash from all product image properties with error handling
 * 
 * @param product - Product object to generate cache key for
 * @returns Hashed cache key string based on all image properties
 * @throws {Error} If product serialization fails
 * 
 * @example
 * ```typescript
 * const key = createImageCacheKey(product)
 * console.log(key) // Returns something like "abc123def"
 * ```
 */
function createImageCacheKey(product: Prosthetic): string {
  try {
    // For performance, limit images array to first few items if it's large
    const imagesArray = Array.isArray(product.images) ? product.images.slice(0, 10) : null
    
    const imageData = JSON.stringify({
      id: product.id,
      imageUrl: product.imageUrl || null,
      image_url: product.image_url || null,
      images: imagesArray
    })
    return simpleHash(imageData)
  } catch (error) {
    // Fallback to basic ID-based key if JSON serialization fails
    // Use deterministic fallback to maintain cache consistency
    console.warn('Failed to serialize product for cache key, using fallback:', error)
    const safeId = String(product.id || 'unknown')
    const safeImageUrl = String(product.imageUrl || 'no-image')
    return simpleHash(`fallback-${safeId}-${safeImageUrl}`)
  }
}

/**
 * LRU Cache implementation for better cache performance
 * Uses access-based eviction instead of first-in-first-out
 */
class LRUCache<K, V> {
  private readonly maxSize: number
  private readonly cache = new Map<K, V>()
  
  constructor(maxSize: number = 1000) {
    if (!Number.isFinite(maxSize) || maxSize <= 0 || !Number.isInteger(maxSize)) {
      throw new Error('LRUCache maxSize must be a positive finite integer')
    }
    this.maxSize = maxSize
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  get size(): number {
    return this.cache.size
  }
}

/**
 * Memoized version for performance optimization when called repeatedly with same products
 * Uses LRU cache with robust key generation that accounts for all image properties
 * 
 * @param product - Product object that may contain image data
 * @returns Valid image source URL or fallback image (cached result)
 * 
 * @example
 * ```typescript
 * const imageSrc = getProductImageSrcMemoized(product)
 * // Subsequent calls with same product will use cached result
 * ```
 */
const imageCache = new LRUCache<string, string>(1000)

export function getProductImageSrcMemoized(product: Prosthetic | null | undefined): string {
  if (!product || !product.id) {
    return PROSTHETIC_FALLBACK_IMAGE
  }
  
  // Create robust cache key from all image properties
  const cacheKey = createImageCacheKey(product)
  
  // Check cache first (LRU will handle access tracking)
  const cached = imageCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  
  // Calculate result and cache it
  const result = getProductImageSrc(product)
  imageCache.set(cacheKey, result)
  
  return result
}

/**
 * Clear the image cache for memory management or testing purposes
 * Useful when you want to ensure fresh image resolution or during unit tests
 * 
 * @example
 * ```typescript
 * // Clear cache before tests
 * beforeEach(() => {
 *   clearImageCache()
 * })
 * ```
 */
export function clearImageCache(): void {
  imageCache.clear()
}

/**
 * Get current cache size (useful for monitoring and debugging)
 * 
 * @returns Number of cached image entries
 */
export function getImageCacheSize(): number {
  return imageCache.size
}