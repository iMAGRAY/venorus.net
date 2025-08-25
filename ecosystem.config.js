module.exports = {
  apps: [
    {
      name: 'venorus-net',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/venorus',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',
      
      // Environment - ВАЖНО для правильной работы
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DISABLE_RATE_LIMIT: 'false',
        NEXT_TELEMETRY_DISABLED: 1
      },
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      restart_delay: 4000,
      max_restarts: 5,
      min_uptime: '10s',
      
      // Logging
      log_file: '/opt/venorus/logs/combined.log',
      out_file: '/opt/venorus/logs/out.log',
      error_file: '/opt/venorus/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_timeout: 3000,
      
      // Advanced PM2 features
      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true,
      
      // Node.js optimization for production
      node_args: [
        '--max-old-space-size=4096',
        '--optimize-for-size',
        '--no-warnings'
      ],
      
      // Process monitoring
      monitoring: true,
      pmx: true,
      
      // Cron restart (daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Environment specific settings
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DISABLE_RATE_LIMIT: 'false'
      }
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'root',
      host: '109.73.195.215',
      ref: 'origin/main',
      repo: 'https://github.com/iMAGRAY/venorus.com.git',
      path: '/opt/venorus',
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save'
    }
  }
};