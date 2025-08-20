#!/bin/bash

# SSL Auto-Setup Script for venorus.net
# This script will set up Let's Encrypt SSL certificates and auto-renewal

set -e

SERVER_USER="root"
SERVER_HOST="109.73.195.215"
DOMAIN="venorus.net"

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

check_dns() {
    log "Checking DNS resolution for venorus.net..."
    
    if ! dig +short venorus.net | grep -q "109.73.195.215"; then
        warn "DNS not pointing to server yet. Please configure DNS first:"
        warn "venorus.net A 109.73.195.215"
        warn "www.venorus.net CNAME venorus.net"
        read -p "Press Enter after DNS is configured and propagated..."
    fi
}

setup_ssl() {
    log "Setting up SSL certificates..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Install certbot if not already installed
        apt update
        apt install -y certbot python3-certbot-nginx
        
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Get SSL certificate
        certbot certonly --standalone \
            -d venorus.net \
            -d www.venorus.net \
            --email admin@venorus.net \
            --agree-tos \
            --non-interactive
        
        # Update Nginx configuration to use SSL
        cat > /etc/nginx/sites-available/venorus.net << 'EOF'
server {
    listen 80;
    server_name venorus.net www.venorus.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name venorus.net www.venorus.net;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/venorus.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/venorus.net/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
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
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # Static files
    location /_next/static {
        alias /opt/medsip/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/api/health;
    }
    
    # Security.txt
    location /.well-known/security.txt {
        return 200 "Contact: admin@venorus.net\nExpires: 2026-12-31T23:59:59.000Z\n";
        add_header Content-Type text/plain;
    }
}
EOF

        # Add rate limiting to nginx.conf
        if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
            sed -i '/http {/a\\tlimit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;' /etc/nginx/nginx.conf
        fi
        
        # Test nginx configuration
        nginx -t
        
        # Start nginx
        systemctl start nginx
        
        echo "✅ SSL certificates installed and nginx configured"
ENDSSH
}

setup_auto_renewal() {
    log "Setting up auto-renewal..."
    
    ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
        # Create renewal script
        cat > /usr/local/bin/renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

set -e

LOG_FILE="/var/log/ssl-renewal.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "Starting SSL certificate renewal check..."

# Renew certificates
if certbot renew --quiet --nginx; then
    log "Certificate renewal check completed successfully"
    
    # Reload nginx if certificates were renewed
    if systemctl reload nginx; then
        log "Nginx reloaded successfully"
    else
        log "ERROR: Failed to reload nginx"
        exit 1
    fi
else
    log "ERROR: Certificate renewal failed"
    exit 1
fi

log "SSL renewal process completed"
EOF

        # Make script executable
        chmod +x /usr/local/bin/renew-ssl.sh
        
        # Add to crontab for auto-renewal (twice daily)
        crontab -l 2>/dev/null | grep -v "/usr/local/bin/renew-ssl.sh" | crontab -
        (crontab -l 2>/dev/null; echo "0 2,14 * * * /usr/local/bin/renew-ssl.sh") | crontab -
        
        # Test renewal script
        /usr/local/bin/renew-ssl.sh
        
        echo "✅ Auto-renewal configured and tested"
ENDSSH
}

verify_ssl() {
    log "Verifying SSL setup..."
    
    # Test HTTPS
    if curl -s https://venorus.net/api/health > /dev/null; then
        log "✅ HTTPS is working correctly"
    else
        error "❌ HTTPS is not working"
    fi
    
    # Test HTTP redirect
    if curl -s -I http://venorus.net | grep -q "301"; then
        log "✅ HTTP to HTTPS redirect is working"
    else
        warn "❌ HTTP redirect may not be working properly"
    fi
}

main() {
    log "Starting SSL auto-setup for venorus.net..."
    
    # Check DNS first
    check_dns
    
    # Setup SSL certificates
    setup_ssl
    
    # Setup auto-renewal
    setup_auto_renewal
    
    # Verify everything works
    verify_ssl
    
    log "🎉 SSL setup completed successfully!"
    log "venorus.net is now secured with HTTPS"
    log "Certificates will auto-renew twice daily"
}

# Run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi