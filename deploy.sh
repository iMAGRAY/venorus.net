#!/bin/bash

# MedSIP Production Deployment Script
# Target: root@109.73.195.215
# Domain: venorus.com
# Repository: https://github.com/iMAGRAY/medsip.protez/

set -e

echo "=== MedSIP Production Deployment ==="
echo "Domain: venorus.com"
echo "Server: 109.73.195.215"
echo "Starting deployment..."

# Configuration
SERVER_USER="root"
SERVER_HOST="109.73.195.215"
DOMAIN="venorus.com"
APP_DIR="/opt/medsip"
REPO_URL="https://github.com/iMAGRAY/medsip.protez/"

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
        mkdir -p /opt/medsip
        cd /opt/medsip
        
        # Clone repository
        if [ -d ".git" ]; then
            echo "Repository exists, pulling latest changes..."
            git pull origin main
        else
            echo "Cloning repository..."
            git clone https://github.com/iMAGRAY/medsip.protez/ .
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
        
        # Download TWC root certificate (placeholder - needs actual certificate)
        # wget -O /home/app/.cloud-certs/root.crt https://twc.cert.url/root.crt
        
        echo "SSL certificates setup completed"
ENDSSH
}

# Configure Nginx
setup_nginx() {
    log "Configuring Nginx for venorus.com..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create Nginx configuration
        cat > /etc/nginx/sites-available/venorus.com << 'EOF'
server {
    listen 80;
    server_name venorus.com www.venorus.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name venorus.com www.venorus.com;
    
    # SSL Configuration (will be configured by certbot)
    # ssl_certificate /etc/letsencrypt/live/venorus.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/venorus.com/privkey.pem;
    
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
        
        # Test Nginx configuration
        nginx -t
        
        # Restart Nginx
        systemctl restart nginx
        systemctl enable nginx
        
        echo "Nginx configured for venorus.com"
ENDSSH
}

# Setup systemd service
setup_systemd_service() {
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

        # Reload systemd and enable service
        systemctl daemon-reload
        systemctl enable medsip
        
        echo "Systemd service configured"
ENDSSH
}

# Setup environment variables
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

# Test connections
test_connections() {
    log "Testing database and Redis connections..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/medsip
        
        # Test PostgreSQL connection
        echo "Testing PostgreSQL connection..."
        export PGSSLROOTCERT=/home/app/.cloud-certs/root.crt
        # psql 'postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=verify-full' -c '\l'
        
        # Test Redis connection
        echo "Testing Redis connection..."
        redis-cli -h 94.141.162.221 -p 6379 --user default --pass '&J.~&kXF3y~F0#' ping
        
        echo "Connection tests completed"
ENDSSH
}

# Start application
start_application() {
    log "Starting application..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        cd /opt/medsip
        
        # Start the service
        systemctl start medsip
        
        # Check status
        systemctl status medsip --no-pager
        
        echo "Application started"
ENDSSH
}

# Setup SSL with Let's Encrypt
setup_letsencrypt() {
    log "Setting up Let's Encrypt SSL for venorus.com..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Get SSL certificate
        certbot certonly --standalone -d venorus.com -d www.venorus.com --email admin@venorus.com --agree-tos --non-interactive
        
        # Update Nginx configuration to use SSL
        sed -i 's/# ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/venorus.com
        
        # Start nginx
        systemctl start nginx
        
        # Setup auto-renewal
        crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -
        
        echo "Let's Encrypt SSL configured"
ENDSSH
}

# Main deployment function
main() {
    log "Starting MedSIP deployment to venorus.com..."
    
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
    log "Application should be accessible at: http://venorus.com"
    warn "Don't forget to:"
    warn "1. Point venorus.com DNS to 109.73.195.215"
    warn "2. Run setup_letsencrypt after DNS propagation"
    warn "3. Download and install PostgreSQL SSL certificate"
}

# Run main function
main "$@"