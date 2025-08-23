/**
 * Application initialization module
 * Performs startup tasks to optimize performance
 */

import { warmConnection } from './database/db-connection'
import { logger } from './logger'

let initialized = false

export async function initializeApp(): Promise<void> {
  if (initialized) return
  
  try {
    const startTime = Date.now()
    
    // Warm database connection to reduce cold start latency
    await warmConnection()
    
    initialized = true
    const duration = Date.now() - startTime
    logger.info(`Application initialized successfully in ${duration}ms`)
  } catch (error) {
    logger.error('Application initialization failed', { error })
    // Continue running even if initialization fails
  }
}

// Auto-initialize on module load
if (typeof window === 'undefined') {
  // Server-side only
  initializeApp().catch(err => {
    logger.error('Background initialization failed', { error: err })
  })
}