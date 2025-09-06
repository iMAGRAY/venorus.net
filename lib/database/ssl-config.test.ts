// @ts-ignore - Skip Jest types for now
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs'
import { getSSLConfig, clearSSLCache, getSSLStatus } from './ssl-config'

// Mock fs module
// @ts-ignore
const mockFs = fs as any

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

// Sample valid PEM certificate for testing
const VALID_PEM_CERT = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
-----END CERTIFICATE-----`

const INVALID_PEM_CERT = `This is not a valid certificate`

describe('SSL Configuration Module', () => {
  // Store original env vars
  const originalEnv = process.env

  beforeEach(() => {
    // Clear cache before each test
    clearSSLCache()
    
    // Reset environment
    process.env = { ...originalEnv }
    
    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Development Environment', () => {
    test('should disable SSL in development mode', () => {
      process.env.NODE_ENV = 'development'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false)
    })

    test('should disable SSL for localhost database', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false)
    })

    test('should disable SSL for 127.0.0.1 database', () => {
      process.env.NODE_ENV = 'production'
      process.env.POSTGRESQL_HOST = '127.0.0.1'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false)
    })

    test('should disable SSL when DATABASE_SSL is false', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_SSL = 'false'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false)
    })
  })

  describe('Test Environment', () => {
    test('should disable SSL in test mode', () => {
      process.env.NODE_ENV = 'test'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false)
    })
  })

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_URL = 'postgresql://user:pass@remote-db.com:5432/db'
    })

    test('should use system CA certificates when no custom cert provided', () => {
      mockFs.existsSync.mockReturnValue(false)
      
      const config = getSSLConfig()
      
      expect(config).toEqual({
        rejectUnauthorized: true,
        checkServerIdentity: undefined
      })
    })

    test('should load custom CA certificate when file exists', () => {
      process.env.SSL_CA_CERT_PATH = '/path/to/cert.pem'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      
      const config = getSSLConfig()
      
      expect(config).toBeTruthy()
      expect(config).toHaveProperty('rejectUnauthorized', true)
      expect(config).toHaveProperty('ca', VALID_PEM_CERT)
      expect(config).toHaveProperty('checkServerIdentity')
    })

    test('should throw error when invalid PEM certificate is loaded', () => {
      process.env.SSL_CA_CERT_PATH = '/path/to/invalid.pem'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(INVALID_PEM_CERT)
      
      expect(() => getSSLConfig()).toThrow('SSL configuration failed in production')
    })

    test('should use environment variable for allowed hosts', () => {
      process.env.SSL_ALLOWED_HOSTS = 'db1.example.com,db2.example.com,*.cloud.com'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      
      const config = getSSLConfig() as any
      
      // Test hostname verification
      const checkResult1 = config.checkServerIdentity('db1.example.com', {})
      const checkResult2 = config.checkServerIdentity('api.cloud.com', {})
      const checkResult3 = config.checkServerIdentity('invalid.com', {})
      
      expect(checkResult1).toBeUndefined() // Valid host
      expect(checkResult2).toBeUndefined() // Valid wildcard
      expect(checkResult3).toBeInstanceOf(Error) // Invalid host
    })

    test('should use default TWC Cloud hosts when SSL_ALLOWED_HOSTS not set', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      delete process.env.SSL_ALLOWED_HOSTS
      
      const config = getSSLConfig() as any
      
      const checkResult1 = config.checkServerIdentity('1bb84d1fbea33d62faf51337.twc1.net', {})
      const checkResult2 = config.checkServerIdentity('api.twc1.net', {})
      const checkResult3 = config.checkServerIdentity('other.com', {})
      
      expect(checkResult1).toBeUndefined() // Default TWC host
      expect(checkResult2).toBeUndefined() // TWC subdomain
      expect(checkResult3).toBeInstanceOf(Error) // Invalid host
    })

    test('should handle wildcard domains correctly', () => {
      process.env.SSL_ALLOWED_HOSTS = '*.example.com'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      
      const config = getSSLConfig() as any
      
      const checkResult1 = config.checkServerIdentity('api.example.com', {})
      const checkResult2 = config.checkServerIdentity('example.com', {})
      const checkResult3 = config.checkServerIdentity('sub.api.example.com', {})
      
      expect(checkResult1).toBeUndefined() // Valid wildcard match
      expect(checkResult2).toBeUndefined() // Exact domain match
      expect(checkResult3).toBeUndefined() // Nested subdomain
    })

    test('should throw error when certificate file cannot be read', () => {
      process.env.SSL_CA_CERT_PATH = '/path/to/cert.pem'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })
      
      expect(() => getSSLConfig()).toThrow('SSL configuration failed in production')
    })
  })

  describe('Caching', () => {
    test('should cache SSL configuration', () => {
      process.env.NODE_ENV = 'development'
      
      const config1 = getSSLConfig()
      const config2 = getSSLConfig()
      
      expect(config1).toBe(config2)
      expect(mockFs.existsSync).not.toHaveBeenCalled() // Should use cache
    })

    test('should clear cache when clearSSLCache is called', () => {
      process.env.NODE_ENV = 'development'
      
      const config1 = getSSLConfig()
      clearSSLCache()
      
      process.env.NODE_ENV = 'production'
      const config2 = getSSLConfig()
      
      expect(config1).toBe(false) // Dev mode
      expect(config2).not.toBe(false) // Production mode
    })
  })

  describe('Status Reporting', () => {
    test('should report SSL status correctly in development', () => {
      process.env.NODE_ENV = 'development'
      
      const status = getSSLStatus()
      
      expect(status).toEqual({
        enabled: false,
        environment: 'development',
        cached: true,
        allowedHosts: undefined,
        certificatePath: undefined
      })
    })

    test('should report SSL status correctly in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.SSL_CA_CERT_PATH = '/path/to/cert.pem'
      process.env.SSL_ALLOWED_HOSTS = 'db.example.com'
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      
      const status = getSSLStatus()
      
      expect(status).toEqual({
        enabled: true,
        environment: 'production',
        cached: true,
        allowedHosts: ['db.example.com'],
        certificatePath: '/path/to/cert.pem'
      })
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty SSL_ALLOWED_HOSTS gracefully', () => {
      process.env.NODE_ENV = 'production'
      process.env.SSL_ALLOWED_HOSTS = ''
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(VALID_PEM_CERT)
      
      const config = getSSLConfig()
      
      expect(config).toBeTruthy()
      // Should fall back to default hosts
    })

    test('should handle Docker internal host correctly', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_URL = 'postgresql://user:pass@host.docker.internal:5432/db'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false) // Should detect as local
    })

    test('should handle IPv6 localhost correctly', () => {
      process.env.NODE_ENV = 'production'
      process.env.POSTGRESQL_HOST = '::1'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false) // Should detect as local
    })

    test('should handle .local domains correctly', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_URL = 'postgresql://user:pass@mydb.local:5432/db'
      
      const config = getSSLConfig()
      
      expect(config).toBe(false) // Should detect as local
    })
  })
})