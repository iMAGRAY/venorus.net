const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = { 
  info: (...args: any[]) => {
    if (isDevelopment) console.log('[INFO]', ...args)
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
  },
  warn: (...args: any[]) => {
    if (isDevelopment) console.warn('[WARN]', ...args)
  },
  debug: (...args: any[]) => {
    if (isDevelopment) (console.debug || console.log)('[DEBUG]', ...args)
  },
  log: (...args: any[]) => {
    if (isDevelopment) console.log('[LOG]', ...args)
  },
  dbQuery: (query: string, _params: any, duration: number) => {
    if (isDevelopment) {
      console.log(`[DB Query] ${query.substring(0, 100)}... (${duration}ms)`)
    }
  },
  dbError: (query: string, error: Error, _params: any) => {
    console.error(`[DB Error] ${query.substring(0, 100)}...`, error.message)
  }
};

// Export as default for compatibility
export default logger;
