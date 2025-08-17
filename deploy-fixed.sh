#!/bin/bash

# MedSIP Production Deployment Script - Fixed version
# Target: root@109.73.195.215
# Domain: venorus.com

set -e

echo "=== MedSIP Production Deployment (Fixed) ==="
echo "Domain: venorus.com"
echo "Server: 109.73.195.215"

SERVER_USER="root"
SERVER_HOST="109.73.195.215"
DOMAIN="venorus.com"
APP_DIR="/opt/medsip"
REPO_URL="https://github.com/iMAGRAY/medsip.protez/"

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
    log "Deploying application to server..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        set -e
        
        cd /opt/medsip
        
        # Install dependencies without prepare scripts
        echo "Installing dependencies without husky..."
        npm ci --production --ignore-scripts
        
        # Install husky globally to avoid prepare script issues
        npm install -g husky
        
        # Build application
        echo "Building application..."
        npm run build
        
        echo "Application built successfully"
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
        redis-cli -h 94.141.162.221 -p 6379 --user default --pass '&J.~&kXF3y~F0#' ping
        
        if [ $? -eq 0 ]; then
            echo "Redis connection successful"
        else
            echo "Redis connection failed"
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
        
        echo "Nginx configured successfully"
ENDSSH
}

setup_systemd() {
    log "Setting up systemd service..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create systemd service
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
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=medsip

[Install]
WantedBy=multi-user.target
EOF

        # Enable and start service
        systemctl daemon-reload
        systemctl enable medsip
        systemctl start medsip
        
        # Check status
        sleep 5
        systemctl status medsip --no-pager -l
        
        echo "Systemd service configured and started"
ENDSSH
}

main() {
    log "Starting fixed deployment..."
    
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
    
    log "Deployment completed successfully!"
    log "Application should be accessible at: http://venorus.com"
    log "Check application status: systemctl status medsip"
    
    warn "Next steps:"
    warn "1. Point venorus.com DNS to 109.73.195.215"
    warn "2. Setup SSL certificate with certbot"
    warn "3. Get PostgreSQL SSL certificate from TWC Cloud"
}

main "$@"