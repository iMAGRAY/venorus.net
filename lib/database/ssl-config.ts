import { logger } from "../logger"
import * as fs from "fs"
import * as path from "path"

/**
 * SSL Configuration module for PostgreSQL connections
 * Handles environment-specific SSL settings with security best practices
 * 
 * Production: SSL required with strict certificate validation
 * Development: SSL disabled for local databases, auto-detected for cloud databases
 * Test: SSL disabled for CI/CD compatibility
 */

// Certificate details interface
interface CertificateDetails {
  subject?: { CN?: string; [key: string]: any }
  issuer?: { CN?: string; [key: string]: any }
  valid_from?: string
  valid_to?: string
  subjectaltname?: string
  [key: string]: any
}

export interface SSLConfig {
  rejectUnauthorized: boolean
  ca?: string
  checkServerIdentity?: (host: string, cert: CertificateDetails) => undefined | Error
}

// Cache for SSL configuration to avoid repeated file operations
let cachedSSLConfig: SSLConfig | false | null = null

// Auto-detect development mode based on common development indicators
function isDevelopmentEnvironment(): boolean {
  const env = process.env.NODE_ENV || 'development'
  
  // Check explicit development mode
  if (env === 'development' || env === 'dev') return true
  
  // In production, don't auto-detect as development
  if (env === 'production') return false
  
  // Check for common development ports
  const port = process.env.PORT || '3000'
  const devPorts = ['3000', '3001', '3010', '8080', '8000', '5000']
  if (devPorts.includes(port)) {
    logger.debug('Development port detected, treating as development environment')
    return true
  }
  
  // Check for localhost URLs
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    logger.debug('Localhost API URL detected, treating as development environment')
    return true
  }
  
  return false
}

/**
 * Validates if the provided string is a valid PEM certificate
 */
function isValidPEMCertificate(cert: string): boolean {
  const pemRegex = /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/m
  return pemRegex.test(cert)
}

/**
 * Gets allowed SSL hostnames from environment variable
 * @returns Array of allowed hostnames or default TWC Cloud hosts
 */
function getAllowedHosts(): string[] {
  const allowedHostsEnv = process.env.SSL_ALLOWED_HOSTS
  
  if (allowedHostsEnv) {
    const hosts = allowedHostsEnv.split(',')
      .map(h => h.trim())
      .filter(Boolean)
    
    if (hosts.length > 0) {
      logger.info('SSL allowed hosts configured', { hosts })
      return hosts
    }
  }
  
  // Default hosts for TWC Cloud (backward compatibility)
  const defaultHosts = ['1bb84d1fbea33d62faf51337.twc1.net', 'twc1.net']
  logger.info('Using default SSL allowed hosts for TWC Cloud', { hosts: defaultHosts })
  return defaultHosts
}

/**
 * Custom error class for SSL configuration failures
 */
export class SSLConfigurationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'SSLConfigurationError'
  }
}

/**
 * Validates and sanitizes certificate path to prevent path traversal
 * @param certPath - Path to certificate file
 * @returns Sanitized absolute path or null if invalid
 */
