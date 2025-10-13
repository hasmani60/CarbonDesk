// frontend/src/utils/requestQueue.js
// Request Queue utility to manage concurrent API requests and prevent rate limiting

/**
 * RequestQueue - Manages concurrent API requests with configurable limits
 * 
 * This utility helps prevent rate limiting by:
 * 1. Limiting the number of concurrent requests
 * 2. Queueing excess requests until capacity is available
 * 3. Processing requests in FIFO order
 * 
 * Usage:
 * ```javascript
 * import { requestQueue } from './utils/requestQueue';
 * 
 * // Wrap your API call with the queue
 * const data = await requestQueue.add(() => apiClient.get('/emissions'));
 * ```
 */

class RequestQueue {
    /**
     * Create a new request queue
     * @param {number} maxConcurrent - Maximum number of concurrent requests (default: 5)
     * @param {number} minDelay - Minimum delay between requests in ms (default: 100)
     */
    constructor(maxConcurrent = 5, minDelay = 100) {
      this.queue = [];
      this.running = 0;
      this.maxConcurrent = maxConcurrent;
      this.minDelay = minDelay;
      this.lastRequestTime = 0;
      this.stats = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0
      };
    }
  
    /**
     * Add a request to the queue
     * @param {Function} requestFn - Async function that performs the API request
     * @param {Object} options - Optional configuration
     * @param {number} options.priority - Priority level (higher = more important)
     * @param {number} options.timeout - Request timeout in ms
     * @returns {Promise} Result of the request function
     */
    async add(requestFn, options = {}) {
      const { priority = 0, timeout = 30000 } = options;
  
      this.stats.total++;
      this.stats.queued++;
  
      // Wait if we're at capacity
      if (this.running >= this.maxConcurrent) {
        await new Promise((resolve) => {
          this.queue.push({ resolve, priority });
          // Sort queue by priority (higher priority first)
          this.queue.sort((a, b) => b.priority - a.priority);
        });
      }
  
      // Enforce minimum delay between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelay) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minDelay - timeSinceLastRequest)
        );
      }
  
      this.running++;
      this.stats.queued--;
      this.lastRequestTime = Date.now();
  
      try {
        // Add timeout wrapper if specified
        let result;
        if (timeout) {
          result = await Promise.race([
            requestFn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        } else {
          result = await requestFn();
        }
  
        this.stats.completed++;
        return result;
      } catch (error) {
        this.stats.failed++;
        throw error;
      } finally {
        this.running--;
        
        // Process next item in queue
        const next = this.queue.shift();
        if (next) {
          next.resolve();
        }
      }
    }
  
    /**
     * Get current queue statistics
     * @returns {Object} Queue statistics
     */
    getStats() {
      return {
        ...this.stats,
        running: this.running,
        queued: this.stats.queued,
        successRate: this.stats.total > 0 
          ? ((this.stats.completed / this.stats.total) * 100).toFixed(2) + '%'
          : '0%'
      };
    }
  
    /**
     * Reset queue statistics
     */
    resetStats() {
      this.stats = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0
      };
    }
  
    /**
     * Clear all pending requests in the queue
     */
    clear() {
      this.queue.forEach(item => {
        item.resolve(new Error('Queue cleared'));
      });
      this.queue = [];
      this.stats.queued = 0;
    }
  
    /**
     * Update queue configuration
     * @param {Object} config - Configuration options
     * @param {number} config.maxConcurrent - New max concurrent requests
     * @param {number} config.minDelay - New minimum delay between requests
     */
    configure(config) {
      if (config.maxConcurrent !== undefined) {
        this.maxConcurrent = config.maxConcurrent;
      }
      if (config.minDelay !== undefined) {
        this.minDelay = config.minDelay;
      }
    }
  }
  
  // Create singleton instances for different request types
  export const requestQueue = new RequestQueue(5, 100); // General requests: 5 concurrent, 100ms delay
  export const heavyRequestQueue = new RequestQueue(2, 500); // Heavy requests: 2 concurrent, 500ms delay
  export const bulkRequestQueue = new RequestQueue(10, 50); // Bulk operations: 10 concurrent, 50ms delay
  
  /**
   * Batch multiple requests together with a delay between each
   * @param {Array<Function>} requests - Array of request functions
   * @param {number} delayMs - Delay between requests in milliseconds
   * @returns {Promise<Array>} Array of results
   */
  export async function batchRequests(requests, delayMs = 200) {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await request();
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
      
      // Wait before next request (except for the last one)
      if (requests.indexOf(request) < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }
  
  /**
   * Retry a request with exponential backoff
   * @param {Function} requestFn - Request function to retry
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum number of retries (default: 3)
   * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
   * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
   * @returns {Promise} Result of the request
   */
  export async function retryWithBackoff(requestFn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000
    } = options;
  
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw error;
        }
        
        // Don't retry if we've exhausted attempts
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );
        
        console.log(`Request failed, retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
  
  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limitMs - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  export function throttle(func, limitMs) {
    let inThrottle;
    let lastResult;
    
    return function(...args) {
      if (!inThrottle) {
        lastResult = func.apply(this, args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
        }, limitMs);
      }
      
      return lastResult;
    };
  }
  
  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} waitMs - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  export function debounce(func, waitMs) {
    let timeout;
    
    return function(...args) {
      clearTimeout(timeout);
      
      return new Promise((resolve) => {
        timeout = setTimeout(() => {
          resolve(func.apply(this, args));
        }, waitMs);
      });
    };
  }
  
  export default {
    requestQueue,
    heavyRequestQueue,
    bulkRequestQueue,
    batchRequests,
    retryWithBackoff,
    throttle,
    debounce
  };