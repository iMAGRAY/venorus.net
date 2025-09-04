module.exports = {
  apps: [{
    name: 'venorus',
    script: './node_modules/next/dist/bin/next',
    args: 'start',
    cwd: process.cwd(),
    instances: 1,
    exec_mode: 'fork',
    
    // Critical environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Memory and restarts
    max_memory_restart: '4G',
    node_args: '--max-old-space-size=4096',
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}