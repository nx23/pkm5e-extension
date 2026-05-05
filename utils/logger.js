
/**
 * Log messages with a consistent prefix
 * @param {...any} args - The messages or objects to log
 */
function log(...args) {
  console.log('[PKM5e Roll20 Extension]', ...args);
}

/**
 * Log errors with a consistent prefix
 * @param {...any} args - The error messages or objects to log
 */
function logError(...args) {
  console.error('[PKM5e Roll20 Extension]', ...args);
}