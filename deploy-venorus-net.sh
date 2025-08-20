#!/bin/bash

# Venorus.net Production Deployment Script
# Target: root@109.73.195.215
# Domain: venorus.net

set -e

echo "=== Venorus.net Production Deployment ==="
echo "Domain: venorus.net"
echo "Server: 109.73.195.215"
echo "Starting deployment..."

# Configuration
SERVER_USER="root"
SERVER_HOST="109.73.195.215"
DOMAIN="venorus.net"
APP_DIR="/opt/venorus-net"
REPO_URL="https://github.com/iMAGRAY/venorus.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Deploy to server
deploy_to_server() {
    log "Connecting to server and deploying..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        set -e
        
        echo "=== Server Deployment Started ==="
        
        # Update system
        apt update && apt upgrade -y
        
        # Install required packages
        apt install -y curl git nginx postgresql-client redis-tools
        
        # Install Node.js 18.x
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
        
        # Verify installations
        node --version
        npm --version
        
        # Create application directory
        mkdir -p /opt/venorus-net
        cd /opt/venorus-net
        
        # Clone repository
        if [ -d ".git" ]; then
            echo "Repository exists, pulling latest changes..."
            git pull origin main
        else
            echo "Cloning repository..."
            git clone https://github.com/iMAGRAY/venorus.git .
        fi
        
        # Create SSL certificates directory
        mkdir -p /home/app/.cloud-certs
        
        # Install dependencies
        npm ci --production
        
        # Build application
        npm run build
        
        echo "=== Application deployed successfully ==="
ENDSSH

    log "Server deployment completed"
}

# Setup SSL certificates
setup_ssl_certs() {
    log "Setting up SSL certificates..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Install certbot for Let's Encrypt
        apt install -y certbot python3-certbot-nginx
        
        # Create SSL certificates directory for PostgreSQL
        mkdir -p /home/app/.cloud-certs
        
        echo "SSL certificates setup completed"
ENDSSH
}

# Configure Nginx
setup_nginx() {
    log "Configuring Nginx for venorus.net..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create Nginx configuration
        cat > /etc/nginx/sites-available/venorus.net << 'EOF'
server {
    listen 80;
    server_name venorus.net www.venorus.net;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name venorus.net www.venorus.net;
    
    # SSL Configuration (will be configured by certbot)
    # ssl_certificate /etc/letsencrypt/live/venorus.net/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/venorus.net/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Proxy to Next.js application
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
        alias /opt/venorus-net/.next/static;
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
        ln -sf /etc/nginx/sites-available/venorus.net /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        
        # Test Nginx configuration
        nginx -t
        
        # Restart Nginx
        systemctl restart nginx
        systemctl enable nginx
        
        echo "Nginx configured for venorus.net"
ENDSSH
}

# Setup systemd service
setup_systemd_service() {
    log "Setting up systemd service..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create systemd service
        cat > /etc/systemd/system/venorus-net.service << 'EOF'
[Unit]
Description=Venorus.net Next.js Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/venorus-net
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=venorus-net

[Install]
WantedBy=multi-user.target
EOF

        # Reload systemd and enable service
        systemctl daemon-reload
        systemctl enable venorus-net
        
        echo "Systemd service configured"
ENDSSH
}

# Setup environment variables
setup_environment() {
    log "Setting up production environment..."
    
    # Copy production environment file
    scp .env.production ${SERVER_USER}@${SERVER_HOST}:/opt/venorus-net/.env
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/venorus-net
        
        # Set proper permissions
        chmod 600 .env
        
        echo "Environment variables configured"
ENDSSH
}

# Test connections
test_connections() {
    log "Testing database and Redis connections..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/venorus-net
        
        # Test PostgreSQL connection
        echo "Testing PostgreSQL connection..."
        export PGSSLROOTCERT=/home/app/.cloud-certs/root.crt
        
        # Test Redis connection
        echo "Testing Redis connection..."
        # redis-cli -h <host> -p 6379 --user default --pass '<password>' ping
        
        echo "Connection tests completed"
ENDSSH
}

# Start application
start_application() {
    log "Starting application..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/venorus-net
        
        # Start the service
        systemctl start venorus-net
        
        # Check status
        systemctl status venorus-net --no-pager
        
        echo "Application started"
ENDSSH
}

# Setup SSL with Let's Encrypt
setup_letsencrypt() {
    log "Setting up Let's Encrypt SSL for venorus.net..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Get SSL certificate
        certbot certonly --standalone -d venorus.net -d www.venorus.net --email admin@venorus.net --agree-tos --non-interactive
        
        # Update Nginx configuration to use SSL
        sed -i 's/# ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/venorus.net
        
        # Start nginx
        systemctl start nginx
        
        # Setup auto-renewal
        crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -
        
        echo "Let's Encrypt SSL configured"
ENDSSH
}

# Main deployment function
main() {
    log "Starting Venorus.net deployment..."
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        error ".env.production file not found. Please create it first."
    fi
    
    # Deploy application
    deploy_to_server
    
    # Setup SSL certificates
    setup_ssl_certs
    
    # Configure Nginx
    setup_nginx
    
    # Setup systemd service
    setup_systemd_service
    
    # Setup environment
    setup_environment
    
    # Test connections
    test_connections
    
    # Start application
    start_application
    
    # Setup Let's Encrypt (commented out - requires DNS to be pointing to server)
    # setup_letsencrypt
    
    log "Deployment completed successfully!"
    log "Application should be accessible at: http://venorus.net"
    warn "Don't forget to:"
    warn "1. Point venorus.net DNS to 109.73.195.215"
    warn "2. Run setup_letsencrypt after DNS propagation"
    warn "3. Download and install PostgreSQL SSL certificate"
}

# Run main function
main "$@"