function sanitizeCertPath(certPath: string | undefined | null): string | null {
  if (!certPath || typeof certPath !== 'string') return null
  
  try {
    // Normalize and resolve to absolute path
    const normalized = path.normalize(certPath)
    const resolved = path.resolve(normalized)
    
    // Prevent null bytes and other injection attempts
    if (resolved.includes('\0') || resolved.includes('%00')) {
      logger.warn('Invalid characters in certificate path')
      return null
    }
    
    // Define allowed base directories
    const allowedBasePaths = [
      process.cwd(),
      path.join(process.cwd(), '.cloud-certs'),
      path.join(process.cwd(), '.ssl-certs'),
      path.join(process.cwd(), 'certs'),
      '/etc/ssl',
      '/usr/local/share/ca-certificates'
    ]
    
    // Check if resolved path is within allowed directories
    const isAllowed = allowedBasePaths.some(basePath => {
      if (!basePath) return false
      
      try {
        // Normalize base path for comparison
        const normalizedBase = path.resolve(path.normalize(basePath))
        const relative = path.relative(normalizedBase, resolved)
        
        // Check for path traversal patterns (cross-platform)
        // Empty relative means paths are the same
        if (relative === '') return true
        
        // Check if path goes outside (starts with .. or contains separator + ..)
        const isOutside = relative.startsWith('..') || 
                         relative.includes(`${path.sep}..`) ||
                         relative.includes(`..${path.sep}`) ||
                         // Windows-specific checks
                         (process.platform === 'win32' && (
                           relative.includes('\\..') || 
                           relative.includes('..\\') ||
                           relative.startsWith('..\\')))
        
        return !isOutside
      } catch (err) {
        logger.debug('Error checking path', { error: err instanceof Error ? err.message : 'Unknown' })
        return false
      }
    })
    
    if (!isAllowed) {
      logger.warn('Certificate path outside allowed directories', {
        path: resolved.replace(/\/[^\/]*$/, '/***.pem')
      })
      return null
    }
    
    return resolved
  } catch (error) {
    logger.error('Error sanitizing certificate path', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Attempts to auto-detect and load SSL certificate
 * Checks multiple common locations for certificate files
 */
function autoDetectCertificate(): string | null {
  const possiblePaths = [
    // Environment variable specified path
    process.env.SSL_CA_CERT_PATH,
    process.env.PGSSLROOTCERT,
    // Common certificate locations
    path.join(process.cwd(), '.cloud-certs', 'root.crt'),
    path.join(process.cwd(), '.ssl-certs', 'twc-ca.pem'),
    path.join(process.cwd(), '.ssl-certs', 'root.crt'),
    path.join(process.cwd(), 'certs', 'ca.pem'),
    path.join(process.cwd(), 'certs', 'root.crt'),
    // System certificate locations (Linux/Mac)
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/ssl/cert.pem',
    '/usr/local/share/ca-certificates/ca.crt'
  ].filter(Boolean) as string[]
  
  for (const rawPath of possiblePaths) {
    // Sanitize path to prevent traversal attacks
    const certPath = sanitizeCertPath(rawPath)
    if (!certPath) continue
    
    try {
      if (fs.existsSync(certPath)) {
        const cert = fs.readFileSync(certPath, 'utf8')
        if (isValidPEMCertificate(cert)) {
          logger.info('SSL certificate auto-detected', { 
            path: certPath.replace(/\/[^\/]*$/, '/***.pem') 
          })
          return certPath
        }
      }
    } catch (error) {
      // Continue checking other paths
      logger.debug('Failed to read certificate', {
        path: certPath.replace(/\/[^\/]*$/, '/***.pem'),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      continue
    }
  }
  
  return null
}

/**
 * Creates SSL configuration for production environment
 * @returns SSL configuration object with strict security settings
 * @throws {SSLConfigurationError} If SSL configuration fails in production
 */
function createProductionSSLConfig(): SSLConfig {
  // Try auto-detection first
  const certPath = autoDetectCertificate()
  
  try {
    // Try to load custom CA certificate
    if (certPath) {
      const caCert = fs.readFileSync(certPath, 'utf8')
      
      // Validate certificate format
      if (!isValidPEMCertificate(caCert)) {
        throw new SSLConfigurationError(
          `Invalid PEM certificate format at ${certPath}`,
          'INVALID_CERT_FORMAT',
          { certPath: certPath.replace(/\/[^\/]*$/, '/***.pem') } // Don't log cert content
        )
      }
      
      const allowedHosts = getAllowedHosts()
      
      const sslConfig: SSLConfig = {
        rejectUnauthorized: true, // Always strict in production
        ca: caCert,
        checkServerIdentity: (host: string, cert: CertificateDetails) => {
          // Validate input
          if (!host || typeof host !== 'string') {
            return new Error('Invalid hostname provided for SSL verification')
          }
          
          // Warn if local host in production but still verify
          if (isLocalHost(host)) {
            logger.warn(`Local host ${host} detected in production SSL verification - unusual but continuing with verification`)
            // Continue with verification - do not skip!
          }
          
          // Check if the host is in the allowed list
          const isAllowed = matchHostname(host, allowedHosts)
          
          if (isAllowed) {
            return undefined // Host is valid
          }
          
          // Log the failure with sanitized information
          const sanitizedCert = {
            subject: cert?.subject?.CN || 'unknown',
            issuer: cert?.issuer?.CN || 'unknown',
            validFrom: cert?.valid_from,
            validTo: cert?.valid_to
          }
          
          logger.error('SSL hostname verification failed', { 
            host, 
            allowedHostsCount: allowedHosts.length,
            certificate: sanitizedCert
          })
          
          return new Error(
            `SSL hostname verification failed: ${host} is not in the allowed hosts list`
          )
        }
      }
      
      logger.info('SSL configured with custom CA certificate', { 
        certPath: certPath.replace(/\/[^\/]*$/, '/***.pem'), // Sanitize path
        allowedHostsCount: allowedHosts.length 
      })
      
      return sslConfig
    }
    
    // Certificate file not found - use system defaults
    logger.warn('No custom SSL certificate found, using system CA certificates')
    
  } catch (error) {
    // If it's already our custom error, re-throw
    if (error instanceof SSLConfigurationError) {
      throw error
    }
    
    // Wrap other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const safeCertPath = certPath ? certPath.replace(/\/[^\/]*$/, '/***.pem') : 'unknown'
    logger.error('Failed to load SSL certificate', { 
      error: errorMessage,
      certPath: safeCertPath
    })
    
    // In production, still allow system certificates as fallback
    logger.warn(`Failed to load custom certificate: ${errorMessage}, falling back to system certificates`)
  }
  
  // Fallback to system certificates with strict validation
  logger.info('Using system CA certificates with strict validation')
  return {
    rejectUnauthorized: true,
    checkServerIdentity: undefined // Use Node.js default
  }
}

/**
 * Matches hostname against a list of allowed patterns
 * Supports wildcard matching (*.domain.com)
 * @param host - Hostname to validate
 * @param allowedPatterns - List of allowed hostname patterns
 * @returns True if host matches any pattern
 */
function matchHostname(host: string, allowedPatterns: string[]): boolean {
  if (!host || typeof host !== 'string' || host.trim() === '') return false
  if (!allowedPatterns || !Array.isArray(allowedPatterns) || allowedPatterns.length === 0) return false
  
  // Normalize host for comparison
  const normalizedHost = host.toLowerCase().trim()
  
  // Basic length check to prevent ReDoS
  if (normalizedHost.length > 253) {
    logger.debug('Hostname too long', { length: normalizedHost.length })
    return false
  }
  
  // Simple validation - allow alphanumeric, dots, hyphens
  // Skip complex regex to prevent ReDoS, rely on DNS resolution for final validation
  const basicHostnameRegex = /^[a-z0-9.-]+$/i
  if (!basicHostnameRegex.test(normalizedHost) && !isLocalHost(normalizedHost)) {
    logger.debug('Invalid hostname characters', { host: normalizedHost })
    return false
  }
  
  return allowedPatterns.some(pattern => {
    // Skip empty or invalid patterns
    if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') return false
    
    const normalizedPattern = pattern.toLowerCase().trim()
    
    // Support wildcard matching (*.domain.com)
    if (normalizedPattern.startsWith('*.')) {
      const domain = normalizedPattern.substring(2)
      return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
    }
    // Exact match or subdomain match
    return normalizedHost === normalizedPattern || normalizedHost.endsWith(`.${normalizedPattern}`)
  })
}

/**
 * Checks if a hostname is a local address
 */
function isLocalHost(host: string): boolean {
  if (!host) return false
  
  const normalized = host.toLowerCase().trim()
  
  // Exact matches for local addresses
  const exactLocalHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',  // IPv6 localhost
    '::',   // IPv6 any address
    'host.docker.internal'
  ]
  
  if (exactLocalHosts.includes(normalized)) {
    return true
  }
  
  // Check for private IP ranges (RFC 1918 for IPv4, RFC 4193 for IPv6)
  const privateIPv4Regex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/
  const privateIPv6Regex = /^(fc|fd)[0-9a-f]{2}:/i
  
  if (privateIPv4Regex.test(normalized) || privateIPv6Regex.test(normalized)) {
    return true
  }
  
  // Check for local domain suffixes
  const localSuffixes = ['.local', '.localhost', '.test', '.example', '.invalid']
  return localSuffixes.some(suffix => normalized.endsWith(suffix))
}

/**
 * Extracts hostname from database URL
 */
function extractHostFromUrl(url: string): string | null {
  try {
    // Handle postgresql:// URLs
    if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
      const urlObj = new URL(url.replace('postgresql://', 'postgres://'))
      return urlObj.hostname
    }
    return null
  } catch {
    return null
  }
}

/**
 * Checks if host requires SSL regardless of environment
 */
function hostRequiresSSL(host: string): boolean {
  if (!host) return false
  
  const normalized = host.toLowerCase().trim()
  
  // TWC Cloud always requires SSL
  if (normalized.includes('twc1.net') || normalized.includes('twc2.ru')) {
    return true
  }
  
  // Other cloud providers that require SSL
  const sslRequiredPatterns = [
    'amazonaws.com',
    'azure.com',
    'googlecloud.com',
    'digitalocean.com',
    'heroku.com'
  ]
  
  return sslRequiredPatterns.some(pattern => normalized.includes(pattern))
}

/**
 * Determines if SSL should be disabled based on environment
 */
function shouldDisableSSL(): boolean {
  // Check if explicitly disabled via environment variables
  if (process.env.DATABASE_SSL === 'false' || 
      process.env.DATABASE_URL?.includes('sslmode=disable')) {
    logger.warn('SSL explicitly disabled via configuration')
    return true
  }
  
  // Extract host from various sources
  const dbUrl = process.env.DATABASE_URL || ''
  const dbHost = process.env.POSTGRESQL_HOST || process.env.DB_HOST || ''
  
  // Check URL first
  const urlHost = extractHostFromUrl(dbUrl)
  
  // If host requires SSL (like TWC Cloud), don't disable
  if (urlHost && hostRequiresSSL(urlHost)) {
    logger.info(`Cloud database detected (${urlHost}), SSL is required`)
    return false
  }
  
  if (dbHost && hostRequiresSSL(dbHost)) {
    logger.info(`Cloud database detected (${dbHost}), SSL is required`)
    return false
  }
  
  // Check for local hosts
  if (urlHost && isLocalHost(urlHost)) {
    logger.info(`Local database detected (${urlHost}), SSL will be disabled`)
    return true
  }
  
  // Check direct host configuration
  if (dbHost && isLocalHost(dbHost)) {
    logger.info(`Local database detected (${dbHost}), SSL will be disabled`)
    return true
  }
  
  return false
}

/**
 * Gets SSL configuration based on current environment
 * 
 * @returns SSL configuration object or false if SSL is disabled
 * 
 * Development: SSL disabled for local database connections
 * Test: SSL disabled for testing environments  
 * Production: SSL required with strict certificate validation
 */
export function getSSLConfig(): SSLConfig | false {
  // Return cached configuration if available
  if (cachedSSLConfig !== null) {
    return cachedSSLConfig
  }
  
  // Use smart environment detection
  const environment = isDevelopmentEnvironment() ? 'development' : (process.env.NODE_ENV || 'production')
  
  // Extract host to check if it requires SSL
  const dbUrl = process.env.DATABASE_URL || ''
  const dbHost = process.env.POSTGRESQL_HOST || process.env.DB_HOST || ''
  const urlHost = extractHostFromUrl(dbUrl)
  const currentHost = urlHost || dbHost
  
  // Check if host requires SSL even in dev mode (like TWC Cloud)
  if (currentHost && hostRequiresSSL(currentHost)) {
    logger.info(`Cloud database ${currentHost} detected, SSL handling based on environment`)
    
    // For development with cloud databases
    if (environment === 'development' || environment === 'test') {
      // In dev mode, try to use certificate if available, but don't require strict validation
      const certPath = autoDetectCertificate()
      
      if (certPath) {
        try {
          const caCert = fs.readFileSync(certPath, 'utf8')
          logger.info('Using certificate in development mode with relaxed validation')
          const devCloudConfig: SSLConfig = {
            rejectUnauthorized: false, // Allow self-signed in dev
            ca: caCert, // Still provide CA for better security
            checkServerIdentity: () => undefined // Skip hostname check in dev
          }
          cachedSSLConfig = devCloudConfig
          return devCloudConfig
        } catch (error) {
          logger.warn('Failed to load certificate in dev mode, using permissive SSL')
        }
      }
      
      // Fallback for dev without certificate
      logger.warn('Development mode: SSL validation relaxed for cloud database')
      const devCloudConfig: SSLConfig = {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined
      }
      cachedSSLConfig = devCloudConfig
      return devCloudConfig
    }
  }
  
  // Development and test environments - disable SSL for local databases
  if (environment === 'development' || environment === 'test') {
    // Double-check it's really a local database
    if (!currentHost || isLocalHost(currentHost)) {
      logger.info(`SSL disabled in ${environment} mode for local database`)
      cachedSSLConfig = false
      return false
    }
  }
  
  // Check if SSL should be disabled even in production (not recommended)
  if (shouldDisableSSL()) {
    if (environment === 'production') {
      logger.error(
        'WARNING: SSL disabled in production environment! ' +
        'This is a security risk and should only be used for debugging.'
      )
    }
    cachedSSLConfig = false
    return false
  }
  
  // Production environment - require SSL with strict settings
  if (environment === 'production') {
    try {
      const config = createProductionSSLConfig()
      cachedSSLConfig = config
      logger.info('SSL enabled with strict validation for production')
      return config
    } catch (error) {
      logger.error('Failed to configure SSL for production', { error: error.message })
      throw error // Fail fast in production
    }
  }
  
  // Unknown environment - default to strict SSL for safety
  logger.warn(`Unknown environment '${environment}', defaulting to strict SSL`)
  const config: SSLConfig = {
    rejectUnauthorized: true,
    checkServerIdentity: undefined
  }
  cachedSSLConfig = config
  return config
}

/**
 * Clears cached SSL configuration
 * Useful for testing or when configuration changes
 */
export function clearSSLCache(): void {
  cachedSSLConfig = null
  logger.debug('SSL configuration cache cleared')
}

/**
 * Gets current SSL configuration status for debugging
 */
export function getSSLStatus(): {
  enabled: boolean
  environment: string
  cached: boolean
  allowedHosts?: string[]
  certificatePath?: string
} {
  const config = cachedSSLConfig !== null ? cachedSSLConfig : getSSLConfig()
  const environment = process.env.NODE_ENV || 'development'
  
  return {
    enabled: config !== false,
    environment,
    cached: cachedSSLConfig !== null,
    allowedHosts: config !== false ? getAllowedHosts() : undefined,
    certificatePath: config !== false ? process.env.SSL_CA_CERT_PATH : undefined
  }
}