// backend/config/database.js - MongoDB Connection Manager
const mongoose = require('mongoose');
const logger = require('./logger');

class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connect() {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      logger.error('MONGODB_URI is not defined in environment variables');
      throw new Error('MongoDB connection string is required');
    }

    const options = {
      // Connection options
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4, // Use IPv4, skip trying IPv6

      // Buffering options
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production', // Disable in production

      // Other options
      retryWrites: true,
      w: 'majority'
    };

    try {
      await mongoose.connect(mongoUri, options);

      this.isConnected = true;
      this.retryCount = 0;

      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        name: mongoose.connection.name
      });

      // Connection event listeners
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        logger.info('MongoDB connection established');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');

        // Attempt to reconnect
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.info(`Attempting to reconnect (${this.retryCount}/${this.maxRetries})...`);
          setTimeout(() => this.connect(), this.retryDelay);
        }
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        this.retryCount = 0;
        logger.info('MongoDB reconnected successfully');
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error.message);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.info(`Retrying connection (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected) {
      logger.info('Database already disconnected');
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Database not connected' };
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        details: {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          readyState: mongoose.connection.readyState,
          models: Object.keys(mongoose.models).length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.toString()
      };
    }
  }

  getConnection() {
    return mongoose.connection;
  }

  isConnectedStatus() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
