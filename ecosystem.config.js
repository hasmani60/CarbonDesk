// ==========================================
// PM2 Ecosystem Configuration
// ==========================================
module.exports = {
  apps: [
    {
      // Application name
      name: 'carbon-accounting-api',

      // Script to start
      script: './backend/server.js',

      // Working directory
      cwd: './',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5001
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      },

      // Instance configuration
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster', // Cluster mode for load balancing

      // Logging
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      log_file: './backend/logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Watch and ignore
      watch: false, // Set to true in development if you want hot reload
      ignore_watch: ['node_modules', 'logs', 'uploads', 'database'],

      // Advanced features
      merge_logs: true,
      output: './backend/logs/pm2-out.log',
      error: './backend/logs/pm2-error.log',

      // Monitoring
      instance_var: 'INSTANCE_ID',

      // Cron restart (optional - restart every day at 3 AM)
      // cron_restart: '0 3 * * *',

      // Source map support
      source_map_support: true,

      // Interpreter
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=2048',

      // Additional environment variables
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5001
      }
    }
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/carbon-accounting.git',
      path: '/var/www/carbon-accounting',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    },
    staging: {
      user: 'deploy',
      host: ['your-staging-server-ip'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/carbon-accounting.git',
      path: '/var/www/carbon-accounting-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
