#!/bin/bash

# MedSIP Production Deployment Script - Memory fix version
# Target: root@109.73.195.215
# Domain: venorus.com

set -e

echo "=== MedSIP Production Deployment (Memory Fix) ==="
echo "Domain: venorus.com"
echo "Server: 109.73.195.215"

SERVER_USER="root"
SERVER_HOST="109.73.195.215"
DOMAIN="venorus.com"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

deploy_application() {
    log "Deploying application to server with memory optimization..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        set -e
        
        cd /opt/medsip
        
        # Install ALL dependencies (including dev for build)
        echo "Installing all dependencies..."
        npm ci --ignore-scripts
        
        # Install husky globally
        npm install -g husky
        
        # Create custom build script with memory limit
        echo "Creating optimized build script..."
        cat > build-with-memory.js << 'EOF'
const { spawn } = require('child_process');

// Set Node.js memory limit to 2GB
process.env.NODE_OPTIONS = '--max-old-space-size=2048';

console.log('Building with increased memory limit...');

const build = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: { 
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=2048'
    }
});

build.on('close', (code) => {
    process.exit(code);
});
EOF
        
        # Build application with memory limit
        echo "Building application with increased memory..."
        node build-with-memory.js
        
        # Clean up build script
        rm build-with-memory.js
        
        # Remove dev dependencies after build
        echo "Removing dev dependencies..."
        npm prune --production
        
        echo "Application built and optimized successfully"
ENDSSH
    
    log "Application deployment completed"
}

setup_environment() {
    log "Setting up production environment..."
    
    # Copy production environment file
    scp .env.production ${SERVER_USER}@${SERVER_HOST}:/opt/medsip/.env
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/medsip
        
        # Set proper permissions
        chmod 600 .env
        
        echo "Environment variables configured"
ENDSSH
}

test_connections() {
    log "Testing Redis connection..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Test Redis connection
        echo "Testing Redis connection..."
        if redis-cli -h 94.141.162.221 -p 6379 --user default --pass '&J.~&kXF3y~F0#' ping | grep -q PONG; then
            echo "✅ Redis connection successful"
        else
            echo "❌ Redis connection failed"
            exit 1
        fi
ENDSSH
}

setup_nginx() {
    log "Configuring Nginx..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create Nginx configuration
        cat > /etc/nginx/sites-available/venorus.com << 'EOF'
server {
    listen 80;
    server_name venorus.com www.venorus.com;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static files
    location /_next/static {
        alias /opt/medsip/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/api/health;
    }
}
EOF

        # Enable site
        ln -sf /etc/nginx/sites-available/venorus.com /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        
        # Test and restart Nginx
        nginx -t && systemctl restart nginx
        
        echo "✅ Nginx configured successfully"
ENDSSH
}

setup_systemd() {
    log "Setting up systemd service..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create systemd service with memory limits
        cat > /etc/systemd/system/medsip.service << 'EOF'
[Unit]
Description=MedSIP Next.js Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/medsip
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NODE_OPTIONS=--max-old-space-size=1024
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=medsip
MemoryLimit=1.5G

[Install]
WantedBy=multi-user.target
EOF

        # Enable and start service
        systemctl daemon-reload
        systemctl enable medsip
        systemctl start medsip
        
        # Check status
        sleep 10
        systemctl status medsip --no-pager -l
        
        echo "✅ Systemd service configured and started"
ENDSSH
}

verify_deployment() {
    log "Verifying deployment..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Check if application is responding
        echo "Testing application health..."
        sleep 15
        
        # Try multiple times with backoff
        for i in {1..5}; do
            echo "Attempt $i/5..."
            if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
                echo "✅ Application is responding"
                curl http://localhost:3000/api/health
                exit 0
            else
                echo "❌ Attempt $i failed, waiting..."
                sleep 10
            fi
        done
        
        echo "❌ Application is not responding after 5 attempts"
        echo "Checking logs..."
        journalctl -u medsip --no-pager -n 30
        exit 1
ENDSSH
}

main() {
    log "Starting memory-optimized deployment..."
    
    # Check environment file
    if [ ! -f ".env.production" ]; then
        error ".env.production file not found"
    fi
    
    # Deploy application
    deploy_application
    
    # Setup environment
    setup_environment
    
    # Test connections
    test_connections
    
    # Setup Nginx
    setup_nginx
    
    # Setup systemd service
    setup_systemd
    
    # Verify deployment
    verify_deployment
    
    log "🎉 Deployment completed successfully!"
    log "Application is accessible at: http://venorus.com"
    log "Service status: systemctl status medsip"
    log "Logs: journalctl -u medsip -f"
    
    warn "⚠️  Next steps:"
    warn "1. Point venorus.com DNS to 109.73.195.215"
    warn "2. Setup SSL certificate: certbot --nginx -d venorus.com -d www.venorus.com"
    warn "3. Get PostgreSQL SSL certificate from TWC Cloud"
    warn "4. Test database connection after SSL cert setup"
}

main "$@"