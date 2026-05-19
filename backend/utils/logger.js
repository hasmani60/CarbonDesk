// utils/logger.js - Simple logger utility for MongoDB backend
const logger = {
  info: (...args) => {
    console.log('ℹ️ [INFO]', new Date().toISOString(), ...args);
  },
  
  error: (...args) => {
    console.error('❌ [ERROR]', new Date().toISOString(), ...args);
  },
  
  warn: (...args) => {
    console.warn('⚠️  [WARN]', new Date().toISOString(), ...args);
  },
  
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [DEBUG]', new Date().toISOString(), ...args);
    }
  },
  
  audit: (...args) => {
    console.log('📝 [AUDIT]', new Date().toISOString(), ...args);
  }
};

module.exports = logger;