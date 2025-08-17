export const logger = { 
  info: console.log, 
  error: console.error, 
  warn: console.warn, 
  debug: console.debug || console.log,
  log: console.log,
  dbQuery: (query: string, params: any, duration: number) => {
    console.log(`[DB Query] ${query.substring(0, 100)}... (${duration}ms)`);
  },
  dbError: (query: string, error: Error, params: any) => {
    console.error(`[DB Error] ${query.substring(0, 100)}...`, error.message);
  }
};

// Export as default for compatibility
export default logger;
