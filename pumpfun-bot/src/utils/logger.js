const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[90m',  // gray
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
  info: (msg, ...args) => console.log(`${colors.info}[${timestamp()}] INFO${colors.reset}  ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${colors.warn}[${timestamp()}] WARN${colors.reset}  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`${colors.error}[${timestamp()}] ERROR${colors.reset} ${msg}`, ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`${colors.debug}[${timestamp()}] DEBUG${colors.reset} ${msg}`, ...args);
    }
  },
};

module.exports = logger;
