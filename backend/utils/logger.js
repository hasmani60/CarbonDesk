const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LEVELS[LOG_LEVEL];

const formatMessage = (level, message, data) => {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (data !== undefined && data !== null) {
    if (data instanceof Error) {
      logMessage += ` - ${data.message}`;
      if (process.env.NODE_ENV === 'development' && data.stack) {
        logMessage += `\n${data.stack}`;
      }
    } else if (typeof data === 'object') {
      logMessage += ` ${JSON.stringify(data)}`;
    } else {
      logMessage += ` ${data}`;
    }
  }

  return logMessage;
};

const logger = {
  debug: (message, data) => {
    if (CURRENT_LEVEL <= LEVELS.debug) {
      console.log(formatMessage('debug', message, data));
    }
  },

  info: (message, data) => {
    if (CURRENT_LEVEL <= LEVELS.info) {
      console.log(formatMessage('info', message, data));
    }
  },

  warn: (message, data) => {
    if (CURRENT_LEVEL <= LEVELS.warn) {
      console.warn(formatMessage('warn', message, data));
    }
  },

  error: (message, error) => {
    if (CURRENT_LEVEL <= LEVELS.error) {
      console.error(formatMessage('error', message, error));
    }
  },

  audit: (message, data) => {
    if (CURRENT_LEVEL <= LEVELS.info) {
      console.log(formatMessage('audit', message, data));
    }
  }
};

module.exports = logger;
