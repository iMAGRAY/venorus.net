/**
 * Comprehensive unit tests for product image utilities
 * Tests security validation, fallback handling, and edge cases
 */

const {
  getProductImageSrc,
  getProductImageSrcMemoized,
  clearImageCache,
  getImageCacheSize
} = require('../../lib/product-image-utils')

const { PROSTHETIC_FALLBACK_IMAGE } = require('../../lib/fallback-image')

describe('Product Image Utils', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure clean state
    clearImageCache()
  })

  describe('getProductImageSrc', () => {
    describe('Basic functionality', () => {
      test('should return fallback for null product', () => {
        expect(getProductImageSrc(null)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should return fallback for undefined product', () => {
        expect(getProductImageSrc(undefined)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should return fallback for invalid product object', () => {
        expect(getProductImageSrc('not an object')).toBe(PROSTHETIC_FALLBACK_IMAGE)
        expect(getProductImageSrc(123)).toBe(PROSTHETIC_FALLBACK_IMAGE)
        expect(getProductImageSrc([])).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })
    })

    describe('Image URL priority and validation', () => {
      test('should prioritize image_url (snake_case) first', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: 'https://example.com/test.jpg',
          imageUrl: 'https://example.com/camel.jpg',
          primary_image_url: 'https://example.com/primary.jpg'
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/test.jpg')
      })

      test('should fall back to imageUrl (camelCase) if image_url invalid', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: '', // Empty string
          imageUrl: 'https://example.com/camel.jpg'
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/camel.jpg')
      })

      test('should use primary_image_url as third option', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          primary_image_url: 'https://example.com/primary.jpg'
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/primary.jpg')
      })

      test('should use primaryImageUrl as fourth option', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          primaryImageUrl: 'https://example.com/primary-camel.jpg'
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/primary-camel.jpg')
      })

      test('should use first image from images array as last option', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          images: ['https://example.com/first.jpg', 'https://example.com/second.jpg']
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/first.jpg')
      })
    })

    describe('Security validation', () => {
      test('should reject URLs with dangerous protocols', () => {
        const dangerousUrls = [
          'javascript:alert("xss")',
          'data:text/html,<script>alert("xss")</script>',
          'vbscript:msgbox("xss")',
          'file:///etc/passwd',
          'ftp://malicious.com/file.jpg'
        ]

        dangerousUrls.forEach(url => {
          const product = {
            id: 1,
            name: 'Test Product',
            image_url: url
          }
          expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
        })
      })

      test('should reject URLs with path traversal attempts', () => {
        const traversalUrls = [
          '../../../etc/passwd.jpg',
          '/uploads/../../../secret.jpg',
          'https://example.com/../../../etc/passwd.jpg',
          'https://example.com/uploads/..%2f..%2f..%2fpasswd.jpg',
          '/path/with/null\0byte.jpg'
        ]

        traversalUrls.forEach(url => {
          const product = {
            id: 1,
            name: 'Test Product',
            image_url: url
          }
          expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
        })
      })

      test('should reject URLs without valid image extensions', () => {
        const invalidUrls = [
          'https://example.com/notimage.txt',
          'https://example.com/script.js',
          'https://example.com/document.pdf',
          'https://example.com/noextension',
          'https://example.com/fake.jpg.php' // Double extension attack
        ]

        invalidUrls.forEach(url => {
          const product = {
            id: 1,
            name: 'Test Product',
            image_url: url
          }
          expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
        })
      })

      test('should reject overly long URLs', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(3000) + '.jpg'
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: longUrl
        }
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should reject URLs with null bytes', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: 'https://example.com/test\0.jpg'
        }
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })
    })

    describe('Valid image URLs', () => {
      test('should accept valid HTTPS image URLs', () => {
        const validUrls = [
          'https://example.com/image.jpg',
          'https://example.com/photo.jpeg',
          'https://example.com/picture.png',
          'https://example.com/graphic.webp',
          'https://example.com/animation.gif',
          'https://example.com/vector.avif',
          'https://example.com/bitmap.bmp'
        ]

        validUrls.forEach(url => {
          const product = {
            id: 1,
            name: 'Test Product',
            image_url: url
          }
          expect(getProductImageSrc(product)).toBe(url)
        })
      })

      test('should accept valid HTTP image URLs', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: 'http://example.com/image.jpg'
        }
        expect(getProductImageSrc(product)).toBe('http://example.com/image.jpg')
      })

      test('should accept relative URLs with valid extensions', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: '/uploads/products/image.jpg'
        }
        expect(getProductImageSrc(product)).toBe('/uploads/products/image.jpg')
      })

      test('should handle URL-encoded extensions', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: 'https://example.com/image%2Ejpg' // URL-encoded .jpg
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/image%2Ejpg')
      })

      test('should trim whitespace from URLs', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          image_url: '  https://example.com/image.jpg  '
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/image.jpg')
      })
    })

    describe('Images array handling', () => {
      test('should handle empty images array', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          images: []
        }
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should handle non-array images property', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          images: 'not an array'
        }
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should skip invalid images in array and return fallback', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          images: ['invalid-url', '', null, undefined]
        }
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })

      test('should use first valid image from array', () => {
        const product = {
          id: 1,
          name: 'Test Product',
          images: ['invalid-url', 'https://example.com/valid.jpg', 'https://example.com/second.jpg']
        }
        expect(getProductImageSrc(product)).toBe('https://example.com/valid.jpg')
      })
    })
  })

  describe('getProductImageSrcMemoized', () => {
    test('should return same result as non-memoized version', () => {
      const product = {
        id: 1,
        name: 'Test Product',
        image_url: 'https://example.com/test.jpg'
      }
      
      const directResult = getProductImageSrc(product)
      const memoizedResult = getProductImageSrcMemoized(product)
      
      expect(memoizedResult).toBe(directResult)
    })

    test('should cache results for same product', () => {
      const product = {
        id: 1,
        name: 'Test Product',
        image_url: 'https://example.com/test.jpg'
      }
      
      // First call should cache the result
      getProductImageSrcMemoized(product)
      expect(getImageCacheSize()).toBe(1)
      
      // Second call should use cached result
      const result = getProductImageSrcMemoized(product)
      expect(result).toBe('https://example.com/test.jpg')
      expect(getImageCacheSize()).toBe(1) // Size should remain the same
    })

    test('should return fallback for product without ID', () => {
      const product = {
        name: 'Test Product',
        image_url: 'https://example.com/test.jpg'
        // No ID
      }
      
      expect(getProductImageSrcMemoized(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
    })
  })

  describe('Cache management', () => {
    test('should clear cache successfully', () => {
      const product = {
        id: 1,
        name: 'Test Product',
        image_url: 'https://example.com/test.jpg'
      }
      
      getProductImageSrcMemoized(product)
      expect(getImageCacheSize()).toBe(1)
      
      clearImageCache()
      expect(getImageCacheSize()).toBe(0)
    })

    test('should report correct cache size', () => {
      expect(getImageCacheSize()).toBe(0)
      
      const products = [
        { id: 1, image_url: 'https://example.com/1.jpg' },
        { id: 2, image_url: 'https://example.com/2.jpg' },
        { id: 3, image_url: 'https://example.com/3.jpg' }
      ]
      
      products.forEach(product => getProductImageSrcMemoized(product))
      expect(getImageCacheSize()).toBe(3)
    })
  })

  describe('Edge cases and error handling', () => {
    test('should handle malformed product objects gracefully', () => {
      const malformedProducts = [
        {},
        { id: null },
        { name: undefined },
        Object.create(null)
      ]
      
      malformedProducts.forEach(product => {
        expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
      })
    })

    test('should handle extremely nested objects', () => {
      const product = {
        id: 1,
        name: 'Test',
        nested: {
          very: {
            deep: {
              object: {
                with: {
                  image_url: 'https://example.com/nested.jpg'
                }
              }
            }
          }
        }
      }
      
      expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
    })

    test('should handle circular references safely', () => {
      const product = {
        id: 1,
        name: 'Test Product'
      }
      // Create circular reference
      product.self = product
      
      expect(getProductImageSrc(product)).toBe(PROSTHETIC_FALLBACK_IMAGE)
    })
  })
})