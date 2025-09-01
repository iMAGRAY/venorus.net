// Database auth - single source of truth
export { 
  createUserSession, 
  validateUserSession, 
  destroyUserSession, 
  authenticateUser, 
  requireAuth,
  hasPermission,
  cleanupExpiredSessions,
  AUTH_CONFIG
} from './database-auth'

// Type exports
export type { User, UserSession } from './database-auth